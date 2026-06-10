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
    World,
} from '../../../shared'

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

/** Maps a snapshot card to the frontend Character shape (for compatibility/consumers). */
export function snapshotToCharacter(card: SnapshotCard, fallbackId: string): Character {
    return {
        id: card.id || card.uuid || fallbackId,
        name: card.name || '',
        race: card.race || '',
        description: card.description || '',
        stats: {},
        category: card.category,
        triggers: card.triggers ?? [],
        image_url: card.image_url,
        theme_song_url: card.theme_song_url,
    }
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
        template.persona = card
    } else if (ref.kind === 'character') {
        const next = asCards(template.characters).slice()
        next[ref.index] = card
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
        uuid: card.id,
        source_card_id: card.id,
        name: card.name,
        description: card.description ?? '',
        category: card.category,
        triggers: card.triggers ?? [],
        image_url: card.image_url,
        theme_song_url: card.theme_song_url,
    }
    if (kind === 'world') base.type = (card as World).type ?? ''
    else base.race = (card as Character).race ?? ''
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

/** The adventure's snapshot, synthesizing one from its display fields if absent. */
export function ensureAdventureSnapshot(adventure: Adventure): AdventureSnapshot {
    if (adventure.snapshot) return adventure.snapshot
    const worlds = adventure.worlds?.length
        ? adventure.worlds
        : adventure.world
          ? [adventure.world]
          : []
    return synthesizeSnapshotFromTemplate({
        id: adventure.id,
        description: adventure.scenario,
        triggers: adventure.triggers,
        persona: (adventure.persona as never) ?? null,
        characters: (adventure.characters as never) ?? [],
        world: worlds as never,
        category: adventure.category,
        image_url: adventure.image_url,
        theme_song_url: adventure.theme_song_url,
    })
}

/** Coerce a raw session field into a typed snapshot, or null if it isn't one. */
export function asSnapshot(value: unknown): AdventureSnapshot | null {
    if (value && typeof value === 'object' && 'template' in (value as Record<string, unknown>)) {
        const template = (value as AdventureSnapshot).template
        if (template && typeof template === 'object') return value as AdventureSnapshot
    }
    return null
}

/**
 * Build a client-side snapshot from a template's pieces for legacy sessions that
 * predate server-side cloning. First edit persists it, repairing the session.
 */
export function synthesizeSnapshotFromTemplate(input: {
    id?: string
    name?: string
    description?: string
    triggers?: string[]
    persona?: SnapshotCard | null
    characters?: SnapshotCard[]
    world?: SnapshotCard[]
    category?: SnapshotTemplate['category']
    image_url?: string
    theme_song_url?: string
}): AdventureSnapshot {
    return {
        schema_version: 1,
        source: 'client_template_fallback',
        template_card_id: input.id,
        template: {
            id: input.id,
            name: input.name,
            description: input.description,
            triggers: input.triggers ?? [],
            persona: input.persona ?? null,
            characters: input.characters ?? [],
            world: input.world ?? [],
            category: input.category,
            image_url: input.image_url,
            theme_song_url: input.theme_song_url,
        },
    }
}
