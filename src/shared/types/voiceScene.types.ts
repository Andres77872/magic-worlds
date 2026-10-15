/** Owned whole-scene alternative; offsets refer to unannotated Unicode text. */
export interface SceneManifest {
    version: 1
    offset_unit: 'unicode_code_points'
    language: 'en' | 'es'
    logical_text_sha256: string
    identity_sha256: string
    cast: {
        speaker_index: number
        speaker_id: string | null
        speaker_name: string | null
        voice_key: string
        voice_name: string | null
        gain_db: number
    }[]
    utterances: {
        clip_index: number
        speaker_index: number
        kind: 'narrator' | 'speech'
        logical_start: number
        logical_end: number
        text_sha256: string
    }[]
    playback_gain_db: number
}

export interface SceneNarrationRequest {
    assistant_message_id: number
    turn_id: string
}
