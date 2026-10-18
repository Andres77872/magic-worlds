import type { Character } from '@/shared'

export type CharacterRole = 'character' | 'persona'

export function characterRole(character?: Pick<Character, 'role'> | null): CharacterRole {
    return character?.role === 'persona' ? 'persona' : 'character'
}

export function isPersonaCard(character?: Pick<Character, 'role'> | null): boolean {
    return characterRole(character) === 'persona'
}

export function isAiCharacterCard(character?: Pick<Character, 'role'> | null): boolean {
    return characterRole(character) === 'character'
}

export function defaultPersona(characters: Character[] = []): Character | undefined {
    return characters.find((character) => isPersonaCard(character) && character.is_default_persona)
}

export function defaultPersonaForCharacter(character: Character, characters: Character[] = []): Character | undefined {
    const cardDefaultId = typeof character.default_persona_id === 'string' ? character.default_persona_id.trim() : ''
    if (cardDefaultId) {
        const cardDefault = characters.find((candidate) => candidate.id === cardDefaultId && isPersonaCard(candidate))
        if (cardDefault) return cardDefault
    }
    return defaultPersona(characters)
}

export function personaCandidates(characters: Character[] = []): Character[] {
    const personas = characters.filter(isPersonaCard)
    const others = characters.filter(isAiCharacterCard)
    return [...personas, ...others]
}

/** Session creation is stricter than the optional protagonist on an authored template. */
export function isSessionPersona(character?: { id?: string; role?: CharacterRole } | null): boolean {
    return isPersonaCard(character) && typeof character?.id === 'string'
        && character.id.length > 0 && character.id === character.id.trim()
}

export function sessionPersonaCandidates(characters: Character[] = []): Character[] {
    return characters.filter(isSessionPersona)
}

export class SessionPersonaError extends Error {
    readonly code = 'SESSION_PERSONA_INVALID'
}

/** Recognize only persona-specific setup failures, not every validation error. */
export function isSessionPersonaError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    const value = error as { code?: unknown; status?: unknown; message?: unknown }
    return value.code === 'SESSION_PERSONA_INVALID'
        || (value.status === 422 && value.message === 'persona_id must reference a persona card')
        || (value.status === 404 && value.message === 'Persona not found')
}
