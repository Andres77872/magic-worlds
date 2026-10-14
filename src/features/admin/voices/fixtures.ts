/**
 * Offline fixtures for the root voice console: tests, stories and the
 * play/admin visual audit. Never imported by the application.
 */
import type {
    AcceptanceRenderResponse,
    AdminCatalogAcceptance,
    AdminCatalogVoice,
    AdminGlobalPresetList,
    AdminVoiceLimits,
    LibraryVoicePage,
    VoiceDefaultsResponse,
    VoiceDesignResponse,
} from '@/shared'

/** A silent WAV that plays without any network request. */
export const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
const SILENT_WAV_BASE64 = SILENT_WAV.slice(SILENT_WAV.indexOf(',') + 1)

const scores = { timbre: 4, naturalness: 4, emotion_tags: 4, accent: 5, artefacts: 4, consistency_vs_v4: 4 }

export function makeAcceptance(overrides: Partial<AdminCatalogAcceptance> = {}): AdminCatalogAcceptance {
    return {
        model_id: 'eleven_flash_v2_5',
        language: 'en',
        verdict: 'pass',
        scores,
        integrated_lufs: -20,
        gain_db: 0,
        script_version: 'acc-v1',
        reviewed_by_user_id: 1,
        reviewed_at: '2026-10-10T12:00:00Z',
        ...overrides,
    }
}

export function makeCatalogVoice(overrides: Partial<AdminCatalogVoice> = {}): AdminCatalogVoice {
    return {
        voice_key: 'vk_00000000000000000000000000000001',
        provider: 'elevenlabs',
        provider_voice_id: 'prov_voice_0001',
        source_kind: 'designed',
        provider_category: 'generated',
        library_voice_id: null,
        public_owner_id: null,
        parent_voice_key: null,
        provider_name: 'Eldrin narrator',
        display_name: 'Eldrin',
        description: 'A warm, unhurried fantasy narrator.',
        gender: 'male',
        age: 'middle_aged',
        accent: 'neutral',
        primary_language: 'en',
        tags: ['narrator'],
        default_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
        notice_period_days: null,
        disable_at: null,
        terms_at_add: null,
        safety_control: null,
        uses_custom_slot: true,
        status: 'draft',
        suspect_since: null,
        visibility: 'admin',
        min_plan: null,
        call_eligible: false,
        replacement_voice_key: null,
        sort_rank: 10,
        reference_count: 0,
        languages: [{ language: 'en', locale: 'en-US', accent: null, model_ids: ['eleven_flash_v2_5', 'eleven_v4'], sample_url: null }],
        acceptance: [],
        created_at: '2026-10-01T10:00:00Z',
        updated_at: '2026-10-10T12:00:00Z',
        last_synced_at: '2026-10-11T08:00:00Z',
        ...overrides,
    }
}

/** A voice that passes every publish and readiness check for English. */
export const readyVoice = makeCatalogVoice({
    voice_key: 'vk_00000000000000000000000000000002',
    display_name: 'Maren',
    provider_name: 'Maren (designed)',
    gender: 'female',
    status: 'active',
    visibility: 'public',
    call_eligible: true,
    replacement_voice_key: 'vk_00000000000000000000000000000003',
    reference_count: 42,
    languages: [{ language: 'en', locale: 'en-GB', accent: 'british', model_ids: ['eleven_flash_v2_5', 'eleven_v4'], sample_url: SILENT_WAV }],
    acceptance: [makeAcceptance(), makeAcceptance({ model_id: 'eleven_v4' })],
})

export const replacementVoice = makeCatalogVoice({
    voice_key: 'vk_00000000000000000000000000000003',
    display_name: 'Ysolde',
    provider_name: 'Ysolde',
    gender: 'female',
    status: 'active',
    visibility: 'public',
    call_eligible: true,
    replacement_voice_key: 'vk_00000000000000000000000000000002',
    languages: [{ language: 'en', locale: 'en-US', accent: null, model_ids: ['eleven_flash_v2_5', 'eleven_v4'], sample_url: SILENT_WAV }],
    acceptance: [makeAcceptance(), makeAcceptance({ model_id: 'eleven_v4' })],
})

export const draftVoice = makeCatalogVoice()

export const libraryVoice = makeCatalogVoice({
    voice_key: 'vk_00000000000000000000000000000004',
    display_name: 'Harbor watch',
    provider_name: 'Harbor watch',
    source_kind: 'library_perpetual',
    provider_category: 'professional',
    library_voice_id: 'lib_0004',
    public_owner_id: 'owner_0004',
    uses_custom_slot: false,
    notice_period_days: 4015,
    call_eligible: true,
    replacement_voice_key: 'vk_00000000000000000000000000000002',
    acceptance: [makeAcceptance()],
    languages: [{ language: 'en', locale: null, accent: null, model_ids: ['eleven_flash_v2_5'], sample_url: SILENT_WAV }],
    terms_at_add: { live_moderation_enabled: false, free_users_allowed: true, rate: 1, fiat_rate: null, voice_mixing_allowed: false },
})

export const auditCatalogVoices: AdminCatalogVoice[] = [readyVoice, replacementVoice, draftVoice, libraryVoice]

export const auditLimits: AdminVoiceLimits = {
    subscription: {
        voice_slots_used: 48,
        voice_limit: 660,
        voice_add_edit_counter: 112,
        max_voice_add_edits: 1040,
        character_count: 1_250_000,
        character_limit: 2_000_000,
        next_character_count_reset_at: '2026-11-01T00:00:00Z',
        fetched_at: '2026-10-12T07:55:00Z',
    },
    spend_today: [
        { surface: 'narration', chars: 41_000 },
        { surface: 'call', chars: 12_500 },
        { surface: 'preview', chars: 3_100 },
        { surface: 'admin', chars: 900 },
    ],
    daily_budget_chars: 100_000,
    per_key: [
        { key_name: 'narration', usage: 410_000, limit: 1_000_000, unit: null },
        { key_name: 'admin_voices', usage: 12_000, limit: 100_000, unit: null },
    ],
    sync_runs: [
        { job: 'A', status: 'ok', started_at: '2026-10-12T06:00:00Z', finished_at: '2026-10-12T06:01:10Z', mass_miss_abort: false, detail: null },
        { job: 'B', status: 'aborted', started_at: '2026-10-12T06:05:00Z', finished_at: '2026-10-12T06:05:40Z', mass_miss_abort: true, detail: null },
        { job: 'C', status: 'ok', started_at: '2026-10-12T07:55:00Z', finished_at: '2026-10-12T07:55:02Z', mass_miss_abort: false, detail: null },
    ],
}

export const auditDefaults: VoiceDefaultsResponse = {
    items: [
        { role: 'narrator', language: 'en', rank: 1, voice_key: readyVoice.voice_key, updated_by_user_id: 1, updated_at: '2026-10-10T12:00:00Z' },
        { role: 'character_fallback', language: 'en', rank: 1, voice_key: replacementVoice.voice_key, updated_by_user_id: 1, updated_at: '2026-10-10T12:00:00Z' },
    ],
    last_resort_voice_key: readyVoice.voice_key,
}

export const auditLibraryPage: LibraryVoicePage = {
    items: [
        {
            public_owner_id: 'owner_0010',
            library_voice_id: 'lib_0010',
            name: 'Old harbour master',
            description: 'Gravelly, slow and kind.',
            labels: { accent: 'irish', age: 'old', gender: 'male' },
            category: 'professional',
            notice_period_days: 4015,
            rate: 1,
            fiat_rate: null,
            free_users_allowed: true,
            live_moderation_enabled: false,
            safety_control: null,
            voice_mixing_allowed: false,
            verified_languages: [{ language: 'en', locale: 'en-IE', accent: 'irish', model_ids: ['eleven_flash_v2_5', 'eleven_v4'] }],
            preview_url: SILENT_WAV,
            catalog_voice_key: null,
        },
    ],
    page: 0,
    has_more: false,
}

export const auditRenders: AcceptanceRenderResponse = {
    voice_key: draftVoice.voice_key,
    script_version: 'acc-v1',
    items: (['eleven_flash_v2_5', 'eleven_v4'] as const).flatMap((modelId) =>
        (['narration', 'dialogue'] as const).map((scriptKind) => ({
            render_id: `${modelId}-${scriptKind}`,
            voice_key: draftVoice.voice_key,
            model_id: modelId,
            language: 'en',
            script_kind: scriptKind,
            text: 'The candle gutters low as the hidden door opens.',
            audio_url: SILENT_WAV,
            duration_ms: 2100,
            integrated_lufs: -14,
            status: 'ready' as const,
        })),
    ),
}

export const auditDesign: VoiceDesignResponse = {
    previews: [1, 2, 3].map((index) => ({
        generated_voice_id: `gen_${index}`,
        audio_base_64: SILENT_WAV_BASE64,
        media_type: 'audio/wav',
        duration_secs: 6.2,
        language: 'en',
    })),
    text: null,
}

/** Global presets (EP-5, R1-FE-06): a public preset and one on a non-public voice. */
export const auditGlobalPresets: AdminGlobalPresetList = {
    items: [
        {
            preset_id: 'gp-1',
            name: 'Calm narrator',
            description: 'Unhurried English narration.',
            voice_key: readyVoice.voice_key,
            voice_name: readyVoice.display_name,
            settings: { stability: 0.55, similarity_boost: 0.75, speed: 1 },
            emotion: 'calm',
            language_code: 'en',
            is_global: true,
            schema_version: 2,
            provider: 'elevenlabs',
            voice_public: true,
            seed_key: 'en:narrator',
        },
        {
            preset_id: 'gp-2',
            name: 'Draft archetype',
            description: null,
            voice_key: draftVoice.voice_key,
            voice_name: draftVoice.display_name,
            settings: null,
            emotion: null,
            language_code: null,
            is_global: true,
            schema_version: 2,
            provider: 'elevenlabs',
            voice_public: false,
            seed_key: null,
        },
    ],
}
