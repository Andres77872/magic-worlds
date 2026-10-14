/**
 * "Report a possible minor" on the Contact page (R2-BE-02; 13 §3.4; EP-10).
 *
 * Rendered only for a signed-in account whose status says reporting is open
 * (`enabled`), so it is invisible while the feature is dark (I-16). The
 * success state only thanks the reporter: it never says whether anything
 * happened to the reported account (the 202 body is the same either way).
 * `minor_report_limit` (429) and `minor_report_disabled` (403) map to copy.
 */
import { useContext, useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Flag, Loader2, Send } from 'lucide-react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { apiService } from '@/infrastructure/api'
import type { MinorReportInput, MinorReportReason, MinorReportStatus, MinorReportSubjectKind } from '@/shared/types/minorReport.types'
import { Button, Callout, Field, Icon, IconTile, Input, Select, Textarea, cx } from '@/ui/primitives'
import { useMinorReportStatus } from '../hooks/useMinorReportStatus'
import { isValidSubjectRef, MINOR_REPORT_LIMITS, MINOR_REPORT_REASONS, MINOR_REPORT_SUBJECT_KINDS, minorReportBody, minorReportErrorKey } from './minorReportForm'

export interface ReportMinorFormViewProps {
    status: MinorReportStatus
    /** Sends the report; rejects with the API error. */
    onSubmit: (body: MinorReportInput) => Promise<void>
    className?: string
}

/** The form itself, for an account whose reporting is open. */
export function ReportMinorFormView({ status, onSubmit, className }: ReportMinorFormViewProps) {
    const { t } = useTranslation()
    const headingId = useId()
    const [kind, setKind] = useState<MinorReportSubjectKind>('public_card')
    const [subjectRef, setSubjectRef] = useState('')
    const [reason, setReason] = useState<MinorReportReason | null>(null)
    const [details, setDetails] = useState('')
    const [attempted, setAttempted] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [errorKey, setErrorKey] = useState<string | null>(null)
    const [sent, setSent] = useState(false)

    const blockedKey = !status.can_report
        ? status.reason === 'disabled' ? 'minorReports.errors.disabled' : 'minorReports.errors.limit'
        : null
    const body = minorReportBody(kind, subjectRef, reason, details)
    const refInvalid = attempted && !isValidSubjectRef(subjectRef)
    const reasonInvalid = attempted && reason === null

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (submitting || blockedKey) return
        setAttempted(true)
        setErrorKey(null)
        if (!body) return
        setSubmitting(true)
        try {
            await onSubmit(body)
            setSent(true)
        } catch (error) {
            setErrorKey(minorReportErrorKey(error))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <section aria-labelledby={headingId} className={cx('border-t border-line-faint pt-6', className)}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <IconTile icon={Flag} tone="ember" size="sm" />
                <div className="flex min-w-0 max-w-[72ch] flex-1 flex-col gap-4">
                    <div>
                        <h2 id={headingId} className="m-0 font-display text-h3 font-semibold leading-tight text-parchment-50">
                            {t('minorReports.title')}
                        </h2>
                        <p className="mt-2 mb-0 font-ui text-body leading-relaxed text-parchment-300">{t('minorReports.intro')}</p>
                    </div>

                    {sent ? (
                        <Callout tone="success" role="status" icon={<Icon icon={CheckCircle2} size={18} />}>
                            <p className="m-0 font-semibold text-parchment-50">{t('minorReports.success.title')}</p>
                            <p className="mt-1 mb-0">{t('minorReports.success.body')}</p>
                        </Callout>
                    ) : (
                        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
                            {blockedKey && <Callout tone="warning" role="status">{t(blockedKey)}</Callout>}
                            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" disabled={submitting || Boolean(blockedKey)}>
                                <legend className="mb-2 block font-ui text-label font-semibold text-fg">{t('minorReports.subjectKind.label')}</legend>
                                <div className="flex flex-wrap gap-x-5 gap-y-2">
                                    {MINOR_REPORT_SUBJECT_KINDS.map((option) => (
                                        <label key={option} className="flex cursor-pointer items-center gap-2 font-ui text-sm text-parchment-100">
                                            <input
                                                type="radio"
                                                name={`${headingId}-subject-kind`}
                                                value={option}
                                                checked={kind === option}
                                                onChange={() => setKind(option)}
                                                className="h-4 w-4 cursor-pointer accent-ember-500"
                                            />
                                            {t(`minorReports.subjectKind.${option}`)}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <Field label={t('minorReports.subjectRef.label')} error={refInvalid ? t('minorReports.errors.invalid') : undefined}>
                                <Input
                                    value={subjectRef}
                                    onChange={(event) => setSubjectRef(event.target.value)}
                                    placeholder={t(kind === 'username' ? 'minorReports.subjectRef.usernamePlaceholder' : 'minorReports.subjectRef.cardPlaceholder')}
                                    maxLength={MINOR_REPORT_LIMITS.subjectRef}
                                    autoComplete="off"
                                    disabled={submitting || Boolean(blockedKey)}
                                    required
                                />
                            </Field>
                            <Field label={t('minorReports.reason.label')} error={reasonInvalid ? t('minorReports.errors.invalid') : undefined}>
                                <Select
                                    options={MINOR_REPORT_REASONS.map((value) => ({ value, label: t(`minorReports.reason.${value}`) }))}
                                    value={reason}
                                    onChange={(value) => setReason(MINOR_REPORT_REASONS.find((entry) => entry === value) ?? null)}
                                    placeholder={t('minorReports.reason.label')}
                                    disabled={submitting || Boolean(blockedKey)}
                                />
                            </Field>
                            <Field label={t('minorReports.details.label')} helper={t('minorReports.details.hint', { max: MINOR_REPORT_LIMITS.details })}>
                                <Textarea
                                    value={details}
                                    onChange={(event) => setDetails(event.target.value)}
                                    maxLength={MINOR_REPORT_LIMITS.details}
                                    rows={4}
                                    disabled={submitting || Boolean(blockedKey)}
                                />
                            </Field>
                            {errorKey && <Callout tone="danger" role="alert">{t(errorKey)}</Callout>}
                            <div>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={submitting || Boolean(blockedKey)}
                                    iconLeft={submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={1.75} />}
                                >
                                    {submitting ? t('minorReports.submitting') : t('minorReports.submit')}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </section>
    )
}

/**
 * The Contact-page entry point: nothing for signed-out visitors or while
 * reporting is closed; the form otherwise. Reads auth leniently, so the legal
 * pages keep rendering outside the app providers (stories, isolated tests).
 */
export function ReportMinorForm({ className }: { className?: string }) {
    const auth = useContext(AuthContext)
    const accountKey = auth?.isAuthenticated ? auth.accountKey : null
    const { status, reload } = useMinorReportStatus(accountKey)
    if (accountKey === null || !status?.enabled) return null
    const submit = async (body: MinorReportInput) => {
        try {
            await apiService.submitMinorReport(body)
        } finally {
            // Refresh the daily count; a 404 (reporting closed meanwhile) hides the form.
            reload()
        }
    }
    return <ReportMinorFormView key={accountKey} status={status} onSubmit={submit} className={className} />
}
