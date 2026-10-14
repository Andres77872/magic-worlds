import { describe, expect, it } from 'vitest'
import { readWorldPlaceType } from '../shared'
import { asArray, transformCharacters, transformItems, transformTemplates, transformWorlds } from './cardTransforms'

describe('cardTransforms', () => {
    it('asArray guards non-array inputs (terminal auth expiry degrades GETs to {})', () => {
        expect(asArray({})).toEqual([])
        expect(asArray(undefined)).toEqual([])
        expect(asArray(null)).toEqual([])
        expect(asArray([1])).toEqual([1])
    })

    it('transforms tolerate non-array input without throwing', () => {
        expect(transformCharacters({})).toEqual([])
        expect(transformWorlds(undefined)).toEqual([])
        expect(transformItems(undefined)).toEqual([])
        expect(transformTemplates(null)).toEqual([])
    })

    it('maps raw character rows, defaulting race and triggers', () => {
        const [char] = transformCharacters([{ uuid: 'c1', name: 'Lyra' }])
        expect(char.id).toBe('c1')
        expect(char.race).toBe('')
        expect(char.triggers).toEqual([])
        expect(char.stats).toEqual({})
        expect(char.role).toBe('character')
        expect(char.is_default_persona).toBe(false)
        expect(char.default_persona_id).toBeNull()
    })

    it('preserves persona role and default persona metadata', () => {
        const [char] = transformCharacters([
            { id: 'p1', name: 'Aria', role: 'persona', is_default_persona: true, default_persona_id: 'p2', has_draft: true },
        ])
        expect(char.role).toBe('persona')
        expect(char.is_default_persona).toBe(true)
        expect(char.default_persona_id).toBeNull()
        expect(char.has_draft).toBe(true)
    })

    it('preserves the default persona id on AI character cards', () => {
        const [char] = transformCharacters([{ id: 'c1', name: 'Lyra', role: 'character', default_persona_id: 'p2' }])
        expect(char.default_persona_id).toBe('p2')
    })

    it('keeps the whole stored voice byte-identical (no whitelist, no trim)', () => {
        const stored = {
            schema_version: 2,
            provider: 'elevenlabs',
            voice_key: 'vk_1111aaaa2222bbbb3333cccc4444dddd',
            voice_name: ' Warm narrator ',
            settings: { stability: 0.35, similarity_boost: 0.8, speed: 1.1 },
            emotion: 'calm',
            language_code: 'en',
            preset_id: 'preset-1',
            preset_name: 'Warm narrator',
        }
        const raw = { ...stored }
        const [withVoice, noVoice] = transformCharacters([
            { id: 'c1', name: 'Mira', voice: raw },
            { id: 'c3', name: 'None', voice: null },
        ])

        expect(withVoice.voice).toBe(raw)
        expect(JSON.stringify(withVoice.voice)).toBe(JSON.stringify(stored))
        expect(noVoice.voice).toBeUndefined()
    })

    it('keeps an unrecognised non-null voice so a save re-sends it instead of null (09 §3.2, D32)', () => {
        const blankKey = { schema_version: 2, provider: 'elevenlabs', voice_key: '', voice_name: 'Eldrin' }
        const keyless = { schema_version: 2, provider: 'elevenlabs', voice_name: 'Eldrin' }
        const [blank, v2NoKey, notAnObject] = transformCharacters([
            { id: 'c1', name: 'Blank', voice: blankKey },
            { id: 'c2', name: 'Keyless', voice: keyless },
            { id: 'c3', name: 'String', voice: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f' },
        ])

        expect(blank.voice).toBe(blankKey)
        expect(v2NoKey.voice).toBe(keyless)
        // The creator's write body (`voice: voice ?? null`) re-sends it untouched.
        expect(JSON.stringify({ voice: v2NoKey.voice ?? null })).toBe(JSON.stringify({ voice: keyless }))
        // Not an object: nothing a write could round-trip.
        expect(notAnObject.voice).toBeUndefined()
    })

    it('a V2 voice survives read → edit another field → write (03 §5.1.2)', () => {
        const v2 = {
            schema_version: 2,
            provider: 'elevenlabs',
            voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
            voice_name: 'Eldrin',
            settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1 },
            emotion: 'calm',
            language_code: 'es',
            preset_id: null,
            preset_name: null,
        }
        const stored = JSON.stringify(v2)
        const [char] = transformCharacters([{ id: 'c1', name: 'Mira', race: 'Elf', voice: JSON.parse(stored) }])

        // Edit an unrelated field and build the write body the creator sends (`voice: voice ?? null`).
        const edited = { ...char, name: 'Mira the Bold' }
        const body = { name: edited.name, race: edited.race, voice: edited.voice ?? null }

        expect(JSON.stringify(body.voice)).toBe(stored)
    })

    it('maps world place type independently from genre type', () => {
        const [world, fallback] = transformWorlds([
            { id: 'w1', name: 'Sunspire', category: [{ name: 'Setting', attributes: [{ 'Place type': 'city' }] }], type: 'fantasy' },
            { id: 'w2', name: 'Old Marches', type: 'low magic' },
        ])
        expect(readWorldPlaceType(world)).toBe('city')
        expect(world.type).toBe('fantasy')
        expect(readWorldPlaceType(fallback)).toBe('world')
    })

    it('maps template scenario from description, falling back to name', () => {
        const [withDescription, nameOnly] = transformTemplates([
            { id: 't1', name: 'Ring Quest', description: 'Destroy the ring' },
            { id: 't2', name: 'Ring Quest' },
        ])
        expect(withDescription.scenario).toBe('Destroy the ring')
        expect(nameOnly.scenario).toBe('Ring Quest')
    })

    it('lifts the first world of a template into `world`', () => {
        const [template] = transformTemplates([
            { id: 't1', name: 'Quest', world: [{ id: 'w1', name: 'Mordor' }] },
        ])
        expect(template.world).toEqual({ id: 'w1', name: 'Mordor' })
    })

    it('maps item-specific fields from raw rows', () => {
        const [item] = transformItems([
            {
                uuid: 'i1',
                name: 'Moonlit Compass',
                type: 'relic',
                rarity: 'rare',
                description: 'Finds safe roads.',
                effects: ['Reveals hidden paths'],
                requirements: ['Moonlight'],
                limitations: ['Fails underground'],
                triggers: ['compass'],
            },
        ])
        expect(item.id).toBe('i1')
        expect(item.type).toBe('relic')
        expect(item.rarity).toBe('rare')
        expect(item.effects).toEqual(['Reveals hidden paths'])
        expect(item.requirements).toEqual(['Moonlight'])
        expect(item.limitations).toEqual(['Fails underground'])
        expect(item.triggers).toEqual(['compass'])
    })
})

describe('cardTransforms effective voice pass-through (R1-FE-03, D35)', () => {
    const EFFECTIVE = {
        voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
        display_name: 'Eldrin',
        provider_route: 'elevenlabs',
        substitution_reason: null,
        badges: ['leaving', 'unknown_badge'],
    }

    it('keeps a valid projection next to the stored voice, read-only', () => {
        const voice = { schema_version: 2, provider: 'elevenlabs', voice_key: 'vk_0a1b2c3d4e5f60718293a4b5c6d7e8f9', voice_name: 'Maren' }
        const [card] = transformCharacters([{ uuid: 'c1', name: 'Mira', voice, effective_voice: EFFECTIVE }])
        expect(card.voice).toBe(voice)
        expect(card.effective_voice).toEqual({ ...EFFECTIVE, badges: ['leaving'] })
    })

    it('adds no key when the projection is absent or malformed', () => {
        const [plain] = transformCharacters([{ uuid: 'c2', name: 'Dorn' }])
        expect(plain).not.toHaveProperty('effective_voice')
        const [odd] = transformCharacters([{ uuid: 'c3', name: 'Odd', effective_voice: { provider_route: 'acme' } }])
        expect(odd).not.toHaveProperty('effective_voice')
    })
})
