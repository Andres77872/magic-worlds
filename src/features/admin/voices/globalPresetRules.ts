/**
 * Global preset rules (R1-FE-06, 05 §8.12, EP-5): the editor's checks before a
 * write, mirroring the BFF body (`GlobalVoicePresetWrite`): a trimmed name of
 * 1..255 characters, a voice, settings inside the console ranges, and a
 * language the voice lists (when it lists any). The server stays the
 * authority: eligibility (`voice_not_eligible`) is only known on write.
 */
import { isPresetV2, type AdminCatalogVoice, type AdminGlobalPresetInput, type AdminGlobalPresetRow, type VoiceEmotion, type VoicePresetV2, type VoiceSettingsV2 } from '@/shared'
import { SETTING_RANGES, type LabSettingKey } from './constants'

export const GLOBAL_PRESET_NAME_MAX = 255
/** EP-5 allows all five settings on a global preset. */
export const GLOBAL_PRESET_SETTING_KEYS: readonly LabSettingKey[] = ['stability', 'similarity_boost', 'style', 'use_speaker_boost', 'speed']
export const GLOBAL_PRESET_EMOTIONS: readonly VoiceEmotion[] = ['calm', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised']
const LANGUAGE_CODE = /^[a-z]{2,3}$/

/** The editor's working copy; empty strings mean "not set". */
export interface GlobalPresetDraft {
    name: string
    description: string
    voice_key: string
    settings: VoiceSettingsV2 | null
    emotion: VoiceEmotion | null
    language_code: string
}

/** A V2 global row with its admin fields: the rows the console can edit and delete. */
export type GlobalPresetV2Row = VoicePresetV2 & Pick<AdminGlobalPresetRow, 'legacy_hidden' | 'voice_public' | 'seed_key'>

export type GlobalPresetField = 'name' | 'voice_key' | 'settings' | 'language_code'

export interface GlobalPresetIssue {
    field: GlobalPresetField
    /** i18n key under `admin.voices.globalPresets.rules`. */
    key: string
    values?: Record<string, string | number>
    setting?: Exclude<LabSettingKey, 'use_speaker_boost'>
}

const NUMERIC_SETTINGS = Object.keys(SETTING_RANGES) as Exclude<LabSettingKey, 'use_speaker_boost'>[]

export function emptyGlobalPresetDraft(): GlobalPresetDraft {
    return { name: '', description: '', voice_key: '', settings: null, emotion: null, language_code: '' }
}

export function draftFromPreset(preset: VoicePresetV2): GlobalPresetDraft {
    return {
        name: preset.name,
        description: preset.description ?? '',
        voice_key: preset.voice_key,
        settings: preset.settings ? { ...preset.settings } : null,
        emotion: preset.emotion ?? null,
        language_code: preset.language_code ?? '',
    }
}

/** The languages a catalog voice lists, deduplicated, in order. */
export function voiceLanguages(voice: AdminCatalogVoice | null | undefined): string[] {
    return [...new Set((voice?.languages ?? []).map((entry) => entry.language).filter(Boolean))]
}

/** Every rule the draft breaks, in field order; empty when it may be written. */
export function globalPresetIssues(draft: GlobalPresetDraft, voice?: AdminCatalogVoice | null): GlobalPresetIssue[] {
    const issues: GlobalPresetIssue[] = []
    const name = draft.name.trim()
    if (!name) issues.push({ field: 'name', key: 'nameRequired' })
    else if (name.length > GLOBAL_PRESET_NAME_MAX) issues.push({ field: 'name', key: 'nameTooLong', values: { max: GLOBAL_PRESET_NAME_MAX } })

    if (!draft.voice_key.trim()) issues.push({ field: 'voice_key', key: 'voiceRequired' })

    for (const setting of NUMERIC_SETTINGS) {
        const value = draft.settings?.[setting]
        if (value === undefined || value === null) continue
        const range = SETTING_RANGES[setting]
        if (typeof value !== 'number' || !Number.isFinite(value) || value < range.min || value > range.max) {
            issues.push({ field: 'settings', key: 'settingOutOfRange', setting, values: { min: range.min, max: range.max } })
        }
    }

    const language = draft.language_code.trim()
    if (language) {
        if (!LANGUAGE_CODE.test(language)) issues.push({ field: 'language_code', key: 'languageInvalid' })
        else {
            const listed = voiceLanguages(voice)
            if (listed.length > 0 && !listed.includes(language)) issues.push({ field: 'language_code', key: 'languageNotListed', values: { language } })
        }
    }
    return issues
}

/** Settings without empty values; null when nothing is set (the voice defaults apply). */
export function compactSettings(settings: VoiceSettingsV2 | null | undefined): VoiceSettingsV2 | null {
    if (!settings) return null
    const entries = GLOBAL_PRESET_SETTING_KEYS.flatMap((key) => {
        const value = settings[key]
        return value === undefined || value === null ? [] : [[key, value] as const]
    })
    return entries.length > 0 ? (Object.fromEntries(entries) as VoiceSettingsV2) : null
}

/** The EP-5 body for a valid draft. */
export function toGlobalPresetInput(draft: GlobalPresetDraft): AdminGlobalPresetInput {
    return {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        voice_key: draft.voice_key.trim(),
        settings: compactSettings(draft.settings),
        emotion: draft.emotion,
        language_code: draft.language_code.trim() || null,
    }
}

/** Stored V1 global rows are read-only legacy rows (D12, D22). */
export function isLegacyGlobalPreset(row: AdminGlobalPresetRow): boolean {
    return !isPresetV2(row)
}

export function isEditableGlobalPreset(row: AdminGlobalPresetRow): row is GlobalPresetV2Row {
    return isPresetV2(row)
}

export type GlobalPresetWarning = 'notPublic' | 'notActive'

/**
 * Why users could not apply the preset (05 §8.12): its voice is not public
 * (the server's `voice_public` is false, or the catalog row is not public),
 * or the voice is not active in the catalog. Applying a preset is a new pick.
 */
export function globalPresetWarnings(voice: AdminCatalogVoice | null | undefined, voicePublic?: boolean | null): GlobalPresetWarning[] {
    const warnings: GlobalPresetWarning[] = []
    if (voicePublic === false || (voice && voice.visibility !== 'public')) warnings.push('notPublic')
    if (voice && voice.status !== 'active') warnings.push('notActive')
    return warnings
}
