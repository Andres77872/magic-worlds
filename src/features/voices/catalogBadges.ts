/**
 * Badges the SPA derives from catalog fields (R1-FE-01, 03 §5.12): the BFF
 * sends `effective_voice.badges` for stored voices, but a catalog row is
 * described by its own fields. `leaving` is shown only on the voice currently
 * in use (picking a leaving voice is still allowed, it is just not advertised).
 */
import type { CatalogVoice, VoiceBadgeKey } from '@/shared'

export interface CatalogBadgeContext {
    /** The card or story language; null skips the language check. */
    language?: string | null
    /** The row is the voice currently assigned. */
    isCurrent?: boolean
}

/** Base language code (`es-MX` → `es`). */
function baseLanguage(code: string): string {
    return code.trim().toLowerCase().split(/[-_]/)[0]
}

type CatalogLanguage = CatalogVoice['languages'][number]

/**
 * Whether a language row passed acceptance on at least one tier. The BFF also
 * lists languages that only have models or samples (`accepted_models: []`);
 * those are not "accepted" (05 §5.5).
 */
function isAccepted(entry: CatalogLanguage): boolean {
    return entry.accepted_models.length > 0
}

/** The base codes of the languages the voice passed acceptance in, in its own order, once each. */
export function acceptedLanguages(item: CatalogVoice): string[] {
    return [...new Set(item.languages.filter(isAccepted).map((entry) => baseLanguage(entry.language)).filter(Boolean))]
}

/**
 * Whether the voice has an accepted row for `language` (base codes compare);
 * true when no language is given, so an unknown language never badges (D34).
 */
export function speaksLanguage(item: CatalogVoice, language: string | null | undefined): boolean {
    const wanted = language ? baseLanguage(language) : ''
    return !wanted || item.languages.some((entry) => isAccepted(entry) && baseLanguage(entry.language) === wanted)
}

export function catalogBadges(item: CatalogVoice, { language, isCurrent = false }: CatalogBadgeContext = {}): VoiceBadgeKey[] {
    const badges: VoiceBadgeKey[] = []
    if (item.house_voice) badges.push('house_voice')
    if (item.locked) badges.push('locked')
    if (!speaksLanguage(item, language)) badges.push('not_tested_language')
    if (isCurrent && (item.status === 'deprecating' || Boolean(item.disable_at))) badges.push('leaving')
    return badges
}

/** The row's sample in the wanted language, else in its primary language, else the first one. */
export function catalogSampleUrl(item: CatalogVoice, language?: string | null): string | null {
    const wanted = language ? baseLanguage(language) : ''
    const match = (wanted && item.languages.find((entry) => baseLanguage(entry.language) === wanted))
        || item.languages.find((entry) => entry.language === item.primary_language)
        || item.languages[0]
    return match?.sample_url || null
}
