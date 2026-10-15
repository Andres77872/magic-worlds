import type { SceneNarrationResponse } from '@/infrastructure/api'

export const SCENE_FIXTURE: SceneNarrationResponse = {
    enabled: true, available: true, reason: null, max_speakers: 4, max_compiled_chars: 1200,
    counted_chars: 86, estimated_credits: 1, current_identity: 'a'.repeat(64), matches_current: false,
    job: null, manifest: null,
}

export const SAVED_SCENE_FIXTURE: SceneNarrationResponse = {
    ...SCENE_FIXTURE, matches_current: true,
    job: { job_id: 'scene-fixture', status: 'completed', status_url: '/tts/jobs/scene-fixture', result_url: '/tts/jobs/scene-fixture/result',
        assets: [{ asset_id: 'scene-audio', url: '/tts/assets/scene-audio.mp3', content_type: 'audio/mpeg', duration_ms: 11_000 }] },
    manifest: { version: 1, offset_unit: 'unicode_code_points', language: 'es', logical_text_sha256: 'b'.repeat(64), identity_sha256: 'a'.repeat(64), playback_gain_db: -3,
        cast: [{ speaker_index: 0, speaker_id: null, speaker_name: null, voice_key: `vk_${'a'.repeat(32)}`, voice_name: 'Gabriel', gain_db: -3 },
            { speaker_index: 1, speaker_id: 'captain', speaker_name: 'Captain', voice_key: `vk_${'b'.repeat(32)}`, voice_name: 'Harbour voice', gain_db: 0 }],
        utterances: [{ clip_index: 0, speaker_index: 0, kind: 'narrator', logical_start: 0, logical_end: 31, text_sha256: 'c'.repeat(64) },
            { clip_index: 1, speaker_index: 1, kind: 'speech', logical_start: 32, logical_end: 54, text_sha256: 'd'.repeat(64) }] },
}
