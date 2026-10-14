/**
 * Root review queue for "Report a minor" (R2-BE-02, EP-10): the console
 * module `'reports'`. Lists reports newest first, filtered by status, with a
 * `before` cursor ("Load more"), and records one review outcome per report
 * (`apiService.adminListMinorReports`, `adminReviewMinorReport`):
 * unfounded and inconclusive lift any voice hold; escalated lifts the hold and
 * places a kill switch, so it asks first. A second review answers 409
 * `minor_report_reviewed`, which reloads the list.
 *
 * Report details are shown to root only, collapsed, and never logged.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flag, RefreshCw, ShieldAlert } from 'lucide-react'
import { ApiError, apiService } from '@/infrastructure/api'
import type {
    MinorReportAdminItem,
    MinorReportAdminList,
    MinorReportOutcome,
    MinorReportState,
} from '@/shared/types/minorReport.types'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Button, Callout, Icon, Select } from '@/ui/primitives'
import { useAbortableLoad } from '../../hooks/useAbortableLoad'
import { ConsoleSection } from '../shell/ConsoleSection'
import { useLoadErrorMessage, useVoiceConsole } from '../shell/VoiceConsoleContext'
import { MINOR_REPORTS_PAGE_SIZE, MINOR_REPORT_STATUSES, appendMinorReportPage } from './minorReportsQueue'
import { MinorReportsTable } from './MinorReportsTable'

const REVIEWED_CODE = 'minor_report_reviewed'

function isStatus(value: string): value is MinorReportState {
    return (MINOR_REPORT_STATUSES as readonly string[]).includes(value)
}

export function MinorReportsModule() {
    const { t } = useTranslation()
    const { locale, notify, reportError } = useVoiceConsole()
    const [status, setStatus] = useState<MinorReportState>('open')
    const list = useAbortableLoad<MinorReportAdminList>(
        () => apiService.adminListMinorReports({ status, limit: MINOR_REPORTS_PAGE_SIZE }),
        `minor-reports:${status}`,
    )
    const loadError = useLoadErrorMessage(list.error)
    const [loadingMore, setLoadingMore] = useState(false)
    const [actionError, setActionError] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [escalating, setEscalating] = useState<MinorReportAdminItem | null>(null)
    const items = list.data?.items ?? []
    const nextBefore = list.data?.next_before ?? null
    // The filter a "Load more" page belongs to: a page that lands after the filter changed is dropped.
    const shownStatus = useRef(status)
    useEffect(() => {
        shownStatus.current = status
    }, [status])

    const loadMore = async () => {
        if (!nextBefore || loadingMore) return
        const requested = status
        setLoadingMore(true)
        setActionError(null)
        try {
            const page = await apiService.adminListMinorReports({ status: requested, limit: MINOR_REPORTS_PAGE_SIZE, before: nextBefore })
            if (shownStatus.current === requested) list.setData((previous) => appendMinorReportPage(previous, page))
        } catch (error) {
            setActionError(reportError(error))
        } finally {
            setLoadingMore(false)
        }
    }

    const review = async (report: MinorReportAdminItem, outcome: MinorReportOutcome) => {
        setBusyId(report.report_id)
        setActionError(null)
        try {
            const updated = await apiService.adminReviewMinorReport(report.report_id, outcome)
            list.setData((previous) => previous && {
                ...previous,
                items: previous.items.map((item) => (item.report_id === updated.report_id ? updated : item)),
            })
            notify(t('minorReports.admin.reviewed'))
        } catch (error) {
            if (error instanceof ApiError && error.status === 409 && error.code === REVIEWED_CODE) {
                setActionError(t('minorReports.admin.alreadyReviewed'))
                list.reload()
            } else {
                setActionError(error instanceof ApiError ? reportError(error) : t('minorReports.admin.reviewFailed'))
            }
        } finally {
            setBusyId(null)
            setEscalating(null)
        }
    }

    const choose = (report: MinorReportAdminItem, outcome: MinorReportOutcome) => {
        if (outcome === 'escalated') setEscalating(report)
        else void review(report, outcome)
    }

    return (
        <ConsoleSection
            icon={Flag}
            title={t('minorReports.admin.title')}
            description={t('minorReports.admin.description')}
            right={
                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        size="sm"
                        aria-label={t('minorReports.admin.filterStatus')}
                        options={MINOR_REPORT_STATUSES.map((value) => ({ value, label: t(`minorReports.admin.status.${value}`) }))}
                        value={status}
                        onChange={(value) => {
                            if (isStatus(value)) setStatus(value)
                        }}
                    />
                    <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={<Icon icon={RefreshCw} size={14} />}
                        disabled={list.loading}
                        onClick={list.reload}
                    >
                        {t('minorReports.admin.refresh')}
                    </Button>
                </div>
            }
        >
            {loadError && (
                <Callout tone="danger" role="alert">
                    {t('minorReports.admin.loadFailed')} {loadError}
                </Callout>
            )}
            {actionError && (
                <Callout tone="danger" role="alert">
                    {actionError}
                </Callout>
            )}
            {list.loading && !list.data && (
                <p role="status" className="font-ui text-sm text-fg-muted">
                    {t('admin.voices.common.loading')}
                </p>
            )}
            {list.data && items.length === 0 && <p className="font-ui text-sm text-fg-muted">{t('minorReports.admin.empty')}</p>}
            {items.length > 0 && (
                <MinorReportsTable
                    items={items}
                    locale={locale}
                    disabled={busyId !== null}
                    onReview={choose}
                />
            )}
            {nextBefore && (
                <div>
                    <Button variant="secondary" size="sm" disabled={loadingMore || list.loading} onClick={() => void loadMore()}>
                        {t('minorReports.admin.loadMore')}
                    </Button>
                </div>
            )}
            <ConfirmDialog
                visible={escalating !== null}
                title={t('minorReports.admin.escalateConfirm.title')}
                icon={<Icon icon={ShieldAlert} size={20} className="text-blood-500" />}
                message={t('minorReports.admin.escalateConfirm.body')}
                confirmLabel={t('minorReports.admin.escalateConfirm.confirm')}
                variant="danger"
                isProcessing={escalating !== null && busyId === escalating.report_id}
                processingLabel={t('minorReports.admin.reviewing')}
                onConfirm={() => {
                    if (escalating) void review(escalating, 'escalated')
                }}
                onCancel={() => setEscalating(null)}
            />
        </ConsoleSection>
    )
}
