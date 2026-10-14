import { describe, expect, it } from 'vitest'
import { readWorldPlaceType, type AdventureSnapshot, type Character, type EffectiveVoice, type SnapshotCard, type World } from '../../../shared'
import {
    addSnapshotCard,
    adventureFieldsFromSnapshot,
    applySnapshotCardEdit,
    applySnapshotScenarioEdit,
    characterEntries,
    findSnapshotEntry,
    libraryCardToSnapshotCard,
    personaEntry,
    asSnapshot,
    removeSnapshotCard,
    setSnapshotNarratorVoice,
    setSnapshotPersona,
    snapshotSourceIds,
    snapshotToCharacter,
    writableAdventureSnapshot,
    worldEntries,
} from './adventureSnapshot'
import { LEGACY_V1_VOICE } from '@/test/fixtures/legacyMinimax'

/** A stored V1 cast voice with an untrimmed id: read and written back whole (03 §5.1.2). */
const UNTRIMMED_V1 = { ...LEGACY_V1_VOICE, voice_id: ` ${LEGACY_V1_VOICE.voice_id} `, vol: 1.7, pitch: -2 }

function makeSnapshot(): AdventureSnapshot {
    return {
        schema_version: 2,
        source: 'resolved_library_clone',
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
                    voice: { ...UNTRIMMED_V1 },
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
        // The whole stored voice, untrimmed (03 §5.1.2).
        expect(fields.characters[0].voice).toEqual(UNTRIMMED_V1)

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
        voice: { ...LEGACY_V1_VOICE },
    }
    const libWorld: World = {
        id: 'world-9',
        name: 'Sunspire',
        type: 'City',
        description: 'A gilded city',
        details: {},
        category: [
            { name: 'Setting', attributes: [{ 'Place type': 'city' }] },
            { name: 'Details', attributes: [{ Ruler: 'Council' }] },
        ],
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
        expect(snapCard.voice).toBe(libChar.voice)

        const w = libraryCardToSnapshotCard(libWorld, 'world')
        expect(w).not.toHaveProperty('place_type')
        expect(w).not.toHaveProperty('uuid')
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
        expect(readWorldPlaceType(fields.worlds[fields.worlds.length - 1])).toBe('city')
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

    it('strips read-only and obsolete fields from strict snapshot updates', () => {
        const original = makeSnapshot()
        original.template.characters![0] = {
            ...original.template.characters![0],
            newer_version_available: true,
            uuid: 'legacy-c1',
        }
        original.template.world![0] = {
            ...original.template.world![0],
            newer_version_available: true,
            place_type: 'city',
        } as SnapshotCard & { place_type: string }

        const writable = writableAdventureSnapshot(original)

        expect(writable.template.characters![0]).not.toHaveProperty('newer_version_available')
        expect(writable.template.characters![0]).not.toHaveProperty('uuid')
        expect(writable.template.world![0]).not.toHaveProperty('newer_version_available')
        expect(writable.template.world![0]).not.toHaveProperty('place_type')
    })
})

describe('adventureSnapshot stored voices (D11, D32)', () => {
    const V2 = {
        schema_version: 2 as const,
        provider: 'elevenlabs' as const,
        voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
        voice_name: 'Eldrin',
        settings: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
        emotion: 'calm' as const,
        language_code: 'es',
    }
    const EFFECTIVE: EffectiveVoice = {
        voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
        display_name: 'Eldrin',
        provider_route: 'elevenlabs',
        substitution_reason: null,
        flags: [],
        badges: [],
    }

    /** A read DTO as the BFF sends it: V1 cast, V2 persona and narrator, with projections (R1+). */
    function storedSnapshot(): AdventureSnapshot {
        const snapshot = makeSnapshot()
        snapshot.template.persona = { ...snapshot.template.persona!, voice: { ...V2 }, effective_voice: EFFECTIVE }
        snapshot.template.characters!.push({ id: 'c2', name: 'Mira', race: 'Human', voice: { voice_id: 'English_radiant_girl', pitch: 3 }, effective_voice: EFFECTIVE })
        return { ...snapshot, narrator_voice: { ...V2, voice_name: 'Narrator' }, narrate_thoughts: true, effective_narrator_voice: EFFECTIVE } as AdventureSnapshot
    }

    it('reads V1 and V2 voices whole, as the same objects', () => {
        const snapshot = storedSnapshot()
        const fields = adventureFieldsFromSnapshot(snapshot)
        expect(fields.persona?.voice).toBe(snapshot.template.persona!.voice)
        expect(fields.characters[0].voice).toBe(snapshot.template.characters![0].voice)
        expect(fields.characters[1].voice).toBe(snapshot.template.characters![1].voice)
    })

    it('a snapshot PUT keeps untouched V1 cast entries byte-identical and V2 voices whole', () => {
        const snapshot = storedSnapshot()
        const storedCast = JSON.stringify(snapshot.template.characters!.map((card) => card.voice))
        const storedPersona = JSON.stringify(snapshot.template.persona!.voice)
        const storedNarrator = JSON.stringify(snapshot.narrator_voice)

        // Edit another card's text (not a voice), then build the strict PUT body.
        const edited = applySnapshotCardEdit(snapshot, { kind: 'persona' }, { ...snapshot.template.persona!, description: 'Changed.' })
        const writable = writableAdventureSnapshot(edited)

        expect(JSON.stringify(writable.template.characters!.map((card) => card.voice))).toBe(storedCast)
        expect(JSON.stringify(writable.template.persona!.voice)).toBe(storedPersona)
        expect(JSON.stringify(writable.narrator_voice)).toBe(storedNarrator)
        expect(writable.template.persona!.description).toBe('Changed.')
        expect(writable.narrate_thoughts).toBe(true)
    })

    it('keeps an unrecognised non-null cast voice on read and through a library clone (09 §3.2)', () => {
        const odd = { voice_id: '' }
        const snapshot = makeSnapshot()
        snapshot.template.characters!.push({ id: 'c3', name: 'Odd', race: 'Human', voice: odd })
        expect(adventureFieldsFromSnapshot(snapshot).characters[1].voice).toBe(odd)

        const lib: Character = { id: 'char-8', name: 'Odd', race: 'Elf', description: '', stats: {}, voice: odd }
        expect(libraryCardToSnapshotCard(lib, 'character').voice).toBe(odd)
    })

    it('strips the read-only voice projections before the PUT (D35)', () => {
        const writable = writableAdventureSnapshot(storedSnapshot())
        expect(JSON.stringify(writable)).not.toContain('effective_')
    })

    it('a V2 voice survives clone into the snapshot and back out', () => {
        const lib: Character = { id: 'char-7', name: 'Sage', race: 'Elf', description: '', stats: {}, voice: { ...V2 } }
        const card = libraryCardToSnapshotCard(lib, 'character')
        expect(card.voice).toBe(lib.voice)
        const added = addSnapshotCard(makeSnapshot(), 'character', card)
        const writable = writableAdventureSnapshot(added)
        expect(JSON.stringify(writable.template.characters![1].voice)).toBe(JSON.stringify(V2))
    })
})

describe('adventureSnapshot effective voice projections (R1-FE-03, D35)', () => {
    const V2 = {
        schema_version: 2 as const,
        provider: 'elevenlabs' as const,
        voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
        voice_name: 'Eldrin',
        settings: null,
        emotion: null,
        language_code: null,
    }
    const EFFECTIVE: EffectiveVoice = {
        voice_key: 'vk_0a1b2c3d4e5f60718293a4b5c6d7e8f9',
        display_name: 'Maren',
        provider_route: 'elevenlabs',
        substitution_reason: 'voice_removed',
        flags: [],
        badges: ['replaced'],
    }

    function withProjections(): AdventureSnapshot {
        const snapshot = makeSnapshot()
        snapshot.template.characters = [{ ...snapshot.template.characters![0], voice: { ...V2 }, effective_voice: EFFECTIVE }]
        snapshot.template.persona = { ...snapshot.template.persona!, voice: { ...V2 }, effective_voice: EFFECTIVE }
        return { ...snapshot, narrator_voice: { ...V2 }, effective_narrator_voice: EFFECTIVE }
    }

    it('snapshotToCharacter keeps the cast projection', () => {
        const card = withProjections().template.characters![0]
        expect(snapshotToCharacter(card, 'k').effective_voice).toEqual(EFFECTIVE)
        expect(snapshotToCharacter(makeSnapshot().template.characters![0], 'k')).not.toHaveProperty('effective_voice')
    })

    it('a library clone never carries the library card’s projection', () => {
        const lib: Character = { id: 'char-1', name: 'Mira', race: 'Elf', description: '', stats: {}, voice: { ...V2 }, effective_voice: EFFECTIVE }
        expect(libraryCardToSnapshotCard(lib, 'character')).not.toHaveProperty('effective_voice')
    })

    it('an edit drops the projection only when the voice changed', () => {
        const snapshot = withProjections()
        const cast = snapshot.template.characters![0]
        const textOnly = applySnapshotCardEdit(snapshot, { kind: 'character', index: 0 }, { ...cast, description: 'Changed.' })
        expect(textOnly.template.characters![0].effective_voice).toEqual(EFFECTIVE)

        const revoiced = applySnapshotCardEdit(snapshot, { kind: 'character', index: 0 }, { ...cast, voice: { ...V2, settings: { stability: 0.2 } } })
        expect(revoiced.template.characters![0]).not.toHaveProperty('effective_voice')

        const persona = applySnapshotCardEdit(snapshot, { kind: 'persona' }, { ...snapshot.template.persona!, voice: null })
        expect(persona.template.persona).not.toHaveProperty('effective_voice')
        // Pure: the source snapshot keeps its projections.
        expect(snapshot.template.characters![0].effective_voice).toEqual(EFFECTIVE)
    })

    it('a narrator re-pick drops the narrator projection', () => {
        const snapshot = withProjections()
        const next = setSnapshotNarratorVoice(snapshot, null)
        expect(next.narrator_voice).toBeNull()
        expect(next).not.toHaveProperty('effective_narrator_voice')
        expect(snapshot.effective_narrator_voice).toEqual(EFFECTIVE)
    })

    it('asSnapshot keeps a valid narrator projection read-only and drops a malformed one', () => {
        const parsed = asSnapshot(withProjections())
        expect(parsed?.effective_narrator_voice).toEqual(EFFECTIVE)
        const malformed = asSnapshot({ ...withProjections(), effective_narrator_voice: { provider_route: 'acme' } })
        expect(malformed).not.toHaveProperty('effective_narrator_voice')
        const plain = makeSnapshot()
        expect(asSnapshot(plain)).toBe(plain)
        expect(JSON.stringify(writableAdventureSnapshot(withProjections()))).not.toContain('effective_')
    })
})
