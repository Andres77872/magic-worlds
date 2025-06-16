/**
 * Character domain types and interfaces
 */

import type {AttributeCategory} from '../../ui/components/common/AttributeList';

export interface Character {
    id: string
    name: string
    race: string
    class?: string
    stats: Record<string, string | number>
    description?: string
    skills?: Record<string, string>
    traits?: Record<string, string>
    equipment?: Record<string, string>
    customCategories?: AttributeCategory[]

    [key: string]: any // Allow dynamic attribute categories
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
