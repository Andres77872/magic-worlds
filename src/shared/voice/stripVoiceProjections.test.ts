import { describe, expect, it } from 'vitest'
import { stripVoiceProjections } from './stripVoiceProjections'

/** A stored voice with an untrimmed name and a preset link: it must come back byte-identical. */
const CAST = {
    schema_version: 2,
    provider: 'elevenlabs',
    voice_key: 'vk_0a1b2c3d4e5f60718293a4b5c6d7e8f9',
    voice_name: ' Maren ',
    emotion: 'calm',
    preset_id: 'preset-1',
    preset_name: 'Warm narrator',
}
const V2 = {
    schema_version: 2,
    provider: 'elevenlabs',
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    voice_name: 'Eldrin',
    settings: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
}
const EFFECTIVE = {
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    display_name: 'Eldrin',
    provider_route: 'elevenlabs',
    substitution_reason: null,
    badges: [],
}

describe('stripVoiceProjections', () => {
    it('removes effective_voice next to a card voice and leaves the voice byte-identical', () => {
        const voice = { ...CAST }
        const card = { name: 'Dorn', voice, effective_voice: EFFECTIVE }
        const stripped = stripVoiceProjections(card)
        expect(stripped).toEqual({ name: 'Dorn', voice: CAST })
        expect(stripped).not.toHaveProperty('effective_voice')
        expect(stripped.voice).toBe(voice)
        expect(JSON.stringify(stripped.voice)).toBe(JSON.stringify(CAST))
        // Pure: the input still carries its projection.
        expect(card).toHaveProperty('effective_voice')
    })

    it('removes projections at every voice path of an adventure snapshot', () => {
        const castVoice = { ...CAST }
        const personaVoice = { ...V2 }
        const narratorVoice = { ...V2 }
        const snapshot = {
            template: {
                persona: { name: 'Aria', voice: personaVoice, effective_voice: EFFECTIVE },
                characters: [
                    { name: 'Dorn', voice: castVoice, effective_voice: EFFECTIVE },
                    { name: 'Mira', voice: null },
                ],
                world: [{ name: 'Eldoria' }],
            },
            narrator_voice: narratorVoice,
            effective_narrator_voice: EFFECTIVE,
            narrate_thoughts: true,
        }
        const stripped = stripVoiceProjections(snapshot)
        expect(JSON.stringify(stripped)).not.toContain('effective_')
        expect(stripped.template.persona.voice).toBe(personaVoice)
        expect(stripped.template.characters[0].voice).toBe(castVoice)
        expect(stripped.narrator_voice).toBe(narratorVoice)
        expect(stripped.narrate_thoughts).toBe(true)
        // Untouched subtrees keep their references (copy-on-write).
        expect(stripped.template.characters[1]).toBe(snapshot.template.characters[1])
        expect(stripped.template.world).toBe(snapshot.template.world)
    })

    it('removes projections next to a character-chat snapshot voice and a preset', () => {
        const chat = { character: { name: 'Mira', voice: { ...V2 }, effective_voice: EFFECTIVE } }
        expect(stripVoiceProjections(chat)).toEqual({ character: { name: 'Mira', voice: V2 } })
        const preset = { preset_id: 'p1', name: 'Sage', ...V2, effective_voice: EFFECTIVE }
        expect(stripVoiceProjections(preset)).not.toHaveProperty('effective_voice')
    })

    it('returns the same reference when there is nothing to strip', () => {
        const doc = { template: { characters: [{ voice: { ...CAST } }] }, narrator_voice: { ...V2 } }
        expect(stripVoiceProjections(doc)).toBe(doc)
    })

    it('never rewrites the stored voice objects themselves', () => {
        // Keys inside a stored voice are its own data, not projections.
        const voice = { ...V2, effective_voice: 'kept' }
        const stripped = stripVoiceProjections({ voice })
        expect(stripped.voice).toBe(voice)
    })

    it('passes primitives and non-plain objects through', () => {
        expect(stripVoiceProjections(null)).toBeNull()
        expect(stripVoiceProjections('text')).toBe('text')
        const date = new Date(0)
        expect(stripVoiceProjections({ at: date }).at).toBe(date)
    })
})
