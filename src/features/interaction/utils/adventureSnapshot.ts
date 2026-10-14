/**
 * Helpers for the adventure's cloned-card snapshot.
 *
 * When an adventure is started the backend stores a `template_snapshot` — a clone
 * of the originating template's persona / cast / world / scenario. The chat AI reads
 * its context from this snapshot, and the side panel both displays and edits it.
 * Edits here never touch the original library or template cards.
 */

import type {
    Adventure,
    AdventureSnapshot,
    Character,
    SnapshotCard,
    SnapshotTemplate,
    StoredCharacterVoice,
    World,
} from '../../../shared'
import { keepStoredVoice, readEffectiveVoice, stripVoiceProjections } from '../../../shared/voice'

/** Locates a card inside the snapshot so edits can be written back to it. */
export type SnapshotCardRef =
    | { kind: 'persona' }
    | { kind: 'character'; index: number }
    | { kind: 'world'; index: number }

/** A card surfaced for display/editing, paired with where it lives in the snapshot. */
export interface SnapshotCardEntry {
    ref: SnapshotCardRef
    /** Stable key for React lists. */
    key: string
    card: SnapshotCard
}

const asCards = (value: SnapshotCard[] | null | undefined): SnapshotCard[] =>
    Array.isArray(value) ? value.filter((c): c is SnapshotCard => !!c && typeof c === 'object') : []

/** The adventure scenario is the snapshot template's description. */
export function snapshotScenario(snapshot?: AdventureSnapshot | null): string {
    return (snapshot?.template?.description ?? '').trim()
}

/** Persona card (the player's protagonist), if present. */
export function personaEntry(snapshot?: AdventureSnapshot | null): SnapshotCardEntry | null {
    const persona = snapshot?.template?.persona
    if (!persona || typeof persona !== 'object') return null
    return { ref: { kind: 'persona' }, key: 'persona', card: persona }
}

const cardKey = (card: SnapshotCard, prefix: string, index: number): string =>
    card.source_card_id || card.id || card.uuid || `${prefix}-${index}`

/** Supporting cast cards. */
export function characterEntries(snapshot?: AdventureSnapshot | null): SnapshotCardEntry[] {
    return asCards(snapshot?.template?.characters).map((card, index) => ({
        ref: { kind: 'character', index },
        key: cardKey(card, 'character', index),
        card,
    }))
}

/** World cards (a snapshot can carry more than one). */
export function worldEntries(snapshot?: AdventureSnapshot | null): SnapshotCardEntry[] {
    return asCards(snapshot?.template?.world).map((card, index) => ({
        ref: { kind: 'world', index },
        key: cardKey(card, 'world', index),
        card,
    }))
}

/** Locate the entry (card + ref) for a given ref against the current snapshot. */
export function findSnapshotEntry(
    snapshot: AdventureSnapshot | null | undefined,
    ref: SnapshotCardRef,
): SnapshotCardEntry | null {
    if (!snapshot) return null
    if (ref.kind === 'persona') return personaEntry(snapshot)
    if (ref.kind === 'character') return characterEntries(snapshot)[ref.index] ?? null
    return worldEntries(snapshot)[ref.index] ?? null
}

/**
 * Keep the WHOLE stored voice, V1 or V2 (03 §5.1.2): the same object, never a
 * whitelist or a trim, so snapshot PUTs re-send untouched voices byte-identical (D32).
 * An unrecognised non-null voice is kept as well (09 §3.2), so editing another
 * field of a cast entry never drops it.
 */
function snapshotVoice(value: unknown): StoredCharacterVoice | undefined {
    return keepStoredVoice(value)
}

/** Maps a snapshot card to the frontend Character shape (for compatibility/consumers). */
export function snapshotToCharacter(card: SnapshotCard, fallbackId: string): Character {
    return {
        id: card.id || card.uuid || fallbackId,
        name: card.name || '',
        role: card.role === 'persona' ? 'persona' : 'character',
        is_default_persona: Boolean(card.is_default_persona),
        race: card.race || '',
        description: card.description || '',
        stats: {},
        category: card.category,
        triggers: card.triggers ?? [],
        image_url: card.image_url,
        theme_song_url: card.theme_song_url,
        voice: snapshotVoice(card.voice),
        // The cast entry's read-only projection (D35), only when the server sent one.
        ...effectiveVoiceOf(card),
    }
}

function effectiveVoiceOf(card: SnapshotCard): { effective_voice?: Character['effective_voice'] } {
    const effective = readEffectiveVoice(card.effective_voice)
    return effective ? { effective_voice: effective } : {}
}

/**
 * A card whose stored voice changed drops its projection: it described the old
 * voice (D35). Untouched voices keep theirs. Pure.
 */
function withoutStaleProjection(previous: SnapshotCard | null | undefined, card: SnapshotCard): SnapshotCard {
    if (!card || !('effective_voice' in card)) return card
    const before = previous?.voice ?? null
    const after = card.voice ?? null
    if (before === after || JSON.stringify(before) === JSON.stringify(after)) return card
    const next = { ...card }
    delete next.effective_voice
    return next
}

/** Maps a snapshot card to the frontend World shape (for compatibility/consumers). */
export function snapshotToWorld(card: SnapshotCard, fallbackId: string): World {
    return {
        id: card.id || card.uuid || fallbackId,
        name: card.name || '',
        type: card.type || '',
        description: card.description || '',
        details: {},
        category: card.category,
        triggers: card.triggers ?? [],
        image_url: card.image_url,
        theme_song_url: card.theme_song_url,
    }
}

/** Derives the display fields the Adventure carries from a snapshot. */
export function adventureFieldsFromSnapshot(snapshot?: AdventureSnapshot | null): {
    scenario?: string
    persona?: Character
    characters: Character[]
    world?: World
    worlds: World[]
} {
    const persona = personaEntry(snapshot)
    const characters = characterEntries(snapshot).map((e) => snapshotToCharacter(e.card, e.key))
    const worlds = worldEntries(snapshot).map((e) => snapshotToWorld(e.card, e.key))
    const scenario = snapshotScenario(snapshot)
    return {
        scenario: scenario || undefined,
        persona: persona ? snapshotToCharacter(persona.card, persona.key) : undefined,
        characters,
        world: worlds[0],
        worlds,
    }
}

/** Returns a new snapshot with one card replaced at the given ref. Pure (no mutation). */
export function applySnapshotCardEdit(
    snapshot: AdventureSnapshot,
    ref: SnapshotCardRef,
    card: SnapshotCard,
): AdventureSnapshot {
    const template: SnapshotTemplate = { ...snapshot.template }
    if (ref.kind === 'persona') {
        template.persona = withoutStaleProjection(template.persona, card)
    } else if (ref.kind === 'character') {
        const next = asCards(template.characters).slice()
        next[ref.index] = withoutStaleProjection(next[ref.index], card)
        template.characters = next
    } else {
        const next = asCards(template.world).slice()
        next[ref.index] = card
        template.world = next
    }
    return { ...snapshot, template }
}

/** Returns a new snapshot with the scenario (template description) replaced. */
export function applySnapshotScenarioEdit(snapshot: AdventureSnapshot, scenario: string): AdventureSnapshot {
    return { ...snapshot, template: { ...snapshot.template, description: scenario } }
}

/**
 * Clone a full library Character/World into a snapshot card — the same shape the
 * backend produces when cloning the original at adventure start. Carries the library
 * id as `source_card_id` so the clone stays traceable to (but independent of) the original.
 */
export function libraryCardToSnapshotCard(card: Character | World, kind: 'character' | 'world'): SnapshotCard {
    const base: SnapshotCard = {
        id: card.id,
        source_card_id: card.id,
        name: card.name,
        role: kind === 'character' ? ((card as Character).role === 'persona' ? 'persona' : 'character') : undefined,
        is_default_persona: kind === 'character' ? Boolean((card as Character).is_default_persona) : undefined,
        description: card.description ?? '',
        category: card.category,
        triggers: card.triggers ?? [],
        image_url: card.image_url,
        theme_song_url: card.theme_song_url,
    }
    if (kind === 'world') {
        base.type = (card as World).type ?? ''
    } else {
        const character = card as Character
        base.race = character.race ?? ''
        base.default_persona_id = character.default_persona_id ?? null
        base.greeting = character.greeting?.trim() || null
        base.system_instructions = character.system_instructions?.trim() || null
        base.voice = snapshotVoice(character.voice)
    }
    return base
}

/** Returns a new snapshot with a card appended to the cast / world list. Pure. */
export function addSnapshotCard(
    snapshot: AdventureSnapshot,
    kind: 'character' | 'world',
    card: SnapshotCard,
): AdventureSnapshot {
    const template: SnapshotTemplate = { ...snapshot.template }
    if (kind === 'world') template.world = [...asCards(template.world), card]
    else template.characters = [...asCards(template.characters), card]
    return { ...snapshot, template }
}

/** Returns a new snapshot with the card at `ref` removed (persona → cleared). Pure. */
export function removeSnapshotCard(snapshot: AdventureSnapshot, ref: SnapshotCardRef): AdventureSnapshot {
    const template: SnapshotTemplate = { ...snapshot.template }
    if (ref.kind === 'persona') template.persona = null
    else if (ref.kind === 'character') template.characters = asCards(template.characters).filter((_, i) => i !== ref.index)
    else template.world = asCards(template.world).filter((_, i) => i !== ref.index)
    return { ...snapshot, template }
}

/**
 * Returns a new snapshot with the narrator voice set or cleared. The read-only
 * `effective_narrator_voice` described the previous voice, so it is dropped
 * (the server sends a fresh one on the next read). Pure.
 */
export function setSnapshotNarratorVoice(snapshot: AdventureSnapshot, voice: StoredCharacterVoice | null): AdventureSnapshot {
    const next: AdventureSnapshot = { ...snapshot, narrator_voice: voice }
    delete next.effective_narrator_voice
    return next
}

/** Returns a new snapshot with the persona set or cleared. Pure. */
export function setSnapshotPersona(snapshot: AdventureSnapshot, card: SnapshotCard | null): AdventureSnapshot {
    return { ...snapshot, template: { ...snapshot.template, persona: card } }
}

/** Library ids already present in the snapshot — to filter the "add card" picker. */
export function snapshotSourceIds(snapshot: AdventureSnapshot | null | undefined): Set<string> {
    const ids = new Set<string>()
    if (!snapshot) return ids
    const collect = (card?: SnapshotCard | null) => {
        const id = card?.source_card_id || card?.id || card?.uuid
        if (id) ids.add(id)
    }
    collect(snapshot.template.persona)
    asCards(snapshot.template.characters).forEach(collect)
    asCards(snapshot.template.world).forEach(collect)
    return ids
}

/** The stored session contract always carries its cloned-card snapshot. */
export function ensureAdventureSnapshot(adventure: Adventure): AdventureSnapshot {
    if (!adventure.snapshot) throw new Error('Adventure session is missing its stored template snapshot')
    return adventure.snapshot
}

/**
 * Coerce a raw session field into a typed snapshot, or null if it isn't one. The
 * read-only `effective_narrator_voice` (D35, I-5) is kept, parsed; a malformed
 * one is dropped. A snapshot without it is returned as is.
 */
export function asSnapshot(value: unknown): AdventureSnapshot | null {
    if (value && typeof value === 'object' && 'template' in (value as Record<string, unknown>)) {
        const snapshot = value as AdventureSnapshot
        const template = snapshot.template
        if (!template || typeof template !== 'object') return null
        if (!('effective_narrator_voice' in snapshot)) return snapshot
        const { effective_narrator_voice: raw, ...rest } = snapshot
        const effective = readEffectiveVoice(raw)
        return effective ? { ...rest, effective_narrator_voice: effective } : rest
    }
    return null
}

function writableSnapshotCard(card: SnapshotCard, kind: 'character' | 'world'): SnapshotCard {
    const common: SnapshotCard = {
        id: card.id,
        source_card_id: card.source_card_id,
        source_card_version_id: card.source_card_version_id,
        source_card_version_number: card.source_card_version_number,
        name: card.name,
        alias: typeof card.alias === 'string' ? card.alias : null,
        description: card.description,
        category: card.category,
        triggers: card.triggers,
        image_url: card.image_url,
        theme_song_url: card.theme_song_url,
    }
    if (kind === 'world') return { ...common, type: card.type }
    return {
        ...common,
        role: card.role,
        is_default_persona: card.is_default_persona,
        default_persona_id: card.default_persona_id,
        race: card.race,
        greeting: card.greeting,
        system_instructions: card.system_instructions,
        voice: card.voice,
    }
}

/**
 * Strip read-only annotations (incl. the D35 voice projections) and obsolete card fields
 * before a strict snapshot PUT. Stored voices (cast, persona, narrator) pass through untouched.
 */
export function writableAdventureSnapshot(snapshot: AdventureSnapshot): AdventureSnapshot {
    const template = snapshot.template
    return stripVoiceProjections({
        ...snapshot,
        template: {
            id: template.id,
            name: template.name,
            alias: typeof template.alias === 'string' ? template.alias : null,
            description: template.description,
            triggers: template.triggers,
            persona: template.persona ? writableSnapshotCard(template.persona, 'character') : null,
            characters: asCards(template.characters).map((card) => writableSnapshotCard(card, 'character')),
            world: asCards(template.world).map((card) => writableSnapshotCard(card, 'world')),
            category: template.category,
            image_url: template.image_url,
            theme_song_url: template.theme_song_url,
        },
    })
}
