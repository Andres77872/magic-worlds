/**
 * Voice callbot transport contracts.
 *
 * These types intentionally live outside interaction.types.ts so the existing
 * text ChatSocket remains text/control-only. Client JSON frames carry lifecycle,
 * VAD, segment metadata, and barge-in controls only. Microphone bytes are sent
 * through the authenticated segment upload endpoint, never as VoiceSocket JSON
 * payloads and never through ChatSocket.
 */

export type VoiceAudioEncoding = 'audio/wav;codec=pcm_s16le' | 'audio/webm;codecs=opus'

export type VoiceVadSource = 'audio_worklet' | 'media_recorder'

export type VoiceVadAggressiveness = 'balanced' | 'strict'

export type VoiceCallState =
    | 'disabled'
    | 'idle'
    | 'consent_required'
    | 'requesting_permission'
    | 'connecting'
    | 'reconnecting'
    | 'listening'
    | 'user_speaking'
    | 'uploading_segment'
    | 'transcribing'
    | 'assistant_thinking'
    | 'assistant_speaking'
    | 'barge_in'
    | 'ending'
    | 'ended'
    | 'error'

export type VoiceErrorCategory =
    | 'disabled'
    | 'consent_required'
    | 'consent_stale'
    | 'permission_denied'
    | 'quota_exceeded'
    | 'busy'
    | 'conflict'
    | 'unsupported_media'
    | 'no_speech'
    | 'stt_rate_limited'
    | 'stt_timeout'
    | 'stt_failed'
    | 'tts_unavailable'
    | 'tts_stream_interrupted'
    | 'tts_timeout'
    | 'llm_timeout'
    | 'provider_submission'
    | 'upstream_contract'
    | 'auth'
    | 'not_found'
    | 'internal'

export interface VoiceAudioPreferences {
    preferred_encoding: VoiceAudioEncoding
    sample_rate: 16000
    channels: 1
    vad: {
        source: VoiceVadSource
        aggressiveness: VoiceVadAggressiveness
    }
}

export interface VoiceClientCapabilities {
    media_source_mp3: boolean
    audio_worklet: boolean
    media_recorder: boolean
}

export interface VoiceSegmentVadMetadata {
    speech_ms: number
    silence_ms: number
    rms: number
    peak: number
}

export interface VoiceSegmentMetadata {
    voice_session_id: string
    seq: number
    started_at_ms: number
    duration_ms: number
    encoding: VoiceAudioEncoding
    sample_rate: number
    channels: 1
    byte_length: number
    audio_sha256: string
    vad: VoiceSegmentVadMetadata
}

export type VoiceSocketClientFrame =
    | {
        type: 'voice_start'
        client_call_id: string
        consent_version: string
        audio: VoiceAudioPreferences
        capabilities: VoiceClientCapabilities
    }
    | { type: 'voice_vad'; state: 'speech_start' | 'speech_end' | 'silence'; seq?: number; at_ms: number; rms?: number }
    | ({ type: 'voice_segment_meta' } & VoiceSegmentMetadata)
    | { type: 'voice_resume'; voice_session_id: string; last_segment_seq: number; last_audio_seq: number }
    | {
        type: 'voice_barge_in'
        voice_session_id: string
        turn_id?: string
        last_heard_audio_seq?: number
        reason: 'user_speech' | 'button'
    }
    | { type: 'voice_end'; voice_session_id: string; reason: 'user' | 'navigation' | 'permission_lost' }
    | { type: 'voice_ping'; voice_session_id?: string }

export interface VoiceCallLimits {
    max_call_seconds: number
    idle_timeout_seconds: number
    remaining_daily_seconds: number
}

export type VoiceSocketServerFrame =
    | {
        type: 'voice_ready'
        voice_session_id: string
        server_time_ms: number
        limits: VoiceCallLimits
        upload_url: string
    }
    | {
        type: 'voice_state_snapshot'
        voice_session_id: string
        state: VoiceCallState
        status: string
        last_segment_seq: number
        last_audio_seq: number
        server_time_ms: number
    }
    | { type: 'voice_status'; state: VoiceCallState; message?: string; retry_after_seconds?: number }
    | {
        type: 'voice_segment_ack'
        voice_session_id: string
        seq: number
        status: 'received' | 'accepted' | 'rejected'
        reason?: string
    }
    | {
        type: 'transcript_final'
        voice_session_id: string
        seq: number
        turn_id: string
        text: string
        confidence?: number
        no_speech_prob?: number
    }
    | { type: 'voice_turn_start'; voice_session_id: string; turn_id: string; user_message_id: number; assistant_message_id: number }
    | { type: 'voice_assistant_delta'; voice_session_id: string; turn_id: string; content: string }
    | {
        type: 'voice_audio_chunk'
        voice_session_id: string
        turn_id: string
        seq: number
        content_type: 'audio/mpeg'
        sample_rate: 32000
        channels: 1
        data_b64: string
        is_final: false
    }
    | { type: 'voice_audio_final'; voice_session_id: string; turn_id: string; last_seq: number }
    | { type: 'voice_turn_end'; voice_session_id: string; turn_id: string; status: 'completed' | 'interrupted' | 'failed'; partial: boolean; duration_ms: number }
    | { type: 'voice_cancelled'; voice_session_id: string; turn_id?: string; reason: 'barge_in' | 'end_call' | 'provider_disconnected' }
    | { type: 'voice_error'; category: VoiceErrorCategory; code?: string; message: string; retry_after_seconds?: number; fatal?: boolean }
    | { type: 'voice_ended'; voice_session_id: string; reason: 'user' | 'idle_timeout' | 'max_duration' | 'quota' | 'server_shutdown' }
    | { type: 'voice_pong'; voice_session_id?: string }

export interface VoiceSegmentUploadRequest {
    voice_session_id: string
    client_call_id: string
    seq: number
    started_at_ms: number
    duration_ms: number
    encoding: VoiceAudioEncoding
    sample_rate: number
    channels: 1
    audio_sha256: string
    vad: VoiceSegmentVadMetadata & { source: VoiceVadSource; aggressiveness: VoiceVadAggressiveness }
    audio: Blob
}

export interface VoiceSegmentUploadResponse {
    voice_session_id: string
    segment_id: string
    seq: number
    status: 'received' | 'accepted' | 'duplicate' | 'rejected'
    reason?: 'too_short' | 'too_long' | 'too_large' | 'unsupported_encoding' | 'no_speech' | 'quota' | 'call_not_active'
}

/** One past voice call (call-history entry). Server: GET /voice-calls + .../calls. */
export interface CallSummary {
    voice_session_id: string
    /** The character-chats session this call belongs to. */
    chat_id: number | string
    character_card_id?: string | null
    character_name?: string | null
    character_image_url?: string | null
    status?: string
    end_reason?: string | null
    started_at?: string | null
    ended_at?: string | null
    duration_seconds?: number | null
    segment_count?: number
}

/** One transcript line of a call. Only `assistant` lines carry saved character audio. */
export interface CallTranscriptSegment {
    segment_id: string
    seq: number
    role: 'user' | 'assistant'
    text?: string | null
    duration_ms?: number | null
    /** Protected `/tts/assets/{id}.mp3` URL for the character's saved TTS (assistant only). */
    audio_url?: string | null
    created_at?: string | null
}

export interface VoiceCallListResponse {
    items: CallSummary[]
}

export interface VoiceCallTranscriptResponse {
    call: CallSummary
    segments: CallTranscriptSegment[]
}
