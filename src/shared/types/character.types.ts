/**
 * Character domain types and interfaces
 */

export interface Character {
    id: string
    name: string
    race: string
    class?: string
    stats: Record<string, string | number>
    description?: string
    createdAt?: string
    updatedAt?: string
}

export interface CharacterStats {
    [key: string]: string | number
}

export interface CharacterFormData {
    name: string
    race: string
    class?: string
    stats: CharacterStats
    description?: string
}
