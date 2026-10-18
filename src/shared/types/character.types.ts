/**
 * Character domain types and interfaces
 */

import type {AttributeCategory} from '../../ui/components/common/AttributeList';
import type { CardActor, CardVisibility } from './cardSharing.types'
import type { StoredCharacterVoice } from './voicePreset.types'
import type { EffectiveVoice } from './voiceCatalog.types'
import type { CardOrganization } from './workspace.types'

export type CharacterRole = 'character' | 'persona'

export interface Character {
    id: string
    name: string
    /** Library role: AI chat/cast target or user-playable persona. Legacy cards default to `character`. */
    role?: CharacterRole
    /** The persona auto-selected by chat/adventure start flows. Only valid when role is `persona`. */
    is_default_persona?: boolean
    /** Owner-only: persona card preferred when starting a new 1:1 chat with this AI character. */
    default_persona_id?: string | null
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
    /** Assigned narration voice, kept whole (03 §5.1). */
    voice?: StoredCharacterVoice
    /** Read-only projection of `voice` (D35): what plays. Never written back; absent for anonymous readers. */
    effective_voice?: EffectiveVoice | null
    visibility?: CardVisibility
    original_creator?: CardActor
    /** Newest saved version pointer (read-only; 0/absent when no version saved yet). */
    latest_version_id?: string | null
    latest_version_number?: number
    /** Frozen conversation provenance; read-only, separate from the live library head. */
    source_card_id?: string
    source_card_version_id?: string | null
    source_card_version_number?: number
    newer_version_available?: boolean
    /** Owner-only: true when there are unpublished draft edits (absent on foreign reads). */
    has_draft?: boolean
    draft_updated_at?: string | null
    /** Workspace R1: server-owned placement (read-only; never written back). */
    organization?: CardOrganization

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
