import { describe, expect, it } from 'vitest'
import type { Character } from '@/shared'
import { defaultPersonaForCharacter } from './characterRoles'

const globalPersona = { id: 'p1', name: 'Aria', role: 'persona', is_default_persona: true, stats: {} } as Character
const cardPersona = { id: 'p2', name: 'Sera', role: 'persona', stats: {} } as Character
const character = { id: 'c1', name: 'Lyra', role: 'character', stats: {} } as Character

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
