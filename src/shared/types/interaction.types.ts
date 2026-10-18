/**
 * Interaction and messaging types
 */
import type { ImageProvider } from './imageProfile.types'
import type { LlmRequest } from './llm.types'
import type { VoiceSubstitutionReason } from './voiceCatalog.types'

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
    forwardOptions?: ForwardOption[]
    imagePrompt?: string
}

export type ChatResponseSegmentKind = 'narrator' | 'speech' | 'thought'

export interface ChatResponseSegment {
    kind: ChatResponseSegmentKind
    content: string
    speaker_id?: string
    speaker_name?: string
    /** Resolved from the `speakers` roster (live + post-done) for portrait avatars. */
    image_url?: string | null
    /** True only for the currently-open segment while a turn streams. */
    streaming?: boolean
}

/**
 * One AI speaker in the transient `speakers` roster frame the server emits before
 * the first `delta`. Lets the client paint live attribution (who is speaking /
 * thinking) and resolve `speaker_id → name + portrait` while the turn streams.
 */
export interface ChatSpeakerRosterEntry {
    speaker_id: string
    name: string
    image_url?: string | null
    has_voice?: boolean
}

/** Narrator identity for a turn. `kind: 'scene'` = un-attributed scene-setting (character chat). */
export interface ChatNarratorIdentity {
    name?: string | null
    image_url?: string | null
    kind?: 'narrator' | 'scene'
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

/** Why a chat image job ran: the turn's automatic image, or a regenerate (`prompt_edited` tells an edited scene). */
export type ChatImageTrigger = 'auto' | 'regenerate'

/** How the job's provider was paid for: the platform's key, or the player's own one (BYOK). */
export type ChatImageCredentialMode = 'platform' | 'user_byok'

/**
 * The model and cost of one chat image job, as the REST reads carry them.
 * Image frames may carry it as `generation` in a later server; today they
 * carry ids and status only, and never prompt text.
 */
export interface ChatImageGenerationSummary {
    image_profile_id?: string | null
    profile_name?: string | null
    model?: string | null
    model_display_name?: string | null
    provider?: ImageProvider | null
    credential_mode?: ChatImageCredentialMode | null
    credit_cost?: number | null
    /** For example `3:2`; reserves the placeholder's shape. */
    aspect_ratio?: string | null
    trigger?: ChatImageTrigger | null
    created_at?: string | null
    updated_at?: string | null
}

/**
 * One image job of an assistant message, read from the server's image_job
 * table (`image_generations` on GET messages, the `/messages/{id}/images`
 * endpoints). A turn keeps every job, newest last after ordering.
 */
export interface ChatImageGeneration extends ChatImageGenerationSummary {
    job_id: string
    status: ImageLifecycleStatus
    assistant_message_id?: number | null
    turn_id?: string | null
    status_url?: string | null
    result_url?: string | null
    assets: ChatImageAsset[]
    error?: ChatImageError | null
    /** The scene prompt the job ran on (edited, or the turn's own); null for jobs older than the field. */
    prompt?: string | null
    /** The player edited the scene prompt for this job. */
    prompt_edited?: boolean | null
    /** The prompt built for the model from the scene prompt. */
    model_prompt?: string | null
}

/**
 * The image choice of one chat frame. Omitted, the server generates with the
 * account's default profile. `credentials` only travels with the frame that is
 * being sent and is never stored.
 */
export interface ChatImageRequest {
    generate: boolean
    image_profile_id?: string
    credentials?: { api_key: string }
}

/** Body of `POST /<basePath>/<id>/messages/<mid>/images`; the prompt defaults to the turn's own. */
export interface ChatImageGenerateBody {
    prompt?: string
    image_profile_id?: string
    credentials?: { api_key: string }
}

/** Server features named on the `ready` frame; absent on older servers. */
export interface ChatSocketCapabilities {
    /** The chat frame accepts an `image` field. */
    chat_image_request: boolean
    /** Scene images can be generated at all (an image engine is configured). */
    chat_images: boolean
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

/**
 * Known public `tts_failed.error.code` values (06 §6.6). WN-2 adds
 * `moderation_unavailable`, `content_blocked`, `voice_unavailable` and
 * `voice_safety_pause`; `voice_region_unavailable` is the geo refusal (PC-2).
 */
export type ChatTtsErrorCode =
    | 'voice_unavailable'
    | 'attestation_required'
    | 'moderation_unavailable'
    | 'content_blocked'
    | 'workspace_archived'
    | 'voice_safety_pause'
    | 'voice_region_unavailable'
    | 'call_reply_not_narratable'

/**
 * `code` is public and closed on the server (06 §6.6), e.g. `voice_unavailable`,
 * `attestation_required`, `moderation_unavailable`, `content_blocked` or
 * `workspace_archived`; unknown codes fall back to the category copy.
 * `retryable` and `action` are optional, so older servers stay valid.
 */
export interface ChatTtsError {
    category: string
    detail: string
    code?: ChatTtsErrorCode | (string & {}) | null
    retry_after_seconds?: number | null
    retryable?: boolean
    /**
     * `attest`: the user must accept the age and terms attestation first (D26).
     * `crisis_resources`: voice is paused after a self-harm signal (PC-1); show the crisis panel.
     */
    action?: 'attest' | 'crisis_resources'
}

/** Narration quality tier of a clip (D05). Tier names, never provider model ids. */
export type TtsNarrationTier = 'standard' | 'expressive'

/**
 * Display-only segment states: a daily or per-turn cap kept the segment from
 * being enqueued. Never a job status (`TtsLifecycleStatus` is unchanged), but
 * terminal for the player (03 §5.4.2, §5.8).
 */
export type TtsSegmentDisplayState = 'daily_limit_reached' | 'not_narrated'

export type ChatTtsSegmentStatus = TtsLifecycleStatus | TtsSegmentDisplayState

/** Optional per-clip voice fields (D05, D16, D36); absent on clips stored before WN-1. */
interface ChatTtsClipVoiceFields {
    tier?: TtsNarrationTier
    /** Per-voice loudness gain in dB, attenuation only; clamped to [-24, 0] on read (D16). */
    gain_db?: number | null
    substitution_reason?: VoiceSubstitutionReason | null
    voice_name?: string | null
    original_voice_name?: string | null
}

/**
 * One narration clip in a per-segment multi-voice turn. RP/group turns narrate
 * each line in its own voice (narrator in the narrator voice); the client plays
 * the clips in `segment_index` order. Snake_case to match both the WS `tts_*`
 * frames and the server projection's `ttsSegments`.
 */
export interface ChatTtsSegmentClip extends ChatTtsClipVoiceFields {
    segment_index: number
    segment_count?: number
    kind?: ChatResponseSegmentKind
    speaker_id?: string | null
    speaker_name?: string | null
    job_id?: string
    status?: ChatTtsSegmentStatus
    status_url?: string | null
    result_url?: string | null
    url?: string | null
    audio_url?: string | null
    assets?: ChatTtsAsset[]
    error?: ChatTtsError | null
}

/** Per-segment narration fields the `tts_*` frames carry for multi-voice turns. */
interface ChatTtsSegmentFrameFields extends ChatTtsClipVoiceFields {
    segment_index?: number
    segment_count?: number
    kind?: ChatResponseSegmentKind
    speaker_id?: string | null
    speaker_name?: string | null
}

export interface ChatState {
    messages: Message[]
    isLoading: boolean
    error?: string
}

/** One durable conversation row returned by the stored `/messages` APIs. */
export interface StoredConversationMessage {
    message_id: number
    turn_id: string
    sequence_no: number
    role: 'system' | 'user' | 'assistant'
    status: 'pending' | 'streaming' | 'completed' | 'failed' | 'interrupted'
    content: string
    metadata: Record<string, unknown>
    created_at: string
    updated_at: string
    completed_at: string | null
    /** Present when the message was spoken or answered during a voice call. */
    call?: { voice_session_id: string } | null
    /** Assistant rows on newer servers: the message's image jobs (newest 20), read from the image_job table. */
    image_generations?: ChatImageGeneration[]
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
    | { type: 'chat'; content: string; request_id?: string; existing_user_message_id?: number; image?: ChatImageRequest }
    | { type: 'tts'; assistant_message_id: number; turn_id: string; request_id?: string }
    | { type: 'cancel' }
    | { type: 'ping' }

export type ChatSocketServerMessage = ChatFrameIdentity & (
    | { type: 'turn_started'; user_message_id: number; assistant_message_id: number; turn_id: string; execution_attempt?: ChatExecutionAttempt }
    | { type: 'ready'; capabilities?: ChatSocketCapabilities }
    | { type: 'speakers'; roster: ChatSpeakerRosterEntry[]; narrator?: ChatNarratorIdentity | null }
    | { type: 'delta'; content: string }
    | { type: 'metadata'; forwardOptions?: ForwardOption[]; imagePrompt?: string }
    | { type: 'segments'; responseFormat: string; segments: ChatResponseSegment[]; displayText?: string }
    | { type: 'image_job'; adventure_id: number; assistant_message_id: number; turn_id: string; job_id: string; status: Extract<ImageLifecycleStatus, 'pending' | 'in_progress' | 'mirroring'>; status_url: string; result_url: string; generation?: ChatImageGenerationSummary | null }
    | { type: 'image_complete'; adventure_id: number; assistant_message_id: number; turn_id: string; job_id: string; status: 'completed'; assets: ChatImageAsset[]; status_url?: string; result_url?: string; generation?: ChatImageGenerationSummary | null }
    | { type: 'image_failed'; adventure_id: number; assistant_message_id: number; turn_id: string; job_id: string | null; status: Extract<ImageLifecycleStatus, 'failed' | 'canceled' | 'unavailable' | 'invalid' | 'quota_exceeded'>; error: ChatImageError; status_url?: string | null; result_url?: string | null; generation?: ChatImageGenerationSummary | null }
    | { type: 'image'; [key: string]: unknown } // reserved for a future image step
    | ({ type: 'tts_job'; adventure_id: number; assistant_message_id: number; turn_id: string; job_id: string; status: Extract<TtsLifecycleStatus, 'pending' | 'in_progress' | 'synthesizing' | 'mirroring'>; status_url: string; result_url: string } & ChatTtsSegmentFrameFields)
    | ({ type: 'tts_complete'; adventure_id: number; assistant_message_id: number; turn_id: string; job_id: string; status: 'completed'; url?: string; assets: ChatTtsAsset[]; status_url?: string; result_url?: string } & ChatTtsSegmentFrameFields)
    | ({ type: 'tts_failed'; adventure_id: number; assistant_message_id: number; turn_id: string; job_id: string | null; status: Extract<TtsLifecycleStatus, 'failed' | 'invalid' | 'unavailable' | 'quota_exceeded' | 'rate_limited' | 'timeout' | 'content_blocked'>; error: ChatTtsError; status_url?: string | null; result_url?: string | null } & ChatTtsSegmentFrameFields)
    | { type: 'action'; [key: string]: unknown } // reserved for future actions
    | { type: 'done'; interrupted?: boolean; user_message_id?: number; assistant_message_id?: number; turn_id?: string; image_scheduled?: boolean }
    | { type: 'error'; message: string; category?: string; code?: string }
    | { type: 'pong' }
    | VoiceSafetyNoticeFrame
)

/**
 * WN-3: sent once on the chat socket when a self-harm signal pauses voice.
 * Voice resumes after `retry_after_seconds` when it is set.
 */
export interface VoiceSafetyNoticeFrame {
    type: 'voice_safety_notice'
    kind: 'self_harm'
    retry_after_seconds: number | null
}

export interface ChatFrameIdentity { request_id?: string; turn_id?: string }

/** A new response to the original user input after a confirmed terminal attempt. */
export interface ChatExecutionAttempt {
    parent_execution_id: string
    user_message_id: number
    accepted_conversation_version: number
}

/** Durable state of one chat request (`GET /<basePath>/<id>/turns/<request_id>`); reading it never runs the turn. */
export interface ChatTurnReconciliation {
    status: 'admitted' | 'running' | 'completed' | 'failed' | 'cancelled' | 'awaiting_credential'
    request_id: string
    execution_id: string
    /** The original executor is gone: resending the same request recovers it without a second run. */
    recovery_required: boolean
    /** The original public intent, proved against its retained native fingerprint. */
    dispatch?: {
        content: string
        existing_user_message_id: number | null
        llm: Pick<LlmRequest, 'retry_of_execution_id' | 'selection' | 'expected_revision_id'>
    }
}
