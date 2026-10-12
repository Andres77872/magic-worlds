/**
 * App knowledge — the context the app-wide assistant reads before answering.
 *
 * Everything here is pure: it turns the localized product guide (the same copy
 * the Docs page renders) and the signed-in user's library (already loaded by
 * DataProvider) into compact Markdown sections with stable in-app links. The
 * page decides which sections ride along; the BFF only forwards the text.
 *
 * Budgets are character-based on purpose: they are cheap, deterministic, and
 * independent of the model's tokenizer. Token figures shown in the UI are the
 * shared `estimateTokens` heuristic, never a billing number.
 */

import type { TFunction } from 'i18next'
import type { Adventure, Character, Item, Lorebook, LorebookResource, PageType, Story, World } from '@/shared'
import { getDocsContent } from '@/features/docs/components/docsContent'
import { buildGalleryCardHash, buildLinkedEditorHash, buildResourceHash, pageHash } from '@/features/gallery/galleryLinks'
import { estimateTokens } from '@/features/lorebook/lorebookTransforms'
import { isPersonaCard } from '@/utils/characterRoles'

export type KnowledgeSourceKey = 'guide' | 'library' | 'lorebooks' | 'resources' | 'novels'

export const KNOWLEDGE_SOURCE_KEYS: readonly KnowledgeSourceKey[] = ['guide', 'library', 'lorebooks', 'resources', 'novels']

/** Library shapes the assistant can focus on in full detail. */
export type FocusKind = 'character' | 'persona' | 'world' | 'item' | 'adventure' | 'lorebook' | 'resource' | 'novel'

export interface FocusRef {
    kind: FocusKind
    id: string
}

export interface KnowledgeLibrary {
    characters: Character[]
    worlds: World[]
    items: Item[]
    adventures: Adventure[]
    lorebooks: Lorebook[]
    resources: LorebookResource[]
    stories: Story[]
}

export interface KnowledgeSection {
    key: KnowledgeSourceKey | 'focus'
    /** Number of records the section describes (guide = guide sections). */
    count: number
    markdown: string
    tokens: number
    /** True when the per-section budget dropped records or clipped prose. */
    truncated: boolean
}

export interface AppKnowledge {
    sections: KnowledgeSection[]
    /** The sections joined in send order — what the BFF receives as `context`. */
    markdown: string
    tokens: number
    truncated: boolean
}

/** Hard ceilings, in characters. The BFF enforces its own, larger, cap. */
export const KNOWLEDGE_LIMITS = {
    /** Per digest section (library, lorebooks, resources, novels). */
    section: 14_000,
    /** Full-detail focus block. */
    focus: 24_000,
    /** Everything together. */
    total: 60_000,
    /** Summary prose per record inside a digest. */
    summary: 220,
    /** Prose per focused record. */
    detail: 6_000,
    /** Lorebook entries listed per lorebook inside the digest. */
    digestEntries: 12,
} as const

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Collapse whitespace and clip to `max` characters on a word boundary. */
export function clip(text: string | null | undefined, max: number): string {
    const flat = (text ?? '').replace(/\s+/g, ' ').trim()
    if (flat.length <= max) return flat
    const cut = flat.slice(0, max)
    const space = cut.lastIndexOf(' ')
    return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** Clip multi-line prose while keeping paragraph breaks (focus detail). */
function clipBlock(text: string | null | undefined, max: number): string {
    const value = (text ?? '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (value.length <= max) return value
    return `${value.slice(0, max).trimEnd()}…`
}

/** Markdown link label: brackets would break the link syntax. */
function label(text: string | null | undefined, fallback: string): string {
    const value = clip(text, 80).replace(/[[\]]/g, '') || fallback
    return value
}

function list(values: readonly string[] | null | undefined, max = 8): string {
    const clean = (values ?? []).map((value) => clip(value, 40)).filter(Boolean)
    if (!clean.length) return ''
    return clean.length > max ? `${clean.slice(0, max).join(', ')}, +${clean.length - max}` : clean.join(', ')
}

function attributeLines(groups: Character['category']): string[] {
    const lines: string[] = []
    for (const group of groups ?? []) {
        const pairs = (group.attributes ?? [])
            .flatMap((attribute) => Object.entries(attribute))
            .map(([key, value]) => `${key}: ${value}`)
        if (group.name || pairs.length) lines.push(`- ${group.name || 'Attributes'}${pairs.length ? ` — ${clip(pairs.join('; '), 400)}` : ''}`)
    }
    return lines
}

function recordLines(title: string, record: Record<string, string | number> | undefined): string[] {
    const pairs = Object.entries(record ?? {}).filter(([, value]) => String(value).trim())
    return pairs.length ? [`- ${title}: ${clip(pairs.map(([key, value]) => `${key} ${value}`).join('; '), 400)}`] : []
}

/**
 * Append lines until the character budget is spent. Returns the kept text and
 * whether anything was dropped, so the UI can say "partial" honestly.
 */
function fitLines(lines: string[], budget: number, overflowNote: (dropped: number) => string): { text: string; truncated: boolean } {
    const kept: string[] = []
    let used = 0
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]
        if (used + line.length + 1 > budget) {
            kept.push(overflowNote(lines.length - index))
            return { text: kept.join('\n'), truncated: true }
        }
        kept.push(line)
        used += line.length + 1
    }
    return { text: kept.join('\n'), truncated: false }
}

function section(key: KnowledgeSection['key'], count: number, markdown: string, truncated: boolean): KnowledgeSection {
    return { key, count, markdown, tokens: markdown ? estimateTokens(markdown) : 0, truncated }
}

// ---------------------------------------------------------------------------
// In-app links
// ---------------------------------------------------------------------------

/**
 * The in-app link for a record. Cards link to their gallery entry; lorebooks
 * and novels link to their editor, which opens on them straight from the URL
 * (`LinkedEditorGate`), so these links also work in a new tab.
 */
export function focusLink(ref: FocusRef): string {
    switch (ref.kind) {
        case 'character':
            return buildGalleryCardHash('character', ref.id)
        case 'persona':
            return buildGalleryCardHash('persona', ref.id)
        case 'world':
            return buildGalleryCardHash('world', ref.id)
        case 'item':
            return buildGalleryCardHash('item', ref.id)
        case 'adventure':
            return buildGalleryCardHash('adventure', ref.id)
        case 'resource':
            return buildResourceHash(ref.id)
        case 'lorebook':
            return buildLinkedEditorHash('lorebook', ref.id)
        case 'novel':
            return buildLinkedEditorHash('story', ref.id)
    }
}

/** Recognize the lorebook/novel links `focusLink` emits; other hashes navigate natively. */
export function parseFocusLink(href: string | null | undefined): FocusRef | null {
    if (!href?.startsWith('#/')) return null
    const [path, query = ''] = href.slice(1).split('?')
    const params = new URLSearchParams(query)
    if (path === '/lorebook' && params.get('lorebook')) return { kind: 'lorebook', id: params.get('lorebook')! }
    if (path === '/story' && params.get('story')) return { kind: 'novel', id: params.get('story')! }
    return null
}

// ---------------------------------------------------------------------------
// Product guide
// ---------------------------------------------------------------------------

/**
 * The Docs page copy as Markdown, plus the route of every workspace so the
 * assistant can answer "where do I…" with a clickable link. Follows the active
 * language because it is built from the same i18n keys.
 */
export function buildGuideSection(t: TFunction, isPageVisible: (page: PageType) => boolean = () => true): KnowledgeSection {
    const docs = getDocsContent(t)
    const visible = isPageVisible
    const lines: string[] = [`# ${docs.page.title}`, docs.page.subtitle, '']
    const guides: Record<string, { title: string; body: string }[]> = {
        start: docs.quickStart,
        library: docs.libraryGuide,
        cards: docs.cardGuide,
        play: docs.playGuide,
        'voice-presets': docs.voicePresetGuide,
        voice: docs.voiceGuide,
        writing: docs.writingGuide,
        resources: docs.resourcesGuide,
        media: docs.mediaGuide,
    }
    for (const entry of docs.sections) {
        lines.push(`## ${entry.title}`, entry.intro)
        if (entry.id === 'map') {
            lines.push(`### ${docs.mapHeadings.primaryWorkspaces}`)
            for (const item of docs.mapItems) {
                if (!visible(item.page)) continue
                lines.push(`- [${label(item.title, item.page)}](${pageHash(item.page)}) — ${clip(item.body, 400)}`)
            }
            lines.push(`### ${docs.mapHeadings.utilityRail}`)
            for (const item of docs.utilityItems) lines.push(`- ${item.title} — ${clip(item.body, 400)}`)
        } else if (entry.id === 'best-practices') {
            for (const practice of docs.bestPractices) lines.push(`- ${clip(practice, 400)}`)
        } else {
            for (const item of guides[entry.id] ?? []) lines.push(`- **${item.title}** — ${clip(item.body, 400)}`)
        }
        lines.push('')
    }
    lines.push(`### ${t('appAssistant.knowledge.routesHeading')}`)
    for (const action of docs.primaryActions) {
        if (visible(action.page)) lines.push(`- [${label(action.label, action.page)}](${pageHash(action.page)})`)
    }
    const markdown = lines.join('\n').trim()
    return section('guide', docs.sections.length, markdown, false)
}

// ---------------------------------------------------------------------------
// Library digests
// ---------------------------------------------------------------------------

function cardLine(kind: FocusKind, id: string, name: string, meta: string[], summary: string | null | undefined, triggers?: string[]): string {
    const head = `- [${label(name, kind)}](${focusLink({ kind, id })})`
    const facts = meta.filter(Boolean).join(' · ')
    const body = clip(summary, KNOWLEDGE_LIMITS.summary)
    const keys = list(triggers, 6)
    return [head, facts && ` (${facts})`, body && ` — ${body}`, keys && ` · triggers: ${keys}`].filter(Boolean).join('')
}

export function adventureName(adventure: Adventure): string {
    return adventure.scenario?.split(/[.\n]/)[0] || adventure.world?.name || adventure.id
}

export function buildLibrarySection(library: Pick<KnowledgeLibrary, 'characters' | 'worlds' | 'items' | 'adventures'>, t: TFunction): KnowledgeSection {
    const characters = library.characters.filter((card) => !isPersonaCard(card))
    const personas = library.characters.filter(isPersonaCard)
    const groups: Array<{ heading: string; lines: string[] }> = [
        {
            heading: t('appAssistant.knowledge.characters', { count: characters.length }),
            lines: characters.map((card) => cardLine('character', card.id, card.name, [card.race, card.class ?? ''], card.description, card.triggers)),
        },
        {
            heading: t('appAssistant.knowledge.personas', { count: personas.length }),
            lines: personas.map((card) => cardLine('persona', card.id, card.name,
                [card.race, card.is_default_persona ? t('appAssistant.knowledge.defaultPersona') : ''], card.description, card.triggers)),
        },
        {
            heading: t('appAssistant.knowledge.worlds', { count: library.worlds.length }),
            lines: library.worlds.map((world) => cardLine('world', world.id, world.name, [world.type], world.description, world.triggers)),
        },
        {
            heading: t('appAssistant.knowledge.items', { count: library.items.length }),
            lines: library.items.map((item) => cardLine('item', item.id, item.name, [item.type ?? '', item.rarity ?? ''], item.description, item.triggers)),
        },
        {
            heading: t('appAssistant.knowledge.adventures', { count: library.adventures.length }),
            lines: library.adventures.map((adventure) => cardLine('adventure', adventure.id, adventureName(adventure),
                [list(adventure.characters?.map((card) => card.name), 4), adventure.world?.name ?? ''], adventure.scenario, adventure.triggers)),
        },
    ]
    const count = characters.length + personas.length + library.worlds.length + library.items.length + library.adventures.length
    return digest('library', t('appAssistant.knowledge.libraryHeading'), groups, count, t)
}

export function buildLorebookSection(lorebooks: Lorebook[], t: TFunction): KnowledgeSection {
    const lines = lorebooks.map((lorebook) => {
        const entries = lorebook.entries ?? []
        const head = cardLine('lorebook', lorebook.id, lorebook.name, [
            t('appAssistant.knowledge.entryCount', { count: entries.length }),
            lorebook.enabled === false ? t('appAssistant.knowledge.disabled') : '',
            list(lorebook.tags, 4),
        ], lorebook.description)
        const titles = entries
            .slice(0, KNOWLEDGE_LIMITS.digestEntries)
            .map((entry) => `  - ${clip(entry.title, 60) || clip(entry.content, 60)}${entry.keys.length ? ` [${list(entry.keys, 4)}]` : ''}`)
        if (entries.length > KNOWLEDGE_LIMITS.digestEntries) {
            titles.push(`  - ${t('appAssistant.knowledge.moreEntries', { count: entries.length - KNOWLEDGE_LIMITS.digestEntries })}`)
        }
        return [head, ...titles].join('\n')
    })
    return digest('lorebooks', t('appAssistant.knowledge.lorebooksHeading', { count: lorebooks.length }), [{ heading: '', lines }], lorebooks.length, t)
}

export function buildResourceSection(resources: LorebookResource[], t: TFunction): KnowledgeSection {
    const lines = resources.map((resource) => cardLine('resource', resource.id, resource.title, [
        resource.fileName,
        t('appAssistant.knowledge.chars', { count: resource.contentLength ?? resource.content.length }),
        resource.linkCount ? t('appAssistant.knowledge.linkedLorebooks', { count: resource.linkCount }) : '',
    ], resource.description || resource.extraction?.shortSummary || resource.content, resource.triggers))
    return digest('resources', t('appAssistant.knowledge.resourcesHeading', { count: resources.length }), [{ heading: '', lines }], resources.length, t)
}

export function buildNovelSection(stories: Story[], t: TFunction): KnowledgeSection {
    const lines = stories.map((story) => {
        const chapters = [...(story.chapters ?? [])].sort((a, b) => a.order - b.order)
        const head = cardLine('novel', story.id, story.title, [t('appAssistant.knowledge.chapterCount', { count: chapters.length })], story.description)
        const titles = chapters.slice(0, 10).map((chapter) => `  - ${clip(chapter.title, 70)} (${chapter.status})`)
        return [head, ...titles].join('\n')
    })
    return digest('novels', t('appAssistant.knowledge.novelsHeading', { count: stories.length }), [{ heading: '', lines }], stories.length, t)
}

function digest(key: KnowledgeSourceKey, heading: string, groups: Array<{ heading: string; lines: string[] }>, count: number, t: TFunction): KnowledgeSection {
    if (count === 0) return section(key, 0, `## ${heading}\n${t('appAssistant.knowledge.empty')}`, false)
    const lines: string[] = [`## ${heading}`]
    for (const group of groups) {
        if (!group.lines.length) continue
        if (group.heading) lines.push(`### ${group.heading}`)
        lines.push(...group.lines)
    }
    const { text, truncated } = fitLines(lines, KNOWLEDGE_LIMITS.section, (dropped) => `- ${t('appAssistant.knowledge.omitted', { count: dropped })}`)
    return section(key, count, text, truncated)
}

// ---------------------------------------------------------------------------
// Focus (full detail)
// ---------------------------------------------------------------------------

export function findFocusRecord(library: KnowledgeLibrary, ref: FocusRef): { name: string } | null {
    switch (ref.kind) {
        case 'character':
        case 'persona':
            return library.characters.find((card) => card.id === ref.id) ?? null
        case 'world':
            return library.worlds.find((card) => card.id === ref.id) ?? null
        case 'item':
            return library.items.find((card) => card.id === ref.id) ?? null
        case 'adventure': {
            const adventure = library.adventures.find((card) => card.id === ref.id)
            return adventure ? { name: adventureName(adventure) } : null
        }
        case 'lorebook':
            return library.lorebooks.find((lorebook) => lorebook.id === ref.id) ?? null
        case 'resource': {
            const resource = library.resources.find((entry) => entry.id === ref.id)
            return resource ? { name: resource.title } : null
        }
        case 'novel': {
            const story = library.stories.find((entry) => entry.id === ref.id)
            return story ? { name: story.title } : null
        }
    }
}

function focusDetail(library: KnowledgeLibrary, ref: FocusRef, t: TFunction): string | null {
    const max = KNOWLEDGE_LIMITS.detail
    const link = focusLink(ref)
    switch (ref.kind) {
        case 'character':
        case 'persona': {
            const card = library.characters.find((entry) => entry.id === ref.id)
            if (!card) return null
            return [
                `### [${label(card.name, ref.kind)}](${link}) — ${t(`appAssistant.focusKinds.${ref.kind}`)}`,
                [card.race, card.class].filter(Boolean).join(' · '),
                clipBlock(card.description, max),
                card.greeting ? `- Greeting: ${clip(card.greeting, 600)}` : '',
                ...recordLines('Stats', card.stats),
                ...recordLines('Skills', card.skills),
                ...recordLines('Traits', card.traits),
                ...recordLines('Equipment', card.equipment),
                ...attributeLines(card.category),
                card.triggers?.length ? `- Triggers: ${list(card.triggers, 24)}` : '',
            ].filter(Boolean).join('\n')
        }
        case 'world': {
            const world = library.worlds.find((entry) => entry.id === ref.id)
            if (!world) return null
            return [
                `### [${label(world.name, ref.kind)}](${link}) — ${t('appAssistant.focusKinds.world')}`,
                world.type,
                clipBlock(world.description, max),
                ...recordLines('Details', world.details),
                ...attributeLines(world.category),
                world.triggers?.length ? `- Triggers: ${list(world.triggers, 24)}` : '',
            ].filter(Boolean).join('\n')
        }
        case 'item': {
            const item = library.items.find((entry) => entry.id === ref.id)
            if (!item) return null
            return [
                `### [${label(item.name, ref.kind)}](${link}) — ${t('appAssistant.focusKinds.item')}`,
                [item.type, item.rarity, item.value].filter(Boolean).join(' · '),
                clipBlock(item.description, max),
                item.effects?.length ? `- Effects: ${list(item.effects, 12)}` : '',
                item.requirements?.length ? `- Requirements: ${list(item.requirements, 12)}` : '',
                item.limitations?.length ? `- Limitations: ${list(item.limitations, 12)}` : '',
                item.origin ? `- Origin: ${clip(item.origin, 600)}` : '',
                ...attributeLines(item.category),
                item.triggers?.length ? `- Triggers: ${list(item.triggers, 24)}` : '',
            ].filter(Boolean).join('\n')
        }
        case 'adventure': {
            const adventure = library.adventures.find((entry) => entry.id === ref.id)
            if (!adventure) return null
            return [
                `### [${label(adventureName(adventure), ref.kind)}](${link}) — ${t('appAssistant.focusKinds.adventure')}`,
                clipBlock(adventure.scenario, max),
                adventure.characters?.length ? `- Cast: ${list(adventure.characters.map((card) => card.name), 12)}` : '',
                adventure.world?.name ? `- World: ${adventure.world.name}` : '',
                ...recordLines('Objectives', adventure.objectives),
                ...recordLines('Notes', adventure.notes),
                adventure.triggers?.length ? `- Triggers: ${list(adventure.triggers, 24)}` : '',
            ].filter(Boolean).join('\n')
        }
        case 'lorebook': {
            const lorebook = library.lorebooks.find((entry) => entry.id === ref.id)
            if (!lorebook) return null
            const perEntry = Math.max(240, Math.floor(max / Math.max(1, lorebook.entries.length)))
            return [
                `### [${label(lorebook.name, ref.kind)}](${link}) — ${t('appAssistant.focusKinds.lorebook')}`,
                clipBlock(lorebook.description, 1_200),
                ...lorebook.entries.map((entry) => `- **${clip(entry.title, 80) || '—'}**${entry.keys.length ? ` [${list(entry.keys, 8)}]` : ''}${entry.enabled ? '' : ' (off)'}: ${clip(entry.content, perEntry)}`),
            ].filter(Boolean).join('\n')
        }
        case 'resource': {
            const resource = library.resources.find((entry) => entry.id === ref.id)
            if (!resource) return null
            return [
                `### [${label(resource.title, ref.kind)}](${link}) — ${t('appAssistant.focusKinds.resource')}`,
                resource.description ? clip(resource.description, 600) : '',
                resource.triggers.length ? `- Triggers: ${list(resource.triggers, 24)}` : '',
                resource.extraction?.longSummary ? `- Summary: ${clip(resource.extraction.longSummary, 1_200)}` : '',
                clipBlock(resource.content, max),
            ].filter(Boolean).join('\n')
        }
        case 'novel': {
            const story = library.stories.find((entry) => entry.id === ref.id)
            if (!story) return null
            const chapters = [...(story.chapters ?? [])].sort((a, b) => a.order - b.order)
            const perChapter = Math.max(300, Math.floor(max / Math.max(1, chapters.length)))
            return [
                `### [${label(story.title, ref.kind)}](${link}) — ${t('appAssistant.focusKinds.novel')}`,
                story.description ? clip(story.description, 600) : '',
                ...chapters.map((chapter) => `- **${clip(chapter.title, 80)}** (${chapter.status}): ${clip(chapter.body, perChapter)}`),
            ].filter(Boolean).join('\n')
        }
    }
}

/** Rough token cost of sending one record in full detail (the focus block's size). */
export function estimateFocusTokens(library: KnowledgeLibrary, ref: FocusRef, t: TFunction): number {
    const block = focusDetail(library, ref, t)
    return block ? estimateTokens(block) : 0
}

export function buildFocusSection(library: KnowledgeLibrary, focus: readonly FocusRef[], t: TFunction): KnowledgeSection {
    const blocks = focus.map((ref) => focusDetail(library, ref, t)).filter((block): block is string => Boolean(block))
    if (!blocks.length) return section('focus', 0, '', false)
    const { text, truncated } = fitLines([`## ${t('appAssistant.knowledge.focusHeading')}`, ...blocks], KNOWLEDGE_LIMITS.focus,
        (dropped) => `- ${t('appAssistant.knowledge.omitted', { count: dropped })}`)
    return section('focus', blocks.length, text, truncated)
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export interface ComposeKnowledgeOptions {
    t: TFunction
    library: KnowledgeLibrary
    enabled: ReadonlySet<KnowledgeSourceKey>
    focus?: readonly FocusRef[]
    /** Pages hidden by feature flags are left out of the guide's route list. */
    isPageVisible?: (page: PageType) => boolean
    /** The page the user came from, so "this page" questions have an anchor. */
    originPage?: PageType | null
}

/**
 * Build every section (so the panel can show counts for disabled ones too) and
 * join the enabled ones, focus first: what the user pinned matters most when
 * the total budget forces a cut.
 */
export function composeKnowledge({ t, library, enabled, focus = [], isPageVisible, originPage = null }: ComposeKnowledgeOptions): AppKnowledge {
    const sections: KnowledgeSection[] = [
        buildFocusSection(library, focus, t),
        buildGuideSection(t, isPageVisible),
        buildLibrarySection(library, t),
        buildLorebookSection(library.lorebooks, t),
        buildResourceSection(library.resources, t),
        buildNovelSection(library.stories, t),
    ]
    const included = sections.filter((entry) => entry.markdown && (entry.key === 'focus' || enabled.has(entry.key)))
    const parts: string[] = []
    let used = 0
    let truncated = included.some((entry) => entry.truncated)
    if (originPage) {
        const origin = `${t('appAssistant.knowledge.origin')}: ${pageHash(originPage)}`
        parts.push(origin)
        used += origin.length
    }
    for (const entry of included) {
        if (used + entry.markdown.length + 2 > KNOWLEDGE_LIMITS.total) {
            truncated = true
            continue
        }
        parts.push(entry.markdown)
        used += entry.markdown.length + 2
    }
    const markdown = parts.join('\n\n')
    return { sections, markdown, tokens: markdown ? estimateTokens(markdown) : 0, truncated }
}
