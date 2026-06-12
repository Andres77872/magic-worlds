/**
 * Item/object domain types and interfaces.
 */

export interface Item {
    id: string
    name: string
    alias?: string | null
    type?: string | null
    rarity?: string | null
    description: string
    effects: string[]
    requirements: string[]
    limitations: string[]
    origin?: string | null
    value?: string | null
    /** API attribute groups (name + description + key/value attributes). */
    category?: Array<{ name: string; description?: string; attributes?: Array<Record<string, string>> }>
    /** Keywords that pull this item into scenes and story context. */
    triggers?: string[]
    /** Hosted URL of the card's generated item image, if any. */
    image_url?: string
    /** Hosted URL of the card's generated theme song, if any. */
    theme_song_url?: string
    createdAt?: string
    updatedAt?: string
}

export interface ItemFormData {
    name: string
    type?: string
    rarity?: string
    description: string
    effects: string[]
    requirements: string[]
    limitations: string[]
    origin?: string
    value?: string
}
