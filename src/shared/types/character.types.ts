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
    /** API attribute groups (name + description + key/value attributes). */
    category?: Array<{ name: string; description?: string; attributes?: Array<Record<string, string>> }>
    /** Keywords that pull this card into the scene when matched in adventure chat. */
    triggers?: string[]
    /** Opening line the character speaks first when a 1:1 chat begins. */
    greeting?: string
    /** Freeform system/persona prompt steering the character's voice in 1:1 chat. */
    system_instructions?: string
    /** Hosted URL of the card's generated profile portrait, if any. */
    image_url?: string
    /** Hosted URL of the card's generated theme song, if any. */
    theme_song_url?: string

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
