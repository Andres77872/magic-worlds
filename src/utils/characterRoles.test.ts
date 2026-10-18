import { describe, expect, it } from 'vitest'
import type { Character } from '@/shared'
import { defaultPersonaForCharacter, isSessionPersonaError, personaCandidates, sessionPersonaCandidates } from './characterRoles'

const globalPersona = { id: 'p1', name: 'Aria', role: 'persona', is_default_persona: true, stats: {} } as Character
const cardPersona = { id: 'p2', name: 'Sera', role: 'persona', stats: {} } as Character
const character = { id: 'c1', name: 'Lyra', role: 'character', stats: {} } as Character

describe('session persona eligibility', () => {
    it('excludes AI and legacy roleless cards without changing template authoring choices', () => {
        const legacy = { ...character, id: 'legacy', role: undefined }
        const library = [character, cardPersona, legacy, globalPersona]
        expect(sessionPersonaCandidates(library)).toEqual([cardPersona, globalPersona])
        expect(personaCandidates(library)).toEqual([cardPersona, globalPersona, character, legacy])
        expect(library[0]).toBe(character)
    })

    it('returns no fallback for AI-only or empty libraries and excludes invalid ids', () => {
        expect(sessionPersonaCandidates([character])).toEqual([])
        expect(sessionPersonaCandidates()).toEqual([])
        expect(sessionPersonaCandidates([{ ...cardPersona, id: '' }, { ...cardPersona, id: ' padded ' }])).toEqual([])
    })

    it.each([
        [{ status: 422, message: 'persona_id must reference a persona card' }, true],
        [{ status: 404, message: 'Persona not found' }, true],
        [{ status: 422, message: 'Group chat requires 2 to 6 characters' }, false],
        [{ status: 404, message: 'Character not found' }, false],
        [new Error('offline'), false],
    ])('classifies persona setup failures narrowly: %j', (error, expected) => {
        expect(isSessionPersonaError(error)).toBe(expected)
    })
})

describe('defaultPersonaForCharacter', () => {
    it('prefers the character card default persona over the global default', () => {
        expect(defaultPersonaForCharacter({ ...character, default_persona_id: 'p2' }, [globalPersona, cardPersona])).toBe(cardPersona)
    })

    it('falls back to the global default when the card default is missing or not a persona', () => {
        const notPersona = { id: 'p2', name: 'Sera', role: 'character', stats: {} } as Character

        expect(defaultPersonaForCharacter({ ...character, default_persona_id: 'p2' }, [globalPersona, notPersona])).toBe(globalPersona)
        expect(defaultPersonaForCharacter({ ...character, default_persona_id: 'missing' }, [globalPersona])).toBe(globalPersona)
    })
})
