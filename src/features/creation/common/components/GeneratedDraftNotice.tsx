/**
 * GeneratedDraftNotice — a small success badge shown above the live preview after
 * AI generation completes. The AI endpoint already persisted the card, so the
 * creator switches to edit mode; this reassures the user the draft landed and
 * invites a review-and-save pass.
 */

import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'
import { Icon } from '@/ui/primitives'

export interface GeneratedDraftNoticeProps {
    /** Lower-case card noun, e.g. "character". */
    noun: string
}

export function GeneratedDraftNotice({ noun }: GeneratedDraftNoticeProps) {
    const { t } = useTranslation()
    return (
        <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-arcane-500/30 bg-arcane-500/[.08] px-3 py-2 text-xs text-arcane-100"
        >
            <Icon icon={CheckCircle2} size={14} className="shrink-0 text-arcane-300" />
            <span>
                {t('creation.common.generatedDraft.notice', { noun })}
            </span>
        </div>
    )
}
