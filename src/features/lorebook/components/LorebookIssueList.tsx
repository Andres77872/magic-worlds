import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LorebookIssue } from '@/shared'
import { Badge, Icon, cx } from '@/ui/primitives'

const ISSUE_VIEW = {
    info: { icon: Info, badge: 'neutral' as const, className: 'border-parchment-50/10 bg-parchment-50/[.04]' },
    warning: { icon: AlertTriangle, badge: 'ember' as const, className: 'border-ember-500/25 bg-ember-500/10' },
    error: { icon: XCircle, badge: 'danger' as const, className: 'border-blood-500/30 bg-blood-500/10' },
}

/** Issue codes with a localized message template under `lorebookStudio.issues.message.*`. */
const LOCALIZED_CODES = new Set([
    'name_required',
    'empty_book',
    'entry_content_required',
    'entry_keys_missing',
    'entry_long',
    'entry_key_short',
    'duplicate_key',
])

export function LorebookIssueList({ issues }: { issues: LorebookIssue[] }) {
    const { t } = useTranslation()

    if (issues.length === 0) {
        return (
            <div className="rounded-lg border border-verdant-500/20 bg-verdant-500/10 px-4 py-3 font-ui text-sm text-parchment-200">
                <span className="inline-flex items-center gap-2">
                    <Icon icon={CheckCircle2} size={16} className="text-verdant-500" />
                    {t('lorebookStudio.issues.empty')}
                </span>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            {issues.map((issue, index) => {
                const view = ISSUE_VIEW[issue.severity]
                const message = LOCALIZED_CODES.has(issue.code)
                    ? t(`lorebookStudio.issues.message.${issue.code}`, { ...issue.messageParams })
                    : issue.message
                return (
                    <div
                        key={`${issue.code}-${issue.entryId ?? 'book'}-${index}`}
                        className={cx('flex items-start gap-3 rounded-lg border px-3.5 py-3', view.className)}
                    >
                        <Icon icon={view.icon} size={16} className="mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={view.badge}>{issue.code.replace(/_/g, ' ')}</Badge>
                                {issue.entryId && (
                                    <span className="font-mono text-[11px] text-parchment-400">{issue.entryId.slice(0, 8)}</span>
                                )}
                            </div>
                            <p className="mt-1 font-ui text-sm leading-snug text-parchment-200">{message}</p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
