/**
 * Card media generation types — profile portraits (images) and theme songs
 * (audio). Mirrors the backend FastAPI Pydantic models for `/images/card-portrait`
 * and `/theme-songs`. Image jobs reuse `ImageJobPublicResponse` / `ChatImageAsset`.
 */

import type { ChatImageAsset, ChatImageError, ImageLifecycleStatus } from './interaction.types'

export type CardMediaTargetType = 'character' | 'world' | 'adventure_template'

export type ImageAspectRatio = '1:1' | '16:9' | '4:3' | '3:4' | '9:16'

/**
 * The card-info "template" the client sends. The backend folds it (plus the
 * optional `extra_direction`) into the real, optimized generation prompt — the
 * client never supplies the raw image prompt.
 */
export interface CardPortraitRequest {
    card_type: CardMediaTargetType
    /**
     * Optional saved-card id: only tags the job so the media gallery can filter
     * images by card. Omitted for unsaved/snapshot cards.
     */
    card_id?: string | null
    name: string
    description?: string | null
    /** Race for a character, type for a world; ignored for adventure templates. */
    subtype?: string | null
    category?: Array<{ name: string; description?: string; attributes?: Array<Record<string, string>> }> | null
    /** Optional extra art direction the user typed in. */
    extra_direction?: string | null
    aspect_ratio?: ImageAspectRatio
}

/**
 * Result of storing a user-supplied custom card image (`POST /images/upload`).
 * Mirrors the asset fields of a generated image so an uploaded URL is treated
 * exactly like a generated one: set onto the card's `image_url`, persisted on save.
 */
export interface ImageUploadResponse {
    asset_id: string
    url: string
    content_type: 'image/jpeg' | 'image/png' | 'image/webp'
    file_size_bytes?: number | null
    width?: number | null
    height?: number | null
}

export type ThemeSongJobStatus =
    | 'pending'
    | 'in_progress'
    | 'synthesizing'
    | 'mirroring'
    | 'completed'
    | 'failed'
    | 'canceled'

export interface ThemeSongAssetPublic {
    asset_id: string
    url: string
    content_type: 'audio/mpeg' | 'audio/mp3' | 'audio/wav' | 'audio/wave' | 'audio/x-wav'
    file_size_bytes: number
    duration_ms?: number | null
    sample_rate?: number | null
    channels?: number | null
    bitrate?: number | null
    output_format?: 'mp3' | 'wav'
}

export interface ThemeSongLyricsPublic {
    source?: 'user' | 'generated' | 'optimizer' | 'unavailable' | null
    song_title?: string | null
    style_tags?: string[]
    lyrics_sha256?: string | null
    lyrics_length_chars?: number | null
    lyrics?: string | null
}

export interface ThemeSongTargetRef {
    type: CardMediaTargetType
    id: string
    display_name?: string | null
}

export interface ThemeSongJobPublic {
    job_id: string
    target: ThemeSongTargetRef
    operation: 'theme_song'
    status: ThemeSongJobStatus
    model_alias: string
    status_url: string
    result_url: string
    lyrics?: ThemeSongLyricsPublic | null
    assets: ThemeSongAssetPublic[]
    error?: ThemeSongErrorPublic | null
    created_at: string
    updated_at: string
}

export interface ThemeSongErrorPublic {
    category: string
    detail: string
    code?: string | null
}

export interface ThemeSongListResponse {
    items: ThemeSongJobPublic[]
    target: ThemeSongTargetRef
    limit: number
    offset: number
    next_offset?: number | null
}

/**
 * User-wide theme song list (`GET /theme-songs/user`) — spans many cards, so
 * there is no single `target` envelope; each item carries its own `target` ref.
 */
export interface UserThemeSongListResponse {
    items: ThemeSongJobPublic[]
    limit: number
    offset: number
    next_offset?: number | null
}

export interface ThemeSongCreateRequest {
    target_type: CardMediaTargetType
    target_id: string
    description: string
    lyrics?: string | null
}

/**
 * A full image job as returned by the gallery list (`GET /images/jobs`). Richer than
 * the chat-oriented `ImageJobPublicResponse` (which omits timestamps): the gallery
 * needs `created_at` to show recency and `assets[]` to render thumbnails.
 */
export interface ImageJobPublic {
    job_id: string
    operation?: 'text_to_image' | 'image_edit'
    status: ImageLifecycleStatus
    model_alias?: string
    status_url: string
    result_url: string
    assets: ChatImageAsset[]
    error?: ChatImageError | null
    /**
     * Loose card tag captured at creation (card-portrait jobs only); `card_name`
     * is a creation-time snapshot. Null for legacy jobs, uploads, edits and chat
     * images — those only surface in unfiltered gallery views.
     */
    card_type?: CardMediaTargetType | null
    card_id?: string | null
    card_name?: string | null
    created_at: string
    updated_at: string
}

/**
 * Paginated user-wide image gallery (`GET /images/jobs`). Image jobs are scoped to the
 * user, not to a card, so this is a gallery rather than per-card history — unlike
 * {@link ThemeSongListResponse}. `next_offset` is null on the final page.
 */
export interface ImageJobListResponse {
    items: ImageJobPublic[]
    limit: number
    offset: number
    next_offset?: number | null
}

/** Non-terminal statuses worth polling for both job kinds. */
export const THEME_SONG_NON_TERMINAL_STATUSES: ThemeSongJobStatus[] = [
    'pending',
    'in_progress',
    'synthesizing',
    'mirroring',
]
