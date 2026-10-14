/**
 * The root review queue table for "Report a minor" (R2-BE-02): one row per
 * report, with its subject, reason, reporter eligibility, voice hold, status
 * and, while unreviewed, the three review outcomes. Presentational: the
 * module owns loading and the review calls.
 *
 * Report details are collapsed and shown to root only; never logged.
 */
import { useTranslation } from 'react-i18next'
import type {
    MinorReportAdminItem,
    MinorReportOutcome,
    MinorReportState,
} from '@/shared/types/minorReport.types'
import { Badge, Button, type BadgeTone } from '@/ui/primitives'
import { formatDateTime } from '../../format'

const OUTCOMES: readonly MinorReportOutcome[] = ['unfounded', 'inconclusive', 'escalated']
const STATUS_TONE: Readonly<Record<MinorReportState, BadgeTone>> = {
    open: 'warning',
    lifted: 'neutral',
    escalated: 'danger',
    expired: 'neutral',
}
const COLUMNS = ['created', 'subject', 'reason', 'reporter', 'eligible', 'hold', 'status', 'actions'] as const

const cell = 'border-b border-line-faint py-2 pr-3 align-top'

export interface MinorReportsTableProps {
    items: readonly MinorReportAdminItem[]
    /** Locale for dates. */
    locale: string
    /** A review is being saved: every review button waits. */
    disabled?: boolean
    onReview: (report: MinorReportAdminItem, outcome: MinorReportOutcome) => void
}

export function MinorReportsTable({ items, locale, disabled = false, onReview }: MinorReportsTableProps) {
    const { t } = useTranslation()
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse font-ui text-sm">
                <caption className="sr-only">{t('minorReports.admin.caption')}</caption>
                <thead>
                    <tr className="text-left text-meta uppercase tracking-[0.08em] text-parchment-400">
                        {COLUMNS.map((column) => (
                            <th key={column} scope="col" className="border-b border-line-faint pb-2 pr-3 font-semibold">
                                {t(`minorReports.admin.columns.${column}`)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.map((report) => (
                        <ReportRow
                            key={report.report_id}
                            report={report}
                            locale={locale}
                            disabled={disabled}
                            onReview={(outcome) => onReview(report, outcome)}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    )
}

interface ReportRowProps {
    report: MinorReportAdminItem
    locale: string
    disabled: boolean
    onReview: (outcome: MinorReportOutcome) => void
}

function ReportRow({ report, locale, disabled, onReview }: ReportRowProps) {
    const { t } = useTranslation()
    const hold = report.hold
    return (
        <tr data-testid={`minor-report-${report.report_id}`}>
            <td className={`${cell} whitespace-nowrap text-parchment-300`}>{formatDateTime(report.created_at, locale)}</td>
            <th scope="row" className={`${cell} text-left font-normal`}>
                <span className="block text-parchment-300">{t(`minorReports.subjectKind.${report.subject_kind}`)}</span>
                <span className="block break-all font-mono text-meta text-parchment-50">{report.subject_ref}</span>
                <span className="block text-meta text-fg-muted">
                    {report.reported_user_id === null ? t('minorReports.admin.unresolved') : `#${report.reported_user_id}`}
                </span>
                {report.details && (
                    <details className="mt-1 max-w-[42ch]">
                        <summary className="cursor-pointer text-meta text-ember-300">{t('minorReports.admin.details')}</summary>
                        <p className="mt-1 mb-0 whitespace-pre-wrap break-words text-parchment-200">{report.details}</p>
                    </details>
                )}
            </th>
            <td className={`${cell} text-parchment-200`}>{t(`minorReports.reason.${report.reason}`)}</td>
            <td className={`${cell} tabular-nums text-parchment-300`}>#{report.reporter_user_id}</td>
            <td className={cell}>
                <Badge tone={report.reporter_eligible ? 'live' : 'neutral'}>
                    {report.reporter_eligible ? t('minorReports.admin.eligible.yes') : t('minorReports.admin.eligible.no')}
                </Badge>
            </td>
            <td className={`${cell} text-parchment-300`}>
                {!hold
                    ? t('minorReports.admin.hold.none')
                    : hold.lifted_at
                        ? t('minorReports.admin.hold.lifted')
                        : t('minorReports.admin.hold.active', { time: formatDateTime(hold.ends_at, locale) })}
            </td>
            <td className={cell}>
                <Badge tone={STATUS_TONE[report.status]}>{t(`minorReports.admin.status.${report.status}`)}</Badge>
                {report.review_outcome && report.review_outcome !== 'escalated' && (
                    <span className="mt-1 block text-meta text-fg-muted">
                        {t('minorReports.admin.reviewedOutcome', { outcome: t(`minorReports.admin.outcome.${report.review_outcome}`) })}
                    </span>
                )}
            </td>
            <td className={cell}>
                {/* One review per report: open and expired-unreviewed rows take one. */}
                {report.review_outcome === null ? (
                    <span className="flex flex-wrap gap-1.5" role="group" aria-label={t('minorReports.admin.columns.actions')}>
                        {OUTCOMES.map((outcome) => (
                            <Button
                                key={outcome}
                                variant={outcome === 'escalated' ? 'danger' : 'secondary'}
                                size="xs"
                                disabled={disabled}
                                onClick={() => onReview(outcome)}
                            >
                                {t(`minorReports.admin.outcome.${outcome}`)}
                            </Button>
                        ))}
                    </span>
                ) : (
                    <span className="text-fg-muted">—</span>
                )}
            </td>
        </tr>
    )
}
