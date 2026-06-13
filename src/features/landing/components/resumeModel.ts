/**
 * Resume view-model — merges in-progress adventures and 1:1 character chats
 * into one recency-sorted "pick up the thread" list for the dashboard. Keeping
 * the mapping here lets the hero, the resume band, and global search agree on
 * titles, snippets, and ordering.
 */

import type { Adventure, CharacterChatSession, TurnEntry } from '@/shared'
import { formatRelativeTime, parseApiTimestamp } from '@/utils/time'

export interface ResumeSession {
    kind: 'adventure' | 'chat'
    /** Session id (adventure id / chat id). */
    id: string
    title: string
    /** Raw media URL (unresolved) — pass through resolveMediaUrl at render. */
    imageUrl?: string
    /** Where it happens: world name (adventure) or character race (chat). */
    context?: string
    /** The player's persona name, when one is attached. */
    playingAs?: string
    /** Last spoken/narrated line, for the italic snippet. */
    snippet?: string
    /** Mono meta line, e.g. "14 turns · 2 hr. ago". */
    meta: string
    /** NaN when the session has no parseable timestamp. */
    updatedAtMs: number
    source: Adventure | CharacterChatSession
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
    return {
        kind: 'chat',
        id: chat.id,
        title: meaningful(chat.character?.name) || 'Unknown character',
        imageUrl: chat.character?.image_url ?? undefined,
        context: meaningful(chat.character?.race) || undefined,
        playingAs: meaningful(chat.persona?.name) || undefined,
        snippet: lastTurnContent(chat.turns),
        meta: metaLine('message', chat.turns?.length ?? 0, stamp, now),
        updatedAtMs: parseApiTimestamp(stamp),
        source: chat,
    }
}

/**
 * Merge + sort sessions, newest first. Sessions without a parseable timestamp
 * keep their source-array position semantics (new sessions are appended, so a
 * later index reads as newer) and sort after any timestamped session.
 * `now` is injectable for deterministic tests.
 */
export function toResumeSessions(
    adventures: Adventure[],
    chats: CharacterChatSession[],
    now: number = Date.now(),
): ResumeSession[] {
    const entries = [
        ...adventures.map((adventure, index) => ({ session: fromAdventure(adventure, now), index })),
        ...chats.map((chat, index) => ({ session: fromChat(chat, now), index })),
    ]
    entries.sort((a, b) => {
        const aTime = a.session.updatedAtMs
        const bTime = b.session.updatedAtMs
        const aValid = !Number.isNaN(aTime)
        const bValid = !Number.isNaN(bTime)
        if (aValid && bValid && aTime !== bTime) return bTime - aTime
        if (aValid !== bValid) return aValid ? -1 : 1
        return b.index - a.index
    })
    return entries.map((entry) => entry.session)
}
