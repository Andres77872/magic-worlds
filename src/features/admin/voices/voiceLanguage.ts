/**
 * Derives a display language for MiniMax system voices from their voice_id.
 * Language-named ids carry it as the leading token (`English_…`,
 * `Chinese (Mandarin)_…`); legacy ids (`male-qn-qingse`, `presenter_male`,
 * `Wise_Woman`) have no language prefix and fall into "Other".
 */
import type { TFunction } from 'i18next'
import type { AdminVoiceEntry } from '@/shared'
import type { SelectOption } from '@/ui/primitives'
import { KNOWN_VOICE_LANGUAGES } from './constants'

/** Stable internal filter value for voices with no recognized language prefix. */
export const OTHER_LANGUAGE = 'Other'

export function deriveVoiceLanguage(entry: AdminVoiceEntry): string {
    const underscore = entry.voice_id.indexOf('_')
    if (underscore <= 0) return OTHER_LANGUAGE
    // Leading token of the prefix: "Chinese (Mandarin)" -> "Chinese".
    const leadingWord = entry.voice_id.slice(0, underscore).split(/[\s(]/)[0]
    return KNOWN_VOICE_LANGUAGES.has(leadingWord) ? leadingWord : OTHER_LANGUAGE
}

/**
 * Distinct languages present in the given voices, with counts, as Select
 * options. Sorted by frequency (then alphabetically), with "Other" last and an
 * "All languages" entry first. Empty value = no language filter.
 */
export function buildLanguageOptions(voices: AdminVoiceEntry[], t: TFunction): SelectOption[] {
    const counts = new Map<string, number>()
    for (const voice of voices) {
        const language = deriveVoiceLanguage(voice)
        counts.set(language, (counts.get(language) ?? 0) + 1)
    }

    const sorted = [...counts.entries()].sort(([aLang, aCount], [bLang, bCount]) => {
        if (aLang === OTHER_LANGUAGE) return 1
        if (bLang === OTHER_LANGUAGE) return -1
        if (bCount !== aCount) return bCount - aCount
        return aLang.localeCompare(bLang)
    })

    return [
        { value: '', label: t('admin.voices.language.all', { count: voices.length }) },
        ...sorted.map(([language, count]) => ({
            value: language,
            label:
                language === OTHER_LANGUAGE
                    ? t('admin.voices.language.other', { count })
                    : `${language} (${count})`,
        })),
    ]
}
