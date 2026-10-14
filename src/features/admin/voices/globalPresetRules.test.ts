import { describe, expect, it } from 'vitest'
import type { AdminGlobalPresetRow, VoicePresetV2 } from '@/shared'
import { draftVoice, makeCatalogVoice, readyVoice } from './fixtures'
import {
    compactSettings,
    draftFromPreset,
    emptyGlobalPresetDraft,
    GLOBAL_PRESET_NAME_MAX,
    globalPresetIssues,
    globalPresetWarnings,
    isLegacyGlobalPreset,
    toGlobalPresetInput,
    type GlobalPresetDraft,
} from './globalPresetRules'

const draft = (overrides: Partial<GlobalPresetDraft> = {}): GlobalPresetDraft => ({
    ...emptyGlobalPresetDraft(),
    name: 'Calm narrator',
    voice_key: readyVoice.voice_key,
    ...overrides,
})

const keys = (value: GlobalPresetDraft, voice = readyVoice) => globalPresetIssues(value, voice).map((issue) => `${issue.field}:${issue.key}`)

const V2: VoicePresetV2 = {
    preset_id: 'gp-1',
    name: 'Calm narrator',
    description: null,
    voice_key: readyVoice.voice_key,
    voice_name: 'Maren',
    settings: { stability: 0.4 },
    emotion: 'calm',
    language_code: 'en',
    is_global: true,
    schema_version: 2,
    provider: 'elevenlabs',
}

describe('globalPresetRules (EP-5)', () => {
    it('accepts a valid draft', () => {
        expect(keys(draft({ settings: { stability: 0, similarity_boost: 1, style: 0.5, speed: 1.2, use_speaker_boost: true }, language_code: 'en' }))).toEqual([])
    })

    it('requires a trimmed name of 1..255 characters', () => {
        expect(keys(draft({ name: '   ' }))).toEqual(['name:nameRequired'])
        expect(keys(draft({ name: ` ${'a'.repeat(GLOBAL_PRESET_NAME_MAX)} ` }))).toEqual([])
        expect(globalPresetIssues(draft({ name: 'a'.repeat(GLOBAL_PRESET_NAME_MAX + 1) }), readyVoice)).toEqual([
            { field: 'name', key: 'nameTooLong', values: { max: 255 } },
        ])
    })

    it('requires a voice', () => {
        expect(keys(draft({ voice_key: ' ' }), undefined)).toEqual(['voice_key:voiceRequired'])
    })

    it('keeps every setting inside the console ranges', () => {
        expect(globalPresetIssues(draft({ settings: { stability: 1.05, speed: 0.65, style: Number.NaN } }), readyVoice)).toEqual([
            { field: 'settings', key: 'settingOutOfRange', setting: 'stability', values: { min: 0, max: 1 } },
            { field: 'settings', key: 'settingOutOfRange', setting: 'style', values: { min: 0, max: 1 } },
            { field: 'settings', key: 'settingOutOfRange', setting: 'speed', values: { min: 0.7, max: 1.2 } },
        ])
        expect(keys(draft({ settings: { stability: null, speed: undefined } }))).toEqual([])
    })

    it('takes a language among the voice languages, when the voice lists any', () => {
        expect(keys(draft({ language_code: 'es' }))).toEqual(['language_code:languageNotListed'])
        expect(keys(draft({ language_code: 'EN' }))).toEqual(['language_code:languageInvalid'])
        const unlisted = makeCatalogVoice({ languages: [] })
        expect(keys(draft({ language_code: 'es' }), unlisted)).toEqual([])
        expect(keys(draft({ language_code: '' }))).toEqual([])
    })

    it('builds the EP-5 body: trimmed, empty values as null, empty settings as null', () => {
        expect(toGlobalPresetInput(draft({ name: '  Calm  ', description: '  ', settings: { stability: null }, language_code: ' en ' }))).toEqual({
            name: 'Calm',
            description: null,
            voice_key: readyVoice.voice_key,
            settings: null,
            emotion: null,
            language_code: 'en',
        })
        expect(compactSettings({ stability: 0.5, use_speaker_boost: false, speed: null })).toEqual({ stability: 0.5, use_speaker_boost: false })
    })

    it('round-trips a V2 preset into a draft', () => {
        expect(toGlobalPresetInput(draftFromPreset(V2))).toEqual({
            name: 'Calm narrator',
            description: null,
            voice_key: readyVoice.voice_key,
            settings: { stability: 0.4 },
            emotion: 'calm',
            language_code: 'en',
        })
    })

    it('labels V1 rows as legacy', () => {
        const extra = { legacy_hidden: false, voice_public: null, seed_key: null }
        const v1 = { preset_id: 'v1', name: 'Old', base_voice_id: 'English_Warm', speed: 1, volume: 1, pitch: 0, is_global: true, ...extra } as AdminGlobalPresetRow
        expect(isLegacyGlobalPreset(v1)).toBe(true)
        expect(isLegacyGlobalPreset({ ...V2, ...extra })).toBe(false)
    })

    it('warns when users could not apply the preset', () => {
        expect(globalPresetWarnings(readyVoice, true)).toEqual([])
        expect(globalPresetWarnings(readyVoice, false)).toEqual(['notPublic'])
        expect(globalPresetWarnings(makeCatalogVoice({ status: 'active', visibility: 'plan_gated' }))).toEqual(['notPublic'])
        expect(globalPresetWarnings(draftVoice)).toEqual(['notPublic', 'notActive'])
        expect(globalPresetWarnings(makeCatalogVoice({ status: 'deprecating', visibility: 'public' }))).toEqual(['notActive'])
        expect(globalPresetWarnings(undefined, null)).toEqual([])
    })
})
