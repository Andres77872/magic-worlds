import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { i18n } from '@/app/i18n'
import {
    CATALOG_ELDRIN,
    CATALOG_IDRIS_ES_UNACCEPTED,
    CATALOG_ORRIN_UNTESTED,
    CATALOG_SELA_LEAVING,
    PRESET_V1_GLOBAL,
    PRESET_V1_USER,
    PRESET_V1_WITH_DRAFT,
    PRESET_V2_GLOBAL,
    PRESET_V2_USER,
    VOICE_KEY_ELDRIN,
    VOICE_KEY_IDRIS,
    VOICE_KEY_MAREN,
    VOICE_KEY_SELA,
    catalogVoice,
    effectiveVoice,
} from './fixtures'
import { buildPresetEditHash, parsePresetEditHash } from './presetLinks'
import {
    baseVoiceBadges,
    conversionDraftOf,
    editorModeFor,
    editorSeed,
    emotionEffectLabel,
    isDefaultRecipe,
    isFreeSamplePreview,
    presetCatalogKey,
    presetCatalogKeys,
    presetLanguage,
    presetRowBadges,
    presetVoiceKeys,
    previewableLanguages,
    previewSampleUrl,
    studioPreviewLanguage,
    v2PreviewLanguage,
    VOICE_EMOTIONS,
} from './presetRowsV2'
import { voiceWriteErrorCode, voiceWriteErrorMessage } from './voiceWriteError'

const t = i18n.getFixedT('en') as TFunction

describe('preset rows (R1-FE-02, EP-4)', () => {
    it('reads the conversion draft of a V1 row only', () => {
        expect(conversionDraftOf(PRESET_V1_WITH_DRAFT)?.voice_key).toBe(VOICE_KEY_SELA)
        expect(conversionDraftOf(PRESET_V1_USER)).toBeNull()
        expect(conversionDraftOf(PRESET_V1_GLOBAL)).toBeNull()
        expect(conversionDraftOf(PRESET_V2_USER)).toBeNull()
    })

    it('maps each row kind to its editor action', () => {
        expect(editorModeFor(PRESET_V2_USER)).toBe('edit')
        expect(editorModeFor(PRESET_V2_GLOBAL)).toBe('duplicate')
        expect(editorModeFor(PRESET_V1_WITH_DRAFT)).toBe('convert')
        expect(editorModeFor(PRESET_V1_USER)).toBeNull()
        expect(editorModeFor(PRESET_V1_GLOBAL)).toBeNull()
        expect(editorModeFor({ ...PRESET_V1_WITH_DRAFT, is_global: true })).toBe('duplicate')
    })

    it('seeds the editor: edit and convert keep the name, duplicate renames', () => {
        expect(editorSeed('edit', PRESET_V2_USER, t)).toEqual({
            name: 'Harbour master',
            description: 'Gruff but kind.',
            voiceKey: VOICE_KEY_ELDRIN,
            voiceName: 'Eldrin',
            settings: { stability: 0.4, similarity_boost: 0.8, speed: 0.95 },
            emotion: 'calm',
        })
        expect(editorSeed('convert', PRESET_V1_WITH_DRAFT, t)).toMatchObject({ name: 'My pirate', voiceKey: VOICE_KEY_SELA, settings: { speed: 1.1 } })
        expect(editorSeed('duplicate', PRESET_V2_GLOBAL, t)).toMatchObject({ name: 'Fireside narrator (copy)', voiceKey: VOICE_KEY_MAREN, settings: null })
        expect(editorSeed('create', PRESET_V2_USER, t)).toMatchObject({ name: '', voiceKey: null })
    })

    it('lists every referenced voice key once', () => {
        expect(presetVoiceKeys([PRESET_V2_USER, PRESET_V2_GLOBAL, PRESET_V1_WITH_DRAFT, PRESET_V1_USER, { ...PRESET_V2_USER, preset_id: 'dup' }]))
            .toEqual([VOICE_KEY_ELDRIN, VOICE_KEY_MAREN, VOICE_KEY_SELA])
    })

    it('merges projection, catalog and review badges', () => {
        expect(presetRowBadges(PRESET_V2_USER, null)).toEqual([])
        expect(presetRowBadges({ ...PRESET_V2_USER, effective_voice: effectiveVoice({ badges: ['replaced'] }) }, CATALOG_SELA_LEAVING, true))
            .toEqual(['replaced', 'leaving', 'review'])
        expect(presetRowBadges(PRESET_V2_USER, catalogVoice({ status: 'removed' }))).toEqual(['retired'])
        expect(presetRowBadges(PRESET_V2_USER, catalogVoice({ status: 'blocked', locked: true }))).toEqual(['needs_reselect', 'locked'])
    })

    it('derives not_tested_language from the preset language (05 §5.5, §7.7)', () => {
        expect(presetRowBadges(PRESET_V2_USER, CATALOG_ORRIN_UNTESTED, false, 'es')).toEqual(['not_tested_language'])
        expect(presetRowBadges(PRESET_V2_USER, CATALOG_ORRIN_UNTESTED, false, 'en-GB')).toEqual([])
        expect(presetRowBadges(PRESET_V2_USER, CATALOG_ORRIN_UNTESTED, false, null)).toEqual([])
        expect(presetRowBadges(PRESET_V2_USER, null, false, 'es')).toEqual([])
        // The preset's own language first, else the preferred one.
        expect(presetLanguage({ ...PRESET_V2_USER, language_code: 'fr' }, 'es')).toBe('fr')
        expect(presetLanguage(PRESET_V2_USER, 'es')).toBe('es')
        expect(presetLanguage(PRESET_V1_WITH_DRAFT, null)).toBeNull()
        expect(presetLanguage(null, 'en')).toBe('en')
        // A V1 row: its conversion draft's language (filled from the stored V1 language).
        expect(presetLanguage({ ...PRESET_V1_WITH_DRAFT, conversion_draft: { ...PRESET_V1_WITH_DRAFT.conversion_draft!, language_code: 'en' } }, 'es')).toBe('en')
    })

    it('treats a language row without an acceptance pass as not tested (05 §5.5)', () => {
        expect(presetRowBadges(PRESET_V2_USER, CATALOG_IDRIS_ES_UNACCEPTED, false, 'es')).toEqual(['not_tested_language'])
        expect(baseVoiceBadges(CATALOG_IDRIS_ES_UNACCEPTED, 'es')).toEqual(['not_tested_language'])
        expect(previewableLanguages(CATALOG_IDRIS_ES_UNACCEPTED)).toEqual(['en'])
        expect(previewableLanguages(CATALOG_ELDRIN)).toEqual(['en', 'es'])
        expect(v2PreviewLanguage(CATALOG_IDRIS_ES_UNACCEPTED, 'es')).toBe('en')
    })

    it('derives a V1 card’s language badge from the voice its projection plays (05 §7.7)', () => {
        const projected = { ...PRESET_V1_WITH_DRAFT, effective_voice: effectiveVoice({ voice_key: VOICE_KEY_IDRIS, display_name: 'Idris', badges: ['replaced'] }) }
        expect(presetCatalogKey(projected)).toBe(VOICE_KEY_IDRIS)
        expect(presetCatalogKey(PRESET_V1_WITH_DRAFT)).toBeNull()
        expect(presetCatalogKey(PRESET_V2_USER)).toBe(VOICE_KEY_ELDRIN)
        expect(presetCatalogKeys([PRESET_V2_USER, projected])).toEqual([VOICE_KEY_ELDRIN, VOICE_KEY_SELA, VOICE_KEY_IDRIS])
        // The projection carries the state badges; the catalog adds only the language check.
        expect(presetRowBadges(projected, catalogVoice({ ...CATALOG_IDRIS_ES_UNACCEPTED, status: 'blocked' }), false, 'es')).toEqual(['replaced', 'not_tested_language'])
        expect(presetRowBadges(projected, CATALOG_IDRIS_ES_UNACCEPTED, false, 'en')).toEqual(['replaced'])
    })

    it('defaults the Studio preview to language_code, then primary, then preferred, among accepted languages (05 §5.5, D17)', () => {
        const sources = { fallback: 'es' }
        // The preset's own language when the voice accepts it.
        expect(studioPreviewLanguage(CATALOG_ELDRIN, { ...sources, languageCode: 'es', preferredLanguage: 'en' })).toBe('es')
        // No language_code: the voice's primary language, never the interface one.
        expect(studioPreviewLanguage(CATALOG_ELDRIN, { ...sources, languageCode: null, preferredLanguage: 'es' })).toBe('en')
        // An unaccepted language_code falls through to the primary language.
        expect(studioPreviewLanguage(CATALOG_IDRIS_ES_UNACCEPTED, { ...sources, languageCode: 'es' })).toBe('en')
        // Primary not accepted: the preferred language when accepted, else the first accepted one.
        const spanishOnly = catalogVoice({ primary_language: 'fr', languages: [CATALOG_ELDRIN.languages[1]] })
        expect(studioPreviewLanguage(spanishOnly, { fallback: 'en', preferredLanguage: 'es' })).toBe('es')
        expect(studioPreviewLanguage(spanishOnly, { fallback: 'en', preferredLanguage: 'en' })).toBe('es')
        // Before the catalog item loads: the same order without the check, the fallback last.
        expect(studioPreviewLanguage(null, { fallback: 'es', languageCode: 'en' })).toBe('en')
        expect(studioPreviewLanguage(null, { fallback: 'es', preferredLanguage: 'en' })).toBe('en')
        expect(studioPreviewLanguage(null, { fallback: 'es' })).toBe('es')
    })

    it('gives the editor’s base voice its catalog and state badges', () => {
        expect(baseVoiceBadges(CATALOG_SELA_LEAVING, 'en')).toEqual(['leaving'])
        expect(baseVoiceBadges(CATALOG_ORRIN_UNTESTED, 'es')).toEqual(['not_tested_language'])
        expect(baseVoiceBadges(catalogVoice({ status: 'removed' }))).toEqual(['retired'])
        expect(baseVoiceBadges(catalogVoice({ status: 'hidden', locked: true, min_plan: 'pro' }))).toEqual(['locked', 'needs_reselect'])
    })

    it('labels every emotion by its effect, in en and es (05 §5.3)', () => {
        const es = i18n.getFixedT('es') as TFunction
        expect(emotionEffectLabel('happy', t)).toBe('Happy: adds a cheerful delivery')
        for (const emotion of VOICE_EMOTIONS) {
            expect(emotionEffectLabel(emotion, t)).toMatch(/^[A-Z][a-z]+: adds /)
            expect(emotionEffectLabel(emotion, es)).toMatch(/: añade /)
        }
    })

    it('previews in the app language when the voice speaks it, else its own', () => {
        expect(v2PreviewLanguage(CATALOG_ELDRIN, 'es')).toBe('es')
        expect(v2PreviewLanguage(CATALOG_ORRIN_UNTESTED, 'es')).toBe('en')
        expect(v2PreviewLanguage(null, 'es', 'en')).toBe('en')
        expect(v2PreviewLanguage(null, 'es')).toBe('es')
    })
})

describe('preset deep link', () => {
    it('round-trips the preset id on the studio hash', () => {
        const hash = buildPresetEditHash('user v2/1')
        expect(hash.startsWith('#/voices?')).toBe(true)
        expect(parsePresetEditHash(hash)).toBe('user v2/1')
        expect(parsePresetEditHash('#/voices')).toBeNull()
        expect(parsePresetEditHash('#/gallery?preset=x')).toBeNull()
    })
})

describe('voice write refusals (I-36)', () => {
    it('reads the code from the error or its details', () => {
        expect(voiceWriteErrorCode({ status: 422, code: 'voice_plan_locked' })).toBe('voice_plan_locked')
        expect(voiceWriteErrorCode({ status: 422, details: { code: 'voice_invalid' } })).toBe('voice_invalid')
        expect(voiceWriteErrorCode(new Error('boom'))).toBeNull()
        expect(voiceWriteErrorCode(null)).toBeNull()
    })

    it('translates known codes only', () => {
        expect(voiceWriteErrorMessage({ code: 'voice_plan_locked' }, t)).toBe(t('voices.errors.planLocked'))
        expect(voiceWriteErrorMessage({ code: 'workspace_archived' }, t)).toBeNull()
    })
})

describe('free sample vs paid render (AC-P5, 05 §6.1 default-settings shortcut)', () => {
    const url = (language: string, tier: string) => `/voices/catalog/${VOICE_KEY_ELDRIN}/preview.mp3?lang=${language}&tier=${tier}&h=abc`
    const entry = (language: string, sample: string | null) => ({ language, native: language === 'en', accent: null, accepted_models: ['standard' as const], sample_url: sample as string })

    it('counts null and empty settings without an emotion as the defaults', () => {
        expect(isDefaultRecipe(null, null)).toBe(true)
        expect(isDefaultRecipe({}, null)).toBe(true)
        expect(isDefaultRecipe(undefined, undefined)).toBe(true)
        expect(isDefaultRecipe({ stability: 0.5 }, null)).toBe(false)
        expect(isDefaultRecipe(null, 'calm')).toBe(false)
    })

    it('mirrors choose_sample: the language on the asked tier or Standard, else the primary language on Standard', () => {
        const item = catalogVoice({ primary_language: 'en', languages: [entry('en', url('en', 'standard')), entry('es', url('es', 'expressive'))] })
        expect(previewSampleUrl(item, 'en', 'expressive')).toBe(url('en', 'standard'))
        expect(previewSampleUrl(item, 'es-MX', 'expressive')).toBe(url('es', 'expressive'))
        // Spanish only on Expressive: a Standard ask falls back to the primary language's Standard sample.
        expect(previewSampleUrl(item, 'es', 'standard')).toBe(url('en', 'standard'))
        // No row for the language: the primary language's Standard sample.
        expect(previewSampleUrl(item, 'fr', 'standard')).toBe(url('en', 'standard'))
        // A URL without a tier is a Standard one (the catalog lists Standard first).
        expect(previewSampleUrl(CATALOG_ELDRIN, 'es')).toBe(CATALOG_ELDRIN.languages[1].sample_url)
    })

    it('finds none when the server would render', () => {
        expect(previewSampleUrl(null, 'en')).toBeNull()
        expect(previewSampleUrl(catalogVoice({ languages: [entry('en', null)] }), 'en')).toBeNull()
        // The primary language only counts on Standard.
        const expressiveOnly = catalogVoice({ primary_language: 'en', languages: [entry('en', url('en', 'expressive'))] })
        expect(previewSampleUrl(expressiveOnly, 'es', 'expressive')).toBeNull()
        expect(previewSampleUrl(expressiveOnly, 'en', 'expressive')).toBe(url('en', 'expressive'))
        // Another language's sample is never served (unlike the picker row's audition fallback).
        const otherOnly = catalogVoice({ primary_language: 'en', languages: [entry('de', url('de', 'standard'))] })
        expect(previewSampleUrl(otherOnly, 'fr')).toBeNull()
    })

    it('is free only for a default recipe whose voice has that sample', () => {
        expect(isFreeSamplePreview(null, null, CATALOG_ELDRIN, 'en')).toBe(true)
        expect(isFreeSamplePreview({}, null, CATALOG_ELDRIN, 'en')).toBe(true)
        expect(isFreeSamplePreview(PRESET_V2_USER.settings, null, CATALOG_ELDRIN, 'en')).toBe(false)
        expect(isFreeSamplePreview(null, 'calm', CATALOG_ELDRIN, 'en')).toBe(false)
        // The catalog item is not in yet, or the voice has no sample: a render.
        expect(isFreeSamplePreview(null, null, undefined, 'en')).toBe(false)
        expect(isFreeSamplePreview(null, null, catalogVoice({ languages: [entry('en', null)] }), 'en')).toBe(false)
    })
})
