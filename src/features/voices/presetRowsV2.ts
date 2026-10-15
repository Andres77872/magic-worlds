/**
 * Row helpers for the Voice studio (R1-FE-02, 09 §1.3, EP-4): what a
 * `GET /voice-presets` row offers, how an editor is seeded from it, and which
 * voice badges its card shows. A user row is edited in place; a global row is
 * duplicated.
 */
import type { TFunction } from 'i18next'
import type { CatalogVoice, NarrationTier, VoiceBadgeKey, VoiceEmotion, VoicePreset, VoiceSettingsV2 } from '@/shared'
import { isElevenLabsProjection } from '@/shared/voice'
import { normalizeLanguage } from '@/app/i18n/languages'
import { acceptedLanguages, catalogBadges, speaksLanguage } from './catalogBadges'
import { baseLanguageCode } from './languageCode'
import { previewLanguage } from './previewTexts'

export type PresetEditorV2Mode = 'create' | 'edit' | 'duplicate'

/** What the editor starts from. */
export interface PresetEditorSeed {
    name: string
    description: string
    voiceKey: string | null
    voiceName: string | null
    settings: VoiceSettingsV2 | null
    emotion: VoiceEmotion | null
}

export const EMPTY_SEED: PresetEditorSeed = {
    name: '',
    description: '',
    voiceKey: null,
    voiceName: null,
    settings: null,
    emotion: null,
}

/** The seven emotions a V2 recipe can carry, in menu order (after "None"). */
export const VOICE_EMOTIONS: readonly VoiceEmotion[] = ['calm', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised']

const EMOTIONS: ReadonlySet<string> = new Set(VOICE_EMOTIONS)

export function isVoiceEmotion(value: unknown): value is VoiceEmotion {
    return typeof value === 'string' && EMOTIONS.has(value)
}

/** Emotion copy, shared with the admin console (the same seven values). */
export function emotionLabel(emotion: VoiceEmotion, t: TFunction): string {
    return t(`admin.voices.emotion.${emotion}`)
}

/** The Expressive option text: what the user will hear (05 §5.3, D13), e.g. "Happy: adds a cheerful delivery". */
export function emotionEffectLabel(emotion: VoiceEmotion, t: TFunction): string {
    return t(`voices.recipe.emotionEffect.${emotion}`)
}

/** The editor mode a row's main action opens: a user row is edited, a global row duplicated. */
export function editorModeFor(row: VoicePreset): PresetEditorV2Mode {
    return row.is_global ? 'duplicate' : 'edit'
}

/** The editor's starting values. Duplicates are renamed "{{name}} (copy)". */
export function editorSeed(mode: PresetEditorV2Mode, row: VoicePreset | null, t: TFunction): PresetEditorSeed {
    if (!row || mode === 'create') return EMPTY_SEED
    const name = mode === 'duplicate' ? t('voices.studio.v2.duplicateName', { name: row.name }) : row.name
    return {
        name,
        description: row.description ?? '',
        voiceKey: row.voice_key ?? null,
        voiceName: row.voice_name ?? null,
        settings: row.settings ?? null,
        emotion: isVoiceEmotion(row.emotion) ? row.emotion : null,
    }
}

/** Every catalog voice key the rows reference, once each (the Studio's and the picker's lookup). */
export function presetVoiceKeys(rows: readonly VoicePreset[]): string[] {
    const keys = rows.map((row) => row.voice_key).filter((key): key is string => typeof key === 'string' && key.length > 0)
    return [...new Set(keys)]
}

/** What the catalog says of a voice in use (05 §7.7 Studio column): leaving, retired, needs re-selection, locked. */
export function catalogStateBadges(item: CatalogVoice): VoiceBadgeKey[] {
    const badges: VoiceBadgeKey[] = []
    if (item.status === 'deprecating' || item.disable_at) badges.push('leaving')
    if (item.status === 'removed') badges.push('retired')
    if (item.status === 'blocked' || item.status === 'hidden') badges.push('needs_reselect')
    if (item.locked) badges.push('locked')
    return badges
}

/**
 * A card's badges: the projection's own (when the BFF sent one), then what the
 * catalog lookup says of the voice (leaving with its date, retired, needs
 * re-selection, locked), then `not_tested_language` when the preset's language
 * has no accepted row for the voice (05 §5.5, §7.7; derived here because the
 * BFF does not emit it).
 */
export function presetRowBadges(row: VoicePreset, item: CatalogVoice | null | undefined, language: string | null = null): VoiceBadgeKey[] {
    const badges: VoiceBadgeKey[] = []
    const projection = row.effective_voice
    if (isElevenLabsProjection(projection)) badges.push(...projection.badges)
    if (item) {
        badges.push(...catalogStateBadges(item))
        if (!speaksLanguage(item, language)) badges.push('not_tested_language')
    }
    return [...new Set(badges)]
}

/** The preset editor's base-voice badges: the current-row catalog badges plus its state (05 §7.7). */
export function baseVoiceBadges(item: CatalogVoice, language: string | null = null): VoiceBadgeKey[] {
    return [...new Set([...catalogBadges(item, { isCurrent: true, language }), ...catalogStateBadges(item)])]
}

/**
 * The language a preset is checked against for `not_tested_language`: its own
 * `language_code` when stored, else the account's preferred language (05 §5.5).
 */
export function presetLanguage(row: VoicePreset | null | undefined, preferredLanguage: string | null): string | null {
    return (row?.language_code ?? '').trim() || preferredLanguage || null
}

/**
 * The preview language of a V2 voice (05 §6.6): the app language when the
 * voice has an accepted row for it, else the voice's primary language, as a
 * preview-text language. Used where a card or story language leads (the picker).
 */
export function v2PreviewLanguage(item: CatalogVoice | null | undefined, appLanguage: string, storedLanguage?: string | null): string {
    if (item) {
        if (speaksLanguage(item, appLanguage)) return previewLanguage(appLanguage)
        return previewLanguage(item.primary_language)
    }
    return previewLanguage(storedLanguage || appLanguage)
}

/**
 * No emotion and no stored setting: the recipe is the voice's catalog defaults
 * (`settings: {}` and `null` alike, as the BFF quantises both to the defaults).
 */
export function isDefaultRecipe(settings: VoiceSettingsV2 | null | undefined, emotion: VoiceEmotion | null | undefined): boolean {
    return !emotion && !Object.values(settings ?? {}).some((value) => typeof value === 'number' && Number.isFinite(value))
}

/** The tier a catalog `sample_url` was recorded on (its `tier` query); Standard when it names none. */
function sampleUrlTier(url: string): string {
    const match = /[?&]tier=([^&#]*)/.exec(url)
    return match ? decodeURIComponent(match[1]) : 'standard'
}

/**
 * The catalog sample a default-recipe preview is served as (05 §6.1 "Default-settings
 * shortcut", EP-6), mirroring the BFF's `choose_sample`: the preview language's
 * sample on the asked tier or Standard, else the primary language's Standard one.
 * Null when the server would render instead (metered, so past the free renders it
 * costs a credit).
 */
export function previewSampleUrl(item: CatalogVoice | null | undefined, language: string | null | undefined, tier: NarrationTier = 'standard'): string | null {
    if (!item) return null
    const slots: [string | null, readonly string[]][] = [
        [baseLanguageCode(language), ['standard', tier]],
        [baseLanguageCode(item.primary_language), ['standard']],
    ]
    for (const [code, tiers] of slots) {
        if (!code) continue
        const url = item.languages
            .filter((entry) => baseLanguageCode(entry.language) === code)
            .map((entry) => entry.sample_url)
            .find((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0 && tiers.includes(sampleUrlTier(candidate)))
        if (url) return url
    }
    return null
}

/**
 * Whether a V2 recipe preview is free: the voice's own catalog sample, never a
 * metered render (AC-P5, 05 §6.3 "Default settings, no emotion"). The one rule
 * for the Studio card, the editor and the picker. Settings that merely equal the
 * catalog defaults also get the sample from the BFF, but the catalog DTO carries
 * no defaults, so those count as paid: the label may over-warn, never under-warn.
 */
export function isFreeSamplePreview(
    settings: VoiceSettingsV2 | null | undefined,
    emotion: VoiceEmotion | null | undefined,
    item: CatalogVoice | null | undefined,
    language: string | null | undefined,
    tier: NarrationTier = 'standard',
): boolean {
    return isDefaultRecipe(settings, emotion) && previewSampleUrl(item, language, tier) !== null
}

export interface StudioPreviewLanguageSources {
    /** The preset's stored `language_code` (D13: migration only). */
    languageCode?: string | null
    /** `user_preferences.preferred_language`. */
    preferredLanguage?: string | null
    /** The last resort when nothing above is known (the interface language). */
    fallback: string
}

/** The voice's accepted languages that have preview texts, in its own order (05 §5.5 language chips). */
export function previewableLanguages(item: CatalogVoice | null | undefined): string[] {
    if (!item) return []
    const codes = acceptedLanguages(item).map((code) => normalizeLanguage(code)).filter((code): code is NonNullable<typeof code> => code !== null)
    return [...new Set<string>(codes)]
}

/**
 * The Studio's default preview language (05 §5.5, D17 without a turn): the
 * voice's `language_code`, then the catalog `primary_language`, then the
 * preferred language, keeping the first the voice has an accepted row for
 * (else its first accepted language with preview texts). Before the catalog
 * item is known, the same order without the acceptance check; the interface
 * language only when nothing else is known.
 */
export function studioPreviewLanguage(item: CatalogVoice | null | undefined, { languageCode, preferredLanguage, fallback }: StudioPreviewLanguageSources): string {
    const candidates = [languageCode, item?.primary_language, preferredLanguage]
        .map((code) => baseLanguageCode(code))
        .filter((code): code is string => code !== null)
    if (!item) return previewLanguage(candidates[0] ?? fallback)
    const accepted = previewableLanguages(item)
    const chosen = candidates.find((code) => accepted.includes(code)) ?? accepted[0] ?? candidates[0]
    return previewLanguage(chosen ?? fallback)
}

/**
 * The editor drawer's title (05 §10 Modals: it states the preset name): the
 * edited or duplicated row's name; a blank preset has none yet.
 */
export function editorTitle(mode: PresetEditorV2Mode, row: VoicePreset | null, t: TFunction): string {
    const name = row?.name?.trim()
    if (!name || mode === 'create') return t('voices.editor.newTitle')
    if (mode === 'duplicate') return t('voices.studio.v2.duplicateTitle', { name })
    return t('voices.studio.v2.editTitle', { name })
}

function sameSettings(a: VoiceSettingsV2 | null, b: VoiceSettingsV2 | null): boolean {
    const left = (a ?? {}) as Record<string, unknown>
    const right = (b ?? {}) as Record<string, unknown>
    if ((a === null) !== (b === null)) return false
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    return [...keys].every((key) => left[key] === right[key])
}

/**
 * The draft differs from what the editor opened with (05 §10 Modals: closing
 * then asks first). Only what a save writes counts: name, description, voice,
 * settings and emotion; the preview tier, text and language do not.
 */
export function draftChanged(seed: PresetEditorSeed, draft: Omit<PresetEditorSeed, 'voiceName'>): boolean {
    return seed.name !== draft.name
        || seed.description !== draft.description
        || seed.voiceKey !== draft.voiceKey
        || seed.emotion !== draft.emotion
        || !sameSettings(seed.settings, draft.settings)
}

/** A catalog accent as an i18n key (`voices.recipe.accent.<slug>`), or null for none. */
export function accentKey(accent: string | null | undefined): string | null {
    const slug = (accent ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    return slug ? `voices.recipe.accent.${slug}` : null
}

/** The voice's accent: its own, else the accent of its primary-language row. */
export function catalogAccent(item: CatalogVoice): string | null {
    return item.accent || item.languages.find((entry) => entry.language === item.primary_language)?.accent || null
}
