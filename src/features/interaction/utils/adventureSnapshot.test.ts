import { describe, expect, it } from 'vitest'
import type { AdventureSnapshot, Character, World } from '../../../shared'
import {
    addSnapshotCard,
    adventureFieldsFromSnapshot,
    applySnapshotCardEdit,
    applySnapshotScenarioEdit,
    characterEntries,
    findSnapshotEntry,
    libraryCardToSnapshotCard,
    personaEntry,
    removeSnapshotCard,
    setSnapshotPersona,
    snapshotSourceIds,
    worldEntries,
} from './adventureSnapshot'

function makeSnapshot(): AdventureSnapshot {
    return {
        schema_version: 1,
        source: 'mysql_card_body',
        template_card_id: 'tpl-1',
        template: {
            id: 'tpl-1',
            name: 'Quest',
            description: 'A dark forest awaits.',
            triggers: ['forest'],
            persona: {
                id: 'p1',
                name: 'Aria',
                race: 'Elf',
                description: 'A wandering ranger.',
                category: [{ name: 'Stats', attributes: [{ Strength: '14' }, { Dexterity: '18' }] }],
                triggers: ['aria'],
            },
            characters: [
                {
                    id: 'c1',
                    name: 'Dorn',
                    race: 'Dwarf',
                    description: 'A gruff smith.',
                    category: [{ name: 'Stats', attributes: [{ Strength: '16' }] }],
                },
            ],
            world: [
                {
                    id: 'w1',
                    name: 'Eldoria',
                    type: 'Kingdom',
                    description: 'A vast realm.',
                    category: [{ name: 'Details', attributes: [{ Climate: 'Cold' }] }],
                },
            ],
        },
    }
}

describe('adventureSnapshot', () => {
    it('maps snapshot cards into populated display fields (the empty-card bug fix)', () => {
        const fields = adventureFieldsFromSnapshot(makeSnapshot())

        expect(fields.scenario).toBe('A dark forest awaits.')
        // Persona carries name, race and — crucially — the category groups that the
        // old panel never rendered.
        expect(fields.persona?.name).toBe('Aria')
        expect(fields.persona?.race).toBe('Elf')
        expect(fields.persona?.category).toHaveLength(1)

        expect(fields.characters).toHaveLength(1)
        expect(fields.characters[0].name).toBe('Dorn')
        expect(fields.characters[0].category?.[0].attributes?.[0]).toEqual({ Strength: '16' })

        expect(fields.world?.name).toBe('Eldoria')
        expect(fields.world?.type).toBe('Kingdom')
        expect(fields.worlds).toHaveLength(1)
    })

    it('locates entries by ref', () => {
        const snap = makeSnapshot()
        expect(personaEntry(snap)?.card.name).toBe('Aria')
        expect(characterEntries(snap)[0].card.name).toBe('Dorn')
        expect(worldEntries(snap)[0].card.name).toBe('Eldoria')

        expect(findSnapshotEntry(snap, { kind: 'persona' })?.card.name).toBe('Aria')
        expect(findSnapshotEntry(snap, { kind: 'character', index: 0 })?.card.name).toBe('Dorn')
        expect(findSnapshotEntry(snap, { kind: 'world', index: 0 })?.card.name).toBe('Eldoria')
    })

    it('edits a card without mutating the original snapshot (edit only the adventure copy)', () => {
        const original = makeSnapshot()
        const edited = applySnapshotCardEdit(
            original,
            { kind: 'character', index: 0 },
            { ...original.template.characters![0], name: 'Dorn the Bold', race: 'Mountain Dwarf' },
        )

        // New snapshot reflects the edit…
        expect(edited.template.characters?.[0].name).toBe('Dorn the Bold')
        expect(edited.template.characters?.[0].race).toBe('Mountain Dwarf')
        // …the original is untouched (immutability → original library/template safe).
        expect(original.template.characters?.[0].name).toBe('Dorn')
        expect(edited).not.toBe(original)
        expect(edited.template).not.toBe(original.template)
        // Envelope metadata preserved.
        expect(edited.template_card_id).toBe('tpl-1')
    })

    it('edits the scenario immutably', () => {
        const original = makeSnapshot()
        const edited = applySnapshotScenarioEdit(original, 'A new dawn breaks.')
        expect(edited.template.description).toBe('A new dawn breaks.')
        expect(original.template.description).toBe('A dark forest awaits.')
    })
})

describe('adventureSnapshot add / remove (per-adventure copy)', () => {
    const libChar: Character = {
        id: 'char-9',
        name: 'Lyra',
        race: 'Half-elf',
        description: 'A bard',
        stats: {},
        category: [{ name: 'Stats', attributes: [{ CHA: '17' }] }],
        triggers: ['lyra'],
        image_url: '/generated-images/lyra.jpeg',
        theme_song_url: '/generated-audio/lyra.mp3',
    }
    const libWorld: World = {
        id: 'world-9',
        name: 'Sunspire',
        type: 'City',
        description: 'A gilded city',
        details: {},
        category: [{ name: 'Details', attributes: [{ Ruler: 'Council' }] }],
        triggers: ['sunspire'],
        image_url: '/generated-images/sunspire.jpeg',
        theme_song_url: '/generated-audio/sunspire.mp3',
    }

    it('clones a full library card into a snapshot card with source_card_id', () => {
        const snapCard = libraryCardToSnapshotCard(libChar, 'character')
        expect(snapCard.source_card_id).toBe('char-9')
        expect(snapCard.id).toBe('char-9')
        expect(snapCard.name).toBe('Lyra')
        expect(snapCard.race).toBe('Half-elf')
        expect(snapCard.category?.[0].attributes?.[0]).toEqual({ CHA: '17' })

        const w = libraryCardToSnapshotCard(libWorld, 'world')
        expect(w.type).toBe('City')
        expect(w.source_card_id).toBe('world-9')
    })

    it('carries media (image/theme) through the snapshot mappers', () => {
        // Adding a library card mid-adventure must keep its portrait + theme so the
        // snapshot (and the drawer/side-panel that read card.image_url) stay populated.
        const snapCard = libraryCardToSnapshotCard(libChar, 'character')
        expect(snapCard.image_url).toBe('/generated-images/lyra.jpeg')
        expect(snapCard.theme_song_url).toBe('/generated-audio/lyra.mp3')

        const w = libraryCardToSnapshotCard(libWorld, 'world')
        expect(w.image_url).toBe('/generated-images/sunspire.jpeg')
        expect(w.theme_song_url).toBe('/generated-audio/sunspire.mp3')

        // …and back out through the display mappers (adventureFieldsFromSnapshot).
        const added = addSnapshotCard(
            setSnapshotPersona(makeSnapshot(), libraryCardToSnapshotCard(libChar, 'character')),
            'world',
            libraryCardToSnapshotCard(libWorld, 'world'),
        )
        const fields = adventureFieldsFromSnapshot(added)
        expect(fields.persona?.image_url).toBe('/generated-images/lyra.jpeg')
        expect(fields.persona?.theme_song_url).toBe('/generated-audio/lyra.mp3')
        expect(fields.worlds[fields.worlds.length - 1]?.image_url).toBe('/generated-images/sunspire.jpeg')
    })

    it('adds a card immutably and exposes its source id', () => {
        const original = makeSnapshot()
        const added = addSnapshotCard(original, 'character', libraryCardToSnapshotCard(libChar, 'character'))
        expect(characterEntries(added).map((e) => e.card.name)).toEqual(['Dorn', 'Lyra'])
        expect(characterEntries(original)).toHaveLength(1) // original untouched
        expect(snapshotSourceIds(added).has('char-9')).toBe(true)
    })

    it('removes a card by ref immutably', () => {
        const original = makeSnapshot()
        const removed = removeSnapshotCard(original, { kind: 'character', index: 0 })
        expect(characterEntries(removed)).toHaveLength(0)
        expect(characterEntries(original)).toHaveLength(1)

        const noPersona = removeSnapshotCard(original, { kind: 'persona' })
        expect(personaEntry(noPersona)).toBeNull()
        expect(personaEntry(original)?.card.name).toBe('Aria')
    })

    it('sets and clears the persona immutably', () => {
        const original = makeSnapshot()
        const swapped = setSnapshotPersona(original, libraryCardToSnapshotCard(libChar, 'character'))
        expect(personaEntry(swapped)?.card.name).toBe('Lyra')
        expect(personaEntry(original)?.card.name).toBe('Aria')

        const cleared = setSnapshotPersona(original, null)
        expect(personaEntry(cleared)).toBeNull()
    })
})
