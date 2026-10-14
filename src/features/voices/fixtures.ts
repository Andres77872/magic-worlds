/**
 * Test and story fixtures for the voice UI (R1-FE-01/02/03). Never imported
 * by the application. Capabilities are derived from the real BFF body
 * (`BFF_R0_BODY`) so ranges, steps and defaults are the server's, not ours.
 * Stored V1 values come from the shared legacy-row fixtures (`src/test/fixtures`).
 */
import type {
    CatalogVoice,
    CharacterVoiceLegacyV1,
    CharacterVoiceV2,
    EffectiveVoice,
    NarrationTier,
    VoiceCapabilities,
    VoicePreset,
    VoicePresetV2,
    VoiceReviewFlag,
    VoiceSubstitutionReason,
} from '@/shared'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_R0_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import { LEGACY_V1_PRESET, LEGACY_V1_VOICE, LEGACY_V1_VOICE_ID } from '@/test/fixtures/legacyMinimax'

export const VOICE_KEY_ELDRIN = 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f'
export const VOICE_KEY_MAREN = 'vk_0a1b2c3d4e5f60718293a4b5c6d7e8f9'
export const VOICE_KEY_TOBIAS = 'vk_1111aaaa2222bbbb3333cccc4444dddd'
export const VOICE_KEY_SELA = 'vk_9f8e7d6c5b4a39281706f5e4d3c2b1a0'
export const VOICE_KEY_ORRIN = 'vk_abcdefabcdefabcdefabcdefabcdef01'
export const VOICE_KEY_IDRIS = 'vk_5a5a5a5a6b6b6b6b7c7c7c7c8d8d8d8d'

export const V2_VOICE: CharacterVoiceV2 = {
    schema_version: 2,
    provider: 'elevenlabs',
    voice_key: VOICE_KEY_ELDRIN,
    voice_name: 'Eldrin',
    settings: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
    emotion: null,
    language_code: null,
}

/** A stored V1 voice: the padded id is kept byte-identical on writes (D32). */
export const V1_VOICE: CharacterVoiceLegacyV1 = {
    ...LEGACY_V1_VOICE,
    voice_id: ` ${LEGACY_V1_VOICE_ID} `,
    pitch: 2,
    preset_id: 'global-child-girl',
    preset_name: 'Child girl',
}

export function effectiveVoice(overrides: Partial<EffectiveVoice> = {}): EffectiveVoice {
    return {
        voice_key: VOICE_KEY_ELDRIN,
        display_name: 'Eldrin',
        provider_route: 'elevenlabs',
        substitution_reason: null,
        flags: [],
        badges: [],
        ...overrides,
    }
}

const REASON_BADGES: Partial<Record<VoiceSubstitutionReason, EffectiveVoice['badges']>> = {
    voice_removed: ['replaced'],
    voice_blocked: ['replaced'],
    voice_unavailable: ['replaced'],
    unmapped_legacy: ['replaced', 'review'],
    language_unsupported: ['replaced'],
    tier_fallback: ['standard_fallback'],
    not_call_eligible: ['call_voice'],
}

/** One ElevenLabs projection per substitution reason (replacement voice "Maren"). */
export const EFFECTIVE_BY_REASON: Record<VoiceSubstitutionReason, EffectiveVoice> = Object.fromEntries(
    ([
        'unmapped_legacy', 'voice_removed', 'voice_unavailable', 'voice_blocked',
        'not_call_eligible', 'default_voice', 'distinct_voice', 'language_unsupported', 'tier_fallback',
    ] as VoiceSubstitutionReason[]).map((reason) => [
        reason,
        effectiveVoice({ voice_key: VOICE_KEY_MAREN, display_name: 'Maren', substitution_reason: reason, badges: REASON_BADGES[reason] ?? [] }),
    ]),
) as Record<VoiceSubstitutionReason, EffectiveVoice>

export function catalogVoice(overrides: Partial<CatalogVoice> = {}): CatalogVoice {
    return {
        voice_key: VOICE_KEY_ELDRIN,
        display_name: 'Eldrin',
        description: 'A warm, unhurried storyteller.',
        gender: 'male',
        age: 'middle_aged',
        accent: 'british',
        primary_language: 'en',
        languages: [
            { language: 'en', native: true, accent: 'british', accepted_models: ['standard', 'expressive'], sample_url: `/voices/catalog/${VOICE_KEY_ELDRIN}/preview.mp3?language=en` },
            { language: 'es', native: false, accent: null, accepted_models: ['standard'], sample_url: `/voices/catalog/${VOICE_KEY_ELDRIN}/preview.mp3?language=es` },
        ],
        tags: ['narration', 'calm'],
        house_voice: false,
        call_eligible: true,
        status: 'active',
        disable_at: null,
        locked: false,
        min_plan: null,
        replacement: null,
        ...overrides,
    }
}

export const CATALOG_ELDRIN = catalogVoice()
export const CATALOG_MAREN_HOUSE = catalogVoice({
    voice_key: VOICE_KEY_MAREN,
    display_name: 'Maren',
    description: 'Bright and quick, a tavern regular.',
    gender: 'female',
    age: 'young',
    house_voice: true,
    languages: [{ language: 'en', native: true, accent: 'american', accepted_models: ['standard'], sample_url: `/voices/catalog/${VOICE_KEY_MAREN}/preview.mp3` }],
})
export const CATALOG_TOBIAS_LOCKED = catalogVoice({
    voice_key: VOICE_KEY_TOBIAS,
    display_name: 'Tobias',
    description: 'A gravel-voiced harbour master.',
    locked: true,
    min_plan: 'plus',
})
export const CATALOG_SELA_LEAVING = catalogVoice({
    voice_key: VOICE_KEY_SELA,
    display_name: 'Sela',
    description: 'Soft-spoken, from the northern isles.',
    status: 'deprecating',
    disable_at: '2026-12-01T00:00:00Z',
    replacement: { voice_key: VOICE_KEY_MAREN, display_name: 'Maren' },
})
export const CATALOG_ORRIN_UNTESTED = catalogVoice({
    voice_key: VOICE_KEY_ORRIN,
    display_name: 'Orrin',
    description: 'Only tuned for English.',
    languages: [{ language: 'en', native: true, accent: null, accepted_models: ['standard'], sample_url: `/voices/catalog/${VOICE_KEY_ORRIN}/preview.mp3` }],
})

/**
 * A Spanish row the BFF lists without an acceptance pass (models or a sample
 * only, `accepted_models: []`): not an accepted language (05 §5.5).
 */
export const CATALOG_IDRIS_ES_UNACCEPTED = catalogVoice({
    voice_key: VOICE_KEY_IDRIS,
    display_name: 'Idris',
    description: 'A lighthouse keeper with a slow, low voice.',
    languages: [
        { language: 'en', native: true, accent: null, accepted_models: ['standard'], sample_url: `/voices/catalog/${VOICE_KEY_IDRIS}/preview.mp3?language=en` },
        { language: 'es', native: false, accent: null, accepted_models: [], sample_url: `/voices/catalog/${VOICE_KEY_IDRIS}/preview.mp3?language=es` },
    ],
})

export const CATALOG_PAGE: CatalogVoice[] = [CATALOG_ELDRIN, CATALOG_MAREN_HOUSE, CATALOG_TOBIAS_LOCKED, CATALOG_SELA_LEAVING, CATALOG_ORRIN_UNTESTED]

export const REVIEW_FLAG_CARD: VoiceReviewFlag = {
    flag_id: 11,
    ref_type: 'card',
    ref_id: 'card-1',
    json_path: 'voice',
    flags: ['pitch_dropped', 'vol_dropped'],
    created_at: '2026-10-01T10:00:00Z',
    organization: { workspace_id: '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b' },
}

export const REVIEW_FLAG_PRESET: VoiceReviewFlag = {
    flag_id: 12,
    ref_type: 'preset',
    ref_id: 'user-1',
    json_path: 'voice',
    flags: ['speed_clamped'],
    created_at: null,
    organization: null,
}

export const PRESET_V2_USER: VoicePresetV2 = {
    preset_id: 'user-v2',
    name: 'Harbour master',
    description: 'Gruff but kind.',
    voice_key: VOICE_KEY_ELDRIN,
    voice_name: 'Eldrin',
    settings: { stability: 0.4, similarity_boost: 0.8, speed: 0.95 },
    emotion: 'calm',
    language_code: null,
    is_global: false,
    schema_version: 2,
    provider: 'elevenlabs',
}

export const PRESET_V2_GLOBAL: VoicePresetV2 = {
    preset_id: 'global-v2',
    name: 'Fireside narrator',
    description: 'The house storyteller.',
    voice_key: VOICE_KEY_MAREN,
    voice_name: 'Maren',
    settings: null,
    emotion: null,
    language_code: 'en',
    is_global: true,
    schema_version: 2,
    provider: 'elevenlabs',
}

export const PRESET_V1_USER: VoicePreset = {
    ...LEGACY_V1_PRESET,
    preset_id: 'user-1',
    name: 'My pirate',
    base_voice_name: 'Radiant girl',
    speed: 1.1,
    pitch: 2,
}

/** A V1 row as an elevenlabs caller reads it (EP-4): with its V2 conversion draft. */
export const PRESET_V1_WITH_DRAFT: VoicePreset = {
    ...PRESET_V1_USER,
    conversion_draft: {
        name: 'My pirate',
        description: null,
        voice_key: VOICE_KEY_SELA,
        voice_name: 'Sela',
        settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.1 },
        emotion: null,
        language_code: null,
        is_global: false,
        schema_version: 2,
        provider: 'elevenlabs',
    },
    conversion_flags: ['pitch_dropped'],
}

export const PRESET_V1_GLOBAL: VoicePreset = {
    ...LEGACY_V1_PRESET,
    preset_id: 'global-old-man',
    name: 'Old man',
    description: 'Deep, weathered elder.',
    base_voice_id: 'English_magnetic_voiced_man',
    base_voice_name: 'Magnetic-voiced man',
    speed: 0.9,
    pitch: -5,
    emotion: 'calm',
    is_global: true,
    conversion_draft: null,
    conversion_flags: [],
}

type Plan = 'free' | 'plus' | 'pro'

/** Capabilities for a plan, from the BFF body (I-32: Free is Standard only). */
export function capabilitiesFor(plan: Plan, narrationTier: NarrationTier = 'standard'): VoiceCapabilities {
    const tiers: NarrationTier[] = plan !== 'free' ? ['standard', 'expressive'] : ['standard']
    const capabilities = toVoiceCapabilities({
        ...BFF_R0_BODY,
        tiers_allowed: tiers,
        narration_tier: narrationTier,
    })
    if (!capabilities) throw new Error('The R0 capabilities fixture no longer parses.')
    return capabilities
}

export const CAPABILITIES_EL_FREE = capabilitiesFor('free')
export const CAPABILITIES_EL_PLUS = capabilitiesFor('plus')
export const CAPABILITIES_EL_PRO = capabilitiesFor('pro', 'expressive')
