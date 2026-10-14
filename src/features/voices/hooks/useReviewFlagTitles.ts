/**
 * The name each review notice of a list shows (05 §10 "Notices": a Dismiss
 * button names what it dismisses, e.g. "Dismiss review notice for Gruff
 * mentor"). The flag DTO carries no record name, so a flag is named by:
 * 1. the host's `nameFor` (the Studio knows its preset rows);
 * 2. for a card or card draft, the card's name in the loaded library (the
 *    selected workspace's characters; read without requiring a DataProvider);
 * 3. else its record kind ("Voice preset", "Character", "Adventure").
 * Names that still repeat are numbered in list order ("Character (1)",
 * "Character (2)"), so every region, Listen and Dismiss name stays distinct.
 */
import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { DataContext } from '@/app/providers/DataProvider'
import type { VoiceReviewFlag, VoiceReviewFlagRefType } from '@/shared'

export type ReviewFlagNameFor = (flag: VoiceReviewFlag) => string | null | undefined

const KIND_KEYS: Record<VoiceReviewFlagRefType, string> = {
    preset: 'voices.editor.eyebrow',
    card: 'cardPreview.types.character',
    card_draft: 'cardPreview.types.character',
    template_cast: 'cardPreview.types.adventure_template',
}

/** Flag id → the notice title, for `flags` in display order. */
export function useReviewFlagTitles(flags: readonly VoiceReviewFlag[], nameFor?: ReviewFlagNameFor): ReadonlyMap<number, string> {
    const { t } = useTranslation()
    const characters = useContext(DataContext)?.characters
    const libraryName = (flag: VoiceReviewFlag): string | null => {
        if (flag.ref_type !== 'card' && flag.ref_type !== 'card_draft') return null
        return characters?.find((character) => character.id === flag.ref_id)?.name ?? null
    }
    const names = flags.map((flag) => (nameFor?.(flag) || libraryName(flag) || '').trim() || t(KIND_KEYS[flag.ref_type]))
    const totals = new Map<string, number>()
    for (const name of names) totals.set(name, (totals.get(name) ?? 0) + 1)
    const seen = new Map<string, number>()
    const titles = new Map<number, string>()
    flags.forEach((flag, index) => {
        const name = names[index]
        if ((totals.get(name) ?? 0) < 2) {
            titles.set(flag.flag_id, name)
            return
        }
        const n = (seen.get(name) ?? 0) + 1
        seen.set(name, n)
        titles.set(flag.flag_id, t('voices.notice.reviewFlagNumbered', { name, n }))
    })
    return titles
}
