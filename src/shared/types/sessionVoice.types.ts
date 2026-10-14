/**
 * Per-session voice settings and voice refresh (EP-1, EP-2).
 *
 * Routes (session documents, called on the session's `withWorkspace(id)` client):
 * - `GET|PUT /adventure-sessions/{id}/voice-settings` and
 *   `GET|PUT /character-chats/{id}/voice-settings` → `SessionVoiceSettings`;
 * - `POST /character-chats/{id}/voice/refresh` (body `{}`) → the chat DTO;
 * - `POST /adventure-sessions/{id}/voices/refresh` (`AdventureVoiceRefreshRequest`)
 *   → the session DTO.
 *
 * Every authenticated caller is served (I-68: no cohort); a 404 reads as unavailable.
 */
import type { NarrationTier } from './auth.types'

/** The two session routers that share the voice-settings protocol (same values as `config.basePath`). */
export type VoiceSessionBasePath = 'adventure-sessions' | 'character-chats'

/** Why the effective tier is lower than the requested one. */
export type SessionTierFallbackReason = 'plan' | 'unhealthy'

/** The EP-1 response body. */
export interface SessionVoiceSettings {
    session_id: number
    /** The session override; null follows the user's preference. */
    tier_override: NarrationTier | null
    effective_tier: NarrationTier
    tier_fallback_reason: SessionTierFallbackReason | null
    tiers_allowed: NarrationTier[]
    /** The constant `elevenlabs` (kept on the wire for one release); no code branches on it. */
    provider_route: 'elevenlabs'
    updated_at: string | null
}

/** The EP-1 PUT body. The key is required; null deletes the override. */
export interface SessionVoiceSettingsUpdate {
    tier_override: NarrationTier | null
}

/** The EP-2 adventure refresh body: 1..6 unique snapshot card ids, or null for every cast card. */
export interface AdventureVoiceRefreshRequest {
    card_ids: string[] | null
}
