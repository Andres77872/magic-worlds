/**
 * Resume view-model — merges in-progress adventures, character chats (1:1 and
 * group), and novel drafts into one recency-sorted "pick up the thread" list for
 * the dashboard. Keeping the mapping here lets the hero carousel, the continue
 * rails, and global search agree on titles, snippets, and ordering.
 *
 * `RESUME_KIND_META` is the feature-local vocabulary for the three resume kinds
 * (deliberately separate from `@/shared/modes`' two-mode `MODE_META`, which feeds
 * the typed `ModeBadge` and must stay `adventure | chat`).
 */

import type { LucideIcon } from 'lucide-react'
import { Feather, MessageCircle, Play } from 'lucide-react'
import type { Adventure, CharacterChatSession, Story, TurnEntry } from '@/shared'
import { chaptersFor, wordCount } from '@/features/novel/utils/novelUtils'
import { formatRelativeTime, parseApiTimestamp } from '@/utils/time'

export type ResumeKind = 'adventure' | 'chat' | 'novel'

export interface ResumeSession {
    kind: ResumeKind
    /** Session id (adventure id / chat id / story id). */
    id: string
    title: string
    /** Raw media URL (unresolved) — pass through resolveMediaUrl at render. */
    imageUrl?: string
    /** Raw media URLs for grouped chat avatars. */
    imageUrls?: string[]
    isGroupChat?: boolean
    /** Where it happens: world name (adventure) or character race (chat). */
    context?: string
    /** The player's persona name, when one is attached. */
    playingAs?: string
    /** Last spoken/narrated line (chat/adventure) or premise (novel). */
    snippet?: string
    /** Mono meta line, e.g. "14 turns · 2 hr. ago". */
    meta: string
    /** NaN when the session has no parseable timestamp. */
    updatedAtMs: number
    source: Adventure | CharacterChatSession | Story
}

export interface ResumeKindMeta {
    /** i18n key for the kind label (e.g. "Adventure"). */
    labelKey: string
    tone: 'ember' | 'arcane'
    icon: LucideIcon
    /** i18n key for the verb on the continue affordance. */
    resumeLabelKey: string
    /** i18n key for the snippet shown when the session has no last line of its own. */
    fallbackSnippetKey: string
}

/** Single source of vocabulary + color for the three resume kinds. */
export const RESUME_KIND_META: Record<ResumeKind, ResumeKindMeta> = {
    adventure: {
        labelKey: 'landing.resumeMeta.adventureLabel',
        tone: 'ember',
        icon: Play,
        resumeLabelKey: 'landing.resumeMeta.adventureResume',
        fallbackSnippetKey: 'landing.resumeMeta.adventureFallback',
    },
    chat: {
        labelKey: 'landing.resumeMeta.chatLabel',
        tone: 'arcane',
        icon: MessageCircle,
        resumeLabelKey: 'landing.resumeMeta.chatResume',
        fallbackSnippetKey: 'landing.resumeMeta.chatFallback',
    },
    novel: {
        labelKey: 'landing.resumeMeta.novelLabel',
        tone: 'ember',
        icon: Feather,
        resumeLabelKey: 'landing.resumeMeta.novelResume',
        fallbackSnippetKey: 'landing.resumeMeta.novelFallback',
    },
}

function meaningful(value?: string | null): string {
    const text = value?.trim() ?? ''
    return text.length > 1 ? text : ''
}

/** Last non-empty turn content — the line the player left off on. */
function lastTurnContent(turns?: TurnEntry[]): string | undefined {
    if (!turns) return undefined
    for (let i = turns.length - 1; i >= 0; i--) {
        const content = turns[i]?.content?.trim()
        if (content) return content
    }
    return undefined
}

function adventureTitle(adventure: Adventure): string {
    const personaName = meaningful(adventure.persona?.name)
    const worldName = meaningful(adventure.world?.name)
    return (
        meaningful(adventure.snapshot?.template?.name) ||
        meaningful(adventure.scenario) ||
        (personaName ? `${personaName}'s adventure` : '') ||
        (worldName ? `Adventure in ${worldName}` : '') ||
        'Untitled session'
    )
}

function metaLine(countLabel: string, count: number, stamp: string | undefined, now: number): string {
    const parts: string[] = []
    if (count > 0) parts.push(`${count} ${countLabel}${count === 1 ? '' : 's'}`)
    const relative = formatRelativeTime(stamp, now)
    if (relative) parts.push(relative)
    return parts.join(' · ') || 'Ready to continue'
}

/** First card-ref cover painted into a novel's codex, if any. */
function storyCover(story: Story): string | undefined {
    for (const ref of story.activeCardRefs ?? []) {
        const url = ref.snapshot?.image_url
        if (typeof url === 'string' && url.trim()) return url
    }
    return undefined
}

function novelMeta(story: Story, now: number): string {
    const chapters = chaptersFor(story)
    const count = chapters.length || 1
    const words = chapters.reduce((sum, chapter) => sum + wordCount(chapter.body ?? ''), 0)
    const parts = [`${count} chapter${count === 1 ? '' : 's'}`]
    if (words > 0) parts.push(`${words} word${words === 1 ? '' : 's'}`)
    const relative = formatRelativeTime(story.updatedAt ?? story.createdAt, now)
    if (relative) parts.push(relative)
    return parts.join(' · ')
}

function fromAdventure(adventure: Adventure, now: number): ResumeSession {
    const stamp = adventure.updatedAt ?? adventure.createdAt
    return {
        kind: 'adventure',
        id: adventure.id,
        title: adventureTitle(adventure),
        imageUrl: adventure.image_url ?? adventure.snapshot?.template?.image_url ?? undefined,
        context: meaningful(adventure.world?.name) || meaningful(adventure.worlds?.[0]?.name) || undefined,
        playingAs: meaningful(adventure.persona?.name) || undefined,
        snippet: lastTurnContent(adventure.turns),
        meta: metaLine('turn', adventure.turns?.length ?? 0, stamp, now),
        updatedAtMs: parseApiTimestamp(stamp),
        source: adventure,
    }
}

function fromChat(chat: CharacterChatSession, now: number): ResumeSession {
    const stamp = chat.updatedAt ?? chat.createdAt
    const cast = chat.characters?.length ? chat.characters : chat.character ? [chat.character] : []
    const isGroupChat = chat.kind === 'character_group' || cast.length > 1
    const title = meaningful(chat.title) || (isGroupChat
        ? cast.map((character) => meaningful(character.name)).filter(Boolean).join(', ')
        : meaningful(cast[0]?.name)) || 'Unknown character'
    return {
        kind: 'chat',
        id: chat.id,
        title,
        imageUrl: cast[0]?.image_url ?? undefined,
        imageUrls: isGroupChat ? cast.map((character) => character.image_url).filter(Boolean) as string[] : undefined,
        isGroupChat,
        context: isGroupChat
            ? cast.map((character) => meaningful(character.name)).filter(Boolean).join(', ')
            : meaningful(cast[0]?.race) || undefined,
        playingAs: meaningful(chat.persona?.name) || undefined,
        snippet: lastTurnContent(chat.turns),
        meta: metaLine('message', chat.turns?.length ?? 0, stamp, now),
        updatedAtMs: parseApiTimestamp(stamp),
        source: chat,
    }
}

function fromStory(story: Story, now: number): ResumeSession {
    const stamp = story.updatedAt ?? story.createdAt
    const chapters = chaptersFor(story)
    const latest = chapters[chapters.length - 1]
    return {
        kind: 'novel',
        id: story.id,
        title: meaningful(story.title) || 'Untitled novel',
        imageUrl: storyCover(story),
        context: undefined,
        snippet: meaningful(story.description) || meaningful(latest?.title) || undefined,
        meta: novelMeta(story, now),
        updatedAtMs: parseApiTimestamp(stamp),
        source: story,
    }
}

/**
 * Newest first. Sessions without a parseable timestamp keep their source-array
 * position semantics (new sessions are appended, so a later index reads as
 * newer) and sort after any timestamped session.
 */
function recencyCompare(aTime: number, aIndex: number, bTime: number, bIndex: number): number {
    const aValid = !Number.isNaN(aTime)
    const bValid = !Number.isNaN(bTime)
    if (aValid && bValid && aTime !== bTime) return bTime - aTime
    if (aValid !== bValid) return aValid ? -1 : 1
    return bIndex - aIndex
}

/**
 * Sort any in-memory list newest-first by an injected timestamp accessor, with
 * the same untimestamped-keeps-array-order fallback as the resume merge. Shared
 * by the dashboard's per-type continue rails.
 */
export function sortByRecency<T>(items: T[], getStamp: (item: T) => string | null | undefined): T[] {
    return items
        .map((item, index) => ({ item, index }))
        .sort((a, b) =>
            recencyCompare(parseApiTimestamp(getStamp(a.item)), a.index, parseApiTimestamp(getStamp(b.item)), b.index),
        )
        .map((entry) => entry.item)
}

/**
 * Merge + sort sessions, newest first. `stories` is optional so the chat-only
 * and adventure-only callers (chatroom, search) stay terse; `now` is injectable
 * for deterministic tests.
 */
export function toResumeSessions(
    adventures: Adventure[],
    chats: CharacterChatSession[],
    stories: Story[] = [],
    now: number = Date.now(),
): ResumeSession[] {
    const entries = [
        ...adventures.map((adventure, index) => ({ session: fromAdventure(adventure, now), index })),
        ...chats.map((chat, index) => ({ session: fromChat(chat, now), index })),
        ...stories.map((story, index) => ({ session: fromStory(story, now), index })),
    ]
    entries.sort((a, b) => recencyCompare(a.session.updatedAtMs, a.index, b.session.updatedAtMs, b.index))
    return entries.map((entry) => entry.session)
}
