/**
 * World domain types and interfaces
 */

import type { CardActor, CardVisibility } from './cardSharing.types'

export interface World {
    id: string
    name: string
    /**
     * Literal place kind/scale, e.g. world, country, continent, city, or a
     * user-defined value. Distinct from `type`, which remains genre/style.
     */
    place_type?: string
    type: string
    description?: string
    details: Record<string, string>
    /** API attribute groups (name + description + key/value attributes). */
    category?: Array<{ name: string; description?: string; attributes?: Array<Record<string, string>> }>
    /** Keywords that pull this card into the scene when matched in adventure chat. */
    triggers?: string[]
    /** Hosted URL of the card's generated profile portrait, if any. */
    image_url?: string
    /** Hosted URL of the card's generated theme song, if any. */
    theme_song_url?: string
    visibility?: CardVisibility
    original_creator?: CardActor
    /** Newest saved version pointer (read-only; 0/absent when no version saved yet). */
    latest_version_id?: string | null
    latest_version_number?: number
    createdAt?: string
    updatedAt?: string
}

export interface WorldDetails {
    [key: string]: string
}

export interface WorldFormData {
    name: string
    place_type?: string
    type: string
    description?: string
    details: WorldDetails
}
