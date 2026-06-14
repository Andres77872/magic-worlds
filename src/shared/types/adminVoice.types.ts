export type AdminVoiceQueryType = 'system' | 'voice_cloning' | 'voice_generation' | 'all'

export type AdminVoiceConcreteType = Exclude<AdminVoiceQueryType, 'all'>

export interface AdminVoiceBaseResponse {
    status_code: number
    status_msg: string
}

export interface AdminVoiceEntry {
    voice_id: string
    voice_type: AdminVoiceConcreteType
    voice_name?: string | null
    description: string[]
    created_time?: string | null
    deletable: boolean
}

export type AdminVoiceGroups = Record<AdminVoiceConcreteType, AdminVoiceEntry[]>

export interface AdminVoiceListResponse {
    voice_type: AdminVoiceQueryType
    groups: AdminVoiceGroups
    base_resp: AdminVoiceBaseResponse
}

export interface AdminVoiceDesignRequest {
    prompt: string
    preview_text: string
    voice_id?: string
}

export interface AdminVoiceDesignResponse {
    voice_id: string
    trial_audio: string
    base_resp: AdminVoiceBaseResponse
}

export interface AdminVoiceDeleteResponse {
    voice_id: string
    voice_type: Exclude<AdminVoiceConcreteType, 'system'>
    created_time?: string | null
    base_resp: AdminVoiceBaseResponse
}

/** MiniMax T2A synthesis-control value sets (mirror the backend enums). */
export type AdminVoiceModel = 'speech-2.8-hd' | 'speech-2.8-turbo'

// MiniMax t2a_v2 emotions supported across the speech-2.8 models the studio
// offers. (fluent/whisper exist only on speech-2.6 models, so they're excluded.)
export type AdminVoiceEmotion =
    | 'happy'
    | 'sad'
    | 'angry'
    | 'fearful'
    | 'disgusted'
    | 'surprised'
    | 'calm'

// pcm is omitted: raw PCM (audio/L16) cannot play in the in-browser preview.
export type AdminVoiceAudioFormat = 'mp3' | 'flac' | 'wav'

export type AdminVoiceSampleRate = 8000 | 16000 | 22050 | 24000 | 32000 | 44100

export interface AdminVoiceTestRequest {
    voice_id: string
    text: string
    /** Optional synthesis controls; omit to use MiniMax defaults (speed 1, vol 1, pitch 0, mp3 @ 32kHz). */
    model?: AdminVoiceModel
    speed?: number // 0.5–2.0
    vol?: number // >0–10
    pitch?: number // -12–12
    emotion?: AdminVoiceEmotion
    audio_format?: AdminVoiceAudioFormat
    sample_rate?: AdminVoiceSampleRate
    language_boost?: string // 'auto' | language name
}

export interface AdminVoiceTestResponse {
    voice_id: string
    audio_hex: string
    content_type: string
    file_size_bytes?: number | null
    duration_ms?: number | null
    sample_rate?: number | null
    channels?: number | null
    bitrate?: number | null
    usage_characters?: number | null
    base_resp: AdminVoiceBaseResponse
}

export type AdminVoiceClonePurpose = 'voice_clone' | 'prompt_audio'

export interface AdminVoiceCloneUploadResponse {
    file_id: number
    purpose: AdminVoiceClonePurpose
    bytes?: number | null
    filename?: string | null
    base_resp: AdminVoiceBaseResponse
}

export interface AdminVoiceClonePrompt {
    prompt_audio: number
    prompt_text: string
}

export interface AdminVoiceCloneRequest {
    file_id: number
    voice_id: string
    clone_prompt?: AdminVoiceClonePrompt
    text?: string
    model?: AdminVoiceModel
    language_boost?: string
    need_noise_reduction?: boolean
    need_volume_normalization?: boolean
}

export interface AdminVoiceCloneResponse {
    voice_id: string
    voice_type: 'voice_cloning'
    demo_audio_url?: string | null
    demo_audio_hex?: string | null
    input_sensitive: boolean
    input_sensitive_type?: number | null
    base_resp: AdminVoiceBaseResponse
}
