/**
 * Interaction and messaging types
 */

export interface Message {
    isLoading?: boolean
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp?: string
    metadata?: Record<string, unknown>
}

export type MessageRole = 'user' | 'assistant' | 'system'

/**
 * A suggested next player action ("forward option"), emitted by the backend in
 * the `mw_turn_metadata` SSE frame. `label` is the short button text; `message`
 * is the full action submitted on the player's behalf when the option is picked.
 */
export interface ForwardOption {
    label: string
    message: string
}

/**
 * Validated turn metadata surfaced by magic-worlds-api after the narrative
 * stream completes (the `mw_turn_metadata` SSE frame). `imagePrompt` is a
 * text-only prompt for a future image-generation step (image generation itself
 * is out of scope here — we only capture and persist the prompt).
 */
export interface TurnMetadata {
    forwardOptions: ForwardOption[]
    imagePrompt: string
}

export type ImageLifecycleStatus =
    | 'pending'
    | 'in_progress'
    | 'mirroring'
    | 'completed'
    | 'failed'
    | 'canceled'
    | 'unavailable'
    | 'invalid'
    | 'quota_exceeded'

export interface ChatImageAsset {
    asset_id: string
    url: string
    content_type: 'image/jpeg' | 'image/png' | 'image/webp'
    width?: number | null
    height?: number | null
    file_size_bytes?: number | null
    seed?: number | null
    safety?: Record<string, unknown> | null
}

export interface ChatImageError {
    category: string
    detail: string
    code?: string | null
}

/**
 * TTS narration job lifecycle. A superset of {@link ImageLifecycleStatus}: it adds
 * `synthesizing`, `rate_limited`, `timeout`, and `content_blocked`, and has no
 * `canceled`. Mirrors magic-worlds-api `TtsJobStatus`.
 */
export type TtsLifecycleStatus =
    | 'pending'
    | 'in_progress'
    | 'synthesizing'
    | 'mirroring'
    | 'completed'
    | 'failed'
    | 'invalid'
    | 'unavailable'
    | 'quota_exceeded'
    | 'rate_limited'
    | 'timeout'
    | 'content_blocked'

export interface ChatTtsAsset {
    asset_id: string
    url: string
    content_type: 'audio/mpeg'
    file_size_bytes?: number | null
    duration_ms?: number | null
    sample_rate?: number | null
    channels?: number | null
    bitrate?: number | null
    output_format?: 'mp3'
}

export interface ChatTtsError {
    category: string
    detail: string
    code?: string | null
    retry_after_seconds?: number | null
}

export interface ChatState {
    messages: Message[]
    isLoading: boolean
    error?: string
}

/**
 * WebSocket envelope for adventure chat (replaces the old SSE frames).
 *
 * The conversation and all turn metadata flow over one per-session socket. The
 * envelope is a discriminated union on `type` so new server frames (`image`,
 * `action`, …) can be added without breaking older clients — unknown types are
 * ignored. See magic-worlds-api `route_chat.chat_session_ws`.
 */
export type ChatSocketClientMessage =
    | { type: 'chat'; messages: { role: 'user' | 'assistant'; content: string }[] }
    | { type: 'tts'; assistant_message_id: number; turn_id: string; request_id?: string }
    | { type: 'cancel' }
    | { type: 'ping' }

export type ChatSocketServerMessage =
    | { type: 'ready' }
    | { type: 'delta'; content: string }
    | { type: 'metadata'; forwardOptions: ForwardOption[]; imagePrompt: string }
    | { type: 'image_job'; adventure_id: number; assistant_message_id: number; turn_id: string; job_id: string; status: Extract<ImageLifecycleStatus, 'pending' | 'in_progress' | 'mirroring'>; status_url: string; result_url: string }
    | { type: 'image_complete'; adventure_id: number; assistant_message_id: number; turn_id: string; job_id: string; status: 'completed'; assets: ChatImageAsset[]; status_url?: string; result_url?: string }
    | { type: 'image_failed'; adventure_id: number; assistant_message_id: number; turn_id: string; job_id: string | null; status: Extract<ImageLifecycleStatus, 'failed' | 'canceled' | 'unavailable' | 'invalid' | 'quota_exceeded'>; error: ChatImageError; status_url?: string | null; result_url?: string | null }
    | { type: 'image'; [key: string]: unknown } // reserved for a future image step
    | { type: 'tts_job'; adventure_id: number; assistant_message_id: number; turn_id: string; job_id: string; status: Extract<TtsLifecycleStatus, 'pending' | 'in_progress' | 'synthesizing' | 'mirroring'>; status_url: string; result_url: string }
    | { type: 'tts_complete'; adventure_id: number; assistant_message_id: number; turn_id: string; job_id: string; status: 'completed'; url?: string; assets: ChatTtsAsset[]; status_url?: string; result_url?: string }
    | { type: 'tts_failed'; adventure_id: number; assistant_message_id: number; turn_id: string; job_id: string | null; status: Extract<TtsLifecycleStatus, 'failed' | 'invalid' | 'unavailable' | 'quota_exceeded' | 'rate_limited' | 'timeout' | 'content_blocked'>; error: ChatTtsError; status_url?: string | null; result_url?: string | null }
    | { type: 'action'; [key: string]: unknown } // reserved for future actions
    | { type: 'done'; interrupted?: boolean; assistant_message_id?: number; turn_id?: string }
    | { type: 'error'; message: string; category?: string }
    | { type: 'pong' }
