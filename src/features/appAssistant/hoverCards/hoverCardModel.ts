/**
 * Hover card model — the pure half of the assistant's card hover previews.
 *
 * Turns an in-app link (`#/gallery/<type>?card=<id>`, `#/lorebook?lorebook=<id>`)
 * into a typed reference, builds the compact preview a hover card shows from the
 * library DataProvider already holds (no request), and finds other library
 * names inside a description so the card can nest links to them.
 */
import type { TFunction } from 'i18next'
import type { CardPreview, CardPreviewTarget } from '@/features/cards/cardPreview'
import { buildCardEditHash, buildLinkedEditorHash, parseGalleryHash } from '@/features/gallery/galleryLinks'
import { readWorldPlaceType, worldPlaceTypeLabel, type Character, type World } from '@/shared'
import { isPersonaCard } from '@/utils/characterRoles'
import { adventureName, clip, parseFocusLink, type FocusKind, type FocusRef, type KnowledgeLibrary } from '../appKnowledge'

/** Library shapes that get a hover card (resources and novels keep plain links). */
export type HoverCardKind = Exclude<FocusKind, 'resource' | 'novel'>

export interface HoverCardRef extends FocusRef {
    kind: HoverCardKind
}

export interface HoverCardRelation {
    role: 'world' | 'cast'
    name: string
    /** The library record it points at, when one matches (by id, then by name). */
    ref: HoverCardRef | null
}

export interface HoverCardModel {
    ref: HoverCardRef
    title: string
    badge: string | null
    description: string
    tags: string[]
    /** Tags beyond the ones shown ("+5"). */
    moreTags: number
    imageUrl: string | null
    version: number | null
    updatedAt: string | null
    /** An adventure's world and cast, linked when they are in the library. */
    relations: HoverCardRelation[]
    /** Only library records can join the assistant's focus. */
    inLibrary: boolean
}

const GALLERY_KINDS: Record<string, HoverCardKind> = {
    character: 'character',
    persona: 'persona',
    world: 'world',
    item: 'item',
    adventure: 'adventure',
}

const TAG_LIMIT = 3
const DESCRIPTION_LIMIT = 360
const CAST_LIMIT = 4
/** Shorter names ("w", "Al") would light up ordinary words. */
const MIN_NAME_LENGTH = 3
/** Nested links per description; the first mention of each record only. */
const NESTED_LINK_LIMIT = 6

/** The record a card or lorebook link points at, or null for any other link. */
export function parseHoverCardHref(href: string | null | undefined): HoverCardRef | null {
    if (!href?.startsWith('#/')) return null
    const gallery = parseGalleryHash(href)
    if (gallery) {
        const kind = GALLERY_KINDS[gallery.type]
        return kind && gallery.cardId ? { kind, id: gallery.cardId } : null
    }
    const focus = parseFocusLink(href)
    return focus?.kind === 'lorebook' ? { kind: 'lorebook', id: focus.id } : null
}

/** The record's editor, which the card's Open action shows in a new tab (a persona edits as a character). */
export function hoverCardEditorHref(ref: HoverCardRef): string {
    switch (ref.kind) {
        case 'character':
        case 'persona':
            return buildCardEditHash('character', ref.id)
        case 'world':
        case 'item':
            return buildCardEditHash(ref.kind, ref.id)
        case 'adventure':
        case 'lorebook':
            return buildLinkedEditorHash(ref.kind, ref.id)
    }
}

export function hoverCardKey(ref: FocusRef): string {
    return `${ref.kind}:${ref.id}`
}

/**
 * Identity for focus comparisons: a persona is stored in the same character
 * list, and a link may call it either kind, so both compare as `character`.
 */
export function focusMatchKey(ref: FocusRef): string {
    return `${ref.kind === 'persona' ? 'character' : ref.kind}:${ref.id}`
}

/** What `fetchCardPreview` needs for a record the library does not hold (lorebooks have no preview). */
export function previewTargetFor(ref: HoverCardRef): CardPreviewTarget | null {
    if (ref.kind === 'lorebook') return null
    return { type: ref.kind === 'adventure' ? 'adventure_template' : ref.kind, id: ref.id }
}

function joined(parts: Array<string | null | undefined | false>): string | null {
    return parts.map((part) => (typeof part === 'string' ? part.trim() : '')).filter(Boolean).join(' · ') || null
}

function tagList(values: readonly string[] | null | undefined): Pick<HoverCardModel, 'tags' | 'moreTags'> {
    const clean = (values ?? []).map((value) => value.trim()).filter(Boolean)
    return { tags: clean.slice(0, TAG_LIMIT), moreTags: Math.max(0, clean.length - TAG_LIMIT) }
}

/** An adventure's description without its first sentence, which already is its title. */
function scenarioBody(scenario: string | null | undefined, title: string): string {
    const text = (scenario ?? '').trim()
    if (title && text.startsWith(title)) return text.slice(title.length).replace(/^[\s.…]+/, '')
    return text
}

function characterRef(card: Character): HoverCardRef {
    return { kind: isPersonaCard(card) ? 'persona' : 'character', id: card.id }
}

function findWorldRef(library: KnowledgeLibrary, world: Pick<World, 'id' | 'name'>): HoverCardRef | null {
    const match = library.worlds.find((card) => card.id === world.id) ?? library.worlds.find((card) => card.name === world.name)
    return match ? { kind: 'world', id: match.id } : null
}

function findCharacterRef(library: KnowledgeLibrary, character: Pick<Character, 'id' | 'name'>): HoverCardRef | null {
    const match = library.characters.find((card) => card.id === character.id) ?? library.characters.find((card) => card.name === character.name)
    return match ? characterRef(match) : null
}

/** The preview for a record in the signed-in user's library, or null when it is not there. */
export function hoverCardFromLibrary(library: KnowledgeLibrary, ref: HoverCardRef, t: TFunction): HoverCardModel | null {
    switch (ref.kind) {
        case 'character':
        case 'persona': {
            const card = library.characters.find((entry) => entry.id === ref.id)
            if (!card) return null
            return {
                ref: characterRef(card),
                title: card.name,
                badge: joined([card.race, card.class, isPersonaCard(card) && card.is_default_persona && t('appAssistant.hoverCard.defaultPersona')]),
                description: clip(card.description, DESCRIPTION_LIMIT),
                ...tagList(card.triggers),
                imageUrl: card.image_url || null,
                version: card.latest_version_number || null,
                updatedAt: card.updatedAt || card.createdAt || null,
                relations: [],
                inLibrary: true,
            }
        }
        case 'world': {
            const card = library.worlds.find((entry) => entry.id === ref.id)
            if (!card) return null
            return {
                ref,
                title: card.name,
                badge: joined([worldPlaceTypeLabel(readWorldPlaceType(card)), card.type]),
                description: clip(card.description, DESCRIPTION_LIMIT),
                ...tagList(card.triggers),
                imageUrl: card.image_url || null,
                version: card.latest_version_number || null,
                updatedAt: card.updatedAt || card.createdAt || null,
                relations: [],
                inLibrary: true,
            }
        }
        case 'item': {
            const card = library.items.find((entry) => entry.id === ref.id)
            if (!card) return null
            return {
                ref,
                title: card.name,
                badge: joined([card.type, card.rarity]),
                description: clip(card.description, DESCRIPTION_LIMIT),
                ...tagList(card.triggers),
                imageUrl: card.image_url || null,
                version: card.latest_version_number || null,
                updatedAt: card.updatedAt || card.createdAt || null,
                relations: [],
                inLibrary: true,
            }
        }
        case 'adventure': {
            const card = library.adventures.find((entry) => entry.id === ref.id)
            if (!card) return null
            const title = adventureName(card)
            const relations: HoverCardRelation[] = []
            if (card.world?.name) relations.push({ role: 'world', name: card.world.name, ref: findWorldRef(library, card.world) })
            for (const member of (card.characters ?? []).slice(0, CAST_LIMIT)) {
                if (member?.name) relations.push({ role: 'cast', name: member.name, ref: findCharacterRef(library, member) })
            }
            return {
                ref,
                title,
                badge: null,
                description: clip(scenarioBody(card.scenario, title), DESCRIPTION_LIMIT),
                ...tagList(card.triggers),
                imageUrl: card.image_url || null,
                version: null,
                updatedAt: card.updatedAt || card.createdAt || null,
                relations,
                inLibrary: true,
            }
        }
        case 'lorebook': {
            const lorebook = library.lorebooks.find((entry) => entry.id === ref.id)
            if (!lorebook) return null
            const entries = lorebook.entries ?? []
            return {
                ref,
                title: lorebook.name,
                badge: t('appAssistant.knowledge.entryCount', { count: entries.length }),
                description: clip(lorebook.description, DESCRIPTION_LIMIT),
                ...tagList(entries.map((entry) => entry.title || entry.keys[0] || '')),
                imageUrl: null,
                version: null,
                updatedAt: lorebook.updatedAt || lorebook.createdAt || null,
                relations: [],
                inLibrary: true,
            }
        }
    }
}

/** The preview for a card fetched by id (it is not in the library, so it cannot join focus). */
export function hoverCardFromPreview(preview: CardPreview, ref: HoverCardRef): HoverCardModel {
    // An adventure preview's title is its whole scenario; keep the first sentence like the library does.
    const title = ref.kind === 'adventure' ? preview.title.split(/[.\n]/)[0] || preview.title : preview.title
    return {
        ref,
        title,
        badge: preview.badge || null,
        description: clip(ref.kind === 'adventure' ? scenarioBody(preview.description, title) : preview.description, DESCRIPTION_LIMIT),
        ...tagList(preview.triggers),
        imageUrl: preview.imageUrl || null,
        version: preview.versionNumber || null,
        updatedAt: preview.updatedAt || preview.createdAt || null,
        relations: [],
        inLibrary: false,
    }
}

// ---------------------------------------------------------------------------
// Nested links
// ---------------------------------------------------------------------------

export interface HoverNameIndex {
    /** Matches any library name as a whole word; null when nothing is long enough. */
    pattern: RegExp | null
    byName: ReadonlyMap<string, readonly HoverCardRef[]>
}

export type HoverTextSegment = string | { text: string; ref: HoverCardRef }

/**
 * Names are matched case-sensitively: they are proper nouns, and a
 * case-insensitive "Dan" would also light up the Spanish verb "dan".
 */
export function buildHoverNameIndex(library: Pick<KnowledgeLibrary, 'characters' | 'worlds' | 'items' | 'lorebooks'>): HoverNameIndex {
    const byName = new Map<string, HoverCardRef[]>()
    const add = (name: string | null | undefined, ref: HoverCardRef) => {
        const key = (name ?? '').trim()
        if (key.length < MIN_NAME_LENGTH) return
        const refs = byName.get(key) ?? []
        if (!refs.some((entry) => entry.id === ref.id)) refs.push(ref)
        byName.set(key, refs)
    }
    for (const card of library.characters) add(card.name, characterRef(card))
    for (const card of library.worlds) add(card.name, { kind: 'world', id: card.id })
    for (const card of library.items) add(card.name, { kind: 'item', id: card.id })
    for (const lorebook of library.lorebooks) add(lorebook.name, { kind: 'lorebook', id: lorebook.id })
    if (!byName.size) return { pattern: null, byName }
    const alternatives = [...byName.keys()]
        .sort((a, b) => b.length - a.length)
        .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    return { pattern: new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}_])`, 'gu'), byName }
}

/**
 * Split `text` into plain runs and links to other library records. A name that
 * several records share is left plain (it would be a guess), and so is the card
 * itself.
 */
export function linkifyHoverText(text: string, index: HoverNameIndex, self: HoverCardRef): HoverTextSegment[] {
    if (!text) return []
    if (!index.pattern) return [text]
    const segments: HoverTextSegment[] = []
    const linked = new Set<string>()
    let cursor = 0
    for (const match of text.matchAll(index.pattern)) {
        if (linked.size >= NESTED_LINK_LIMIT) break
        const refs = (index.byName.get(match[0]) ?? []).filter((ref) => ref.id !== self.id)
        if (refs.length !== 1) continue
        const key = hoverCardKey(refs[0])
        if (linked.has(key)) continue
        linked.add(key)
        const start = match.index ?? 0
        if (start > cursor) segments.push(text.slice(cursor, start))
        segments.push({ text: match[0], ref: refs[0] })
        cursor = start + match[0].length
    }
    if (cursor < text.length) segments.push(text.slice(cursor))
    return segments
}
