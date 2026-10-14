/**
 * Voice callbot transport contracts.
 *
 * These types intentionally live outside interaction.types.ts so the existing
 * text ChatSocket remains text/control-only. Client JSON frames carry lifecycle,
 * VAD, segment metadata, and barge-in controls only. Microphone bytes are sent
 * through the authenticated segment upload endpoint, never as VoiceSocket JSON
 * payloads and never through ChatSocket.
 */

import type { EffectiveVoice, VoiceSubstitutionReason } from './voiceCatalog.types'

export type VoiceAudioEncoding = 'audio/wav;codec=pcm_s16le'

/** Assistant MP3 sample rates (D08). */
export type VoiceAudioSampleRate = 22050 | 24000 | 44100

/**
 * The assistant audio format a call announces in `voice_ready.audio` (WS-S1):
 * `audio/mpeg`, `mp3`, 44100, mono. A frame without it (an older BFF build) plays
 * that default format. Untrusted on read: the playback guard re-checks every field.
 */
export interface VoiceAudioFormat {
    content_type: string
    codec: string
    sample_rate: VoiceAudioSampleRate
    channels: 1
}

export type VoiceVadSource = 'audio_worklet'

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
        audio: VoiceAudioPreferences
        capabilities: VoiceClientCapabilities
    }
    | { type: 'voice_resume'; voice_session_id: string; last_segment_seq: number }
    | {
        type: 'voice_barge_in'
        reason: 'barge_in'
        /**
         * WS-C1: the interrupted turn and how much of it played; sent whenever a
         * turn was playing. A bare frame (no turn) is still valid.
         */
        turn_id?: string
        played_ms?: number
    }
    /**
     * WS-C2: playback progress of the current turn, at most every 500 ms (R-22).
     * The server answers nothing.
     */
    | { type: 'voice_playback'; turn_id: string; played_ms: number }
    | { type: 'voice_end'; reason: 'user' }
    | { type: 'voice_ping'; voice_session_id?: string }

export interface VoiceCallLimits {
    max_call_seconds: number
    idle_timeout_seconds: number
    remaining_daily_seconds: number
    remaining_voice_credits?: number
    seconds_per_credit?: number
    /** Longest segment the server accepts; the VAD cuts a little before it. */
    max_segment_duration_ms?: number
}

/** Why the server ended a call (`voice_ended.reason`). */
export type VoiceEndReason =
    | 'user'
    | 'quota'
    | 'superseded'
    | 'disconnected'
    | 'idle_timeout'
    | 'max_duration'
    | 'server_shutdown'
    /** WS-S5: an operator restriction or a safety pause ended the call. */
    | 'voice_restricted'

export type VoiceCancelReason = 'barge_in' | 'end_call' | 'superseded' | 'provider_disconnected'

export type VoiceSocketServerFrame =
    | {
        type: 'voice_ready'
        voice_session_id: string
        server_time_ms: number
        limits: VoiceCallLimits
        upload_url: string
        /** WS-S1: the assistant audio format. Optional on read (an older BFF build): mp3 44.1 kHz is assumed. */
        audio?: VoiceAudioFormat
        /** WS-S1: the voice the call speaks with (strict `EffectiveVoice`). */
        effective_voice?: EffectiveVoice
        /** WS-S1: the card voice's name when it was replaced (REPLACED_REASONS only), else null. */
        original_voice_name?: string | null
        /** WS-S1 provenance (R-5). The AI voice label never reads it (P-10). */
        ai_voice?: boolean
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
        /** Optional on read so frames from older BFF builds still parse. */
        codec?: 'mp3'
        sample_rate: VoiceAudioSampleRate
        channels: 1
        data_b64: string
        is_final: false
        /** Per-voice loudness gain in dB, attenuation only (D16); optional on read (older BFF builds). */
        gain_db?: number | null
        substitution_reason?: VoiceSubstitutionReason | null
    }
    | { type: 'voice_audio_final'; voice_session_id: string; turn_id: string; last_seq: number }
    | {
        type: 'voice_turn_end'
        voice_session_id: string
        turn_id: string
        status: 'completed' | 'interrupted' | 'failed'
        partial: boolean
        duration_ms: number
        /** WS-S3: the reply was cut where playback stopped. */
        truncated?: boolean
        played_ms?: number | null
        /** Characters of the reply kept (≥ 1); present only when `truncated`. */
        kept_chars?: number
    }
    | {
        type: 'voice_cancelled'
        voice_session_id: string
        turn_id?: string
        reason: VoiceCancelReason
        /** WS-S4: a post-end ElevenLabs truncation of the turn. */
        truncated?: boolean
        kept_chars?: number
        played_ms?: number | null
    }
    | { type: 'voice_error'; category: VoiceErrorCategory; code?: string; message: string; retry_after_seconds?: number; fatal?: boolean }
    | { type: 'voice_ended'; voice_session_id: string; reason: VoiceEndReason }
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
    vad: VoiceSegmentVadMetadata & {
        source: VoiceVadSource
        aggressiveness: VoiceVadAggressiveness
        /**
         * R0-BE-37: whole ms (0..120000) from the user's end of speech (the last voiced audio,
         * so the VAD silence hang-over is included) to the upload's send, on the client clock.
         * Absent for a max-length cut (see `speechEndLag.ts`).
         */
        speech_end_lag_ms?: number
    }
    audio: Blob
}

export interface VoiceSegmentUploadResponse {
    voice_session_id: string
    segment_id: string
    seq: number
    /**
     * `cancelled`: a newer utterance superseded this one before the character
     * replied (its text was merged into the next turn), or the call ended.
     */
    status: 'received' | 'accepted' | 'duplicate' | 'rejected' | 'cancelled'
    /** Rejection category (e.g. `no_speech`, `unsupported_media`) or cancel reason (`superseded`, `end_call`). */
    reason?: string
    turn_id?: string | null
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
    billable_audio_seconds?: number | null
    billed_credits?: number | null
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
