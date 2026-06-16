/**
 * Adventure domain types and interfaces
 */

import type { Character } from './character.types'
import type { CardActor, CardVisibility } from './cardSharing.types'
import type { ChatImageAsset, ChatImageError, ChatResponseSegment, ChatTtsAsset, ChatTtsError, ChatTtsSegmentClip, ImageLifecycleStatus, TtsLifecycleStatus } from './interaction.types'
import type { CharacterVoice } from './voicePreset.types'
import type { World } from './world.types'

export interface Adventure {
    id: string
    scenario: string
    /** The player's persona (protagonist). Embedded snapshot on templates. */
    persona?: Character
    characters: Character[]
    world?: World
    /** All cloned worlds for this adventure (snapshot can carry more than one). */
    worlds?: World[]
    turns?: TurnEntry[]
    objectives?: Record<string, string>
    notes?: Record<string, string>
    /** API attribute groups (name + description + key/value attributes). */
    category?: Array<{ name: string; description?: string; attributes?: Array<Record<string, string>> }>
    /** Keywords that pull this adventure into the scene when matched in chat. */
    triggers?: string[]
    /** Hosted URL of the adventure's generated cover image, if any. */
    image_url?: string
    /** Hosted URL of the adventure's generated theme song, if any. */
    theme_song_url?: string
    visibility?: CardVisibility
    original_creator?: CardActor
    /**
     * The adventure's own cloned cards (persona/cast/world/scenario), captured when
     * the session was started. Editing this copy never affects the original library
     * or template cards; the chat AI reads its context from here. Single source of
     * truth for in-session card edits.
     */
    snapshot?: AdventureSnapshot
    createdAt?: string
    updatedAt?: string
    status?: AdventureStatus
}

/** A cloned card as stored in the adventure snapshot (raw API shape). */
export interface SnapshotCard {
    id?: string
    uuid?: string
    /** Library card id this clone came from — used to clone the live original at adventure start. */
    source_card_id?: string
    /** The source card's version pinned at clone time (v2+ snapshots). */
    source_card_version_id?: string | null
    source_card_version_number?: number
    /** Server-computed: the source card has a newer saved version than the one pinned here (informative only). */
    newer_version_available?: boolean
    name?: string
    role?: 'character' | 'persona'
    is_default_persona?: boolean
    alias?: string | null
    description?: string
    /** Characters carry `race`, worlds carry `type` plus optional `place_type`. */
    race?: string
    place_type?: string
    type?: string
    triggers?: string[]
    /** API attribute groups (name + description + key/value attributes). */
    category?: Array<{ name: string; description?: string; attributes?: Array<Record<string, string>> }>
    /** Hosted URL of this card's generated profile portrait, if any. */
    image_url?: string
    /** Hosted URL of this card's generated theme song, if any. */
    theme_song_url?: string
    [key: string]: unknown
}

/** Editable inner template of an adventure snapshot. */
export interface SnapshotTemplate {
    id?: string
    uuid?: string
    name?: string
    description?: string
    alias?: string | null
    triggers?: string[]
    persona?: SnapshotCard | null
    characters?: SnapshotCard[]
    world?: SnapshotCard[] | null
    category?: Array<{ name: string; description?: string; attributes?: Array<Record<string, string>> }>
    /** Hosted URL of the adventure's generated cover image, if any. */
    image_url?: string
    /** Hosted URL of the adventure's generated theme song, if any. */
    theme_song_url?: string
}

/** Snapshot envelope returned on the session response (`template_snapshot`). */
export interface AdventureSnapshot {
    schema_version?: number
    source?: string
    template_card_id?: string
    template: SnapshotTemplate
    /** Narrator/GM voice for multi-voice narration (falls back to the global default). */
    narrator_voice?: CharacterVoice | null
    /** Whether visible character thoughts are voiced during narration (default off). */
    narrate_thoughts?: boolean
}

export type AdventureStatus = 'draft' | 'in-progress' | 'completed' | 'archived'

export interface TurnEntry {
    id: string
    type: 'user' | 'ai' | 'system'
    content: string
    timestamp: string
    segments?: ChatResponseSegment[]
    isStreaming?: boolean
    metadata?: Record<string, unknown>
    assistantMessageId?: number
    turnId?: string
    imagePrompt?: string
    imageJobId?: string
    imageStatus?: ImageLifecycleStatus
    imageStatusUrl?: string
    imageResultUrl?: string
    imageAssets?: ChatImageAsset[]
    imageUrl?: string
    imageError?: ChatImageError
    /** Per-turn TTS narration lifecycle (mirrors the image fields above). */
    ttsJobId?: string
    ttsStatus?: TtsLifecycleStatus
    ttsStatusUrl?: string
    ttsResultUrl?: string
    ttsAssets?: ChatTtsAsset[]
    ttsUrl?: string
    ttsError?: ChatTtsError
    /** Per-segment multi-voice narration clips (RP/group), played in order. */
    ttsSegments?: ChatTtsSegmentClip[]
}

export interface AdventureFormData {
    scenario: string
    characters: string[]
    world?: string
}
