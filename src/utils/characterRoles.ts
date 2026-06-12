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

export function personaCandidates(characters: Character[] = []): Character[] {
    const personas = characters.filter(isPersonaCard)
    const others = characters.filter(isAiCharacterCard)
    return [...personas, ...others]
}
