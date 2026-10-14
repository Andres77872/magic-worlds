/**
 * Form rules of "Report a possible minor" (R2-BE-02, EP-10 `MinorReportIn`):
 * field limits, the trimmed body, and the copy for a refused report.
 */
import { ApiError } from '@/infrastructure/api'
import type { MinorReportInput, MinorReportReason, MinorReportSubjectKind } from '@/shared/types/minorReport.types'

/** EP-10 `MinorReportIn` limits. */
export const MINOR_REPORT_LIMITS = Object.freeze({ subjectRef: 191, details: 1000 })

export const MINOR_REPORT_SUBJECT_KINDS: readonly MinorReportSubjectKind[] = ['public_card', 'username']
export const MINOR_REPORT_REASONS: readonly MinorReportReason[] = ['stated_age', 'content', 'other']

/** EP-10 `SubjectRef` refuses control characters (`^[^\x00-\x1f\x7f]+$`). */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER = /[\x00-\x1f\x7f]/

/** True when the trimmed subject reference is one EP-10 accepts: 1 to 191 characters, none of them control characters. */
export function isValidSubjectRef(subjectRef: string): boolean {
    const ref = subjectRef.trim()
    return ref.length >= 1 && ref.length <= MINOR_REPORT_LIMITS.subjectRef && !CONTROL_CHARACTER.test(ref)
}

/** The `minorReports.errors.*` copy key for a refused report. */
export function minorReportErrorKey(error: unknown): string {
    if (error instanceof ApiError) {
        if (error.status === 429 || error.code === 'minor_report_limit') return 'minorReports.errors.limit'
        if (error.status === 403 || error.code === 'minor_report_disabled') return 'minorReports.errors.disabled'
        if (error.status === 400 || error.status === 422) return 'minorReports.errors.invalid'
    }
    return 'minorReports.errors.generic'
}

/** The trimmed body, or null when a field is out of range. */
export function minorReportBody(
    kind: MinorReportSubjectKind,
    subjectRef: string,
    reason: MinorReportReason | null,
    details: string,
): MinorReportInput | null {
    const ref = subjectRef.trim()
    const note = details.trim()
    if (!reason || !isValidSubjectRef(ref) || note.length > MINOR_REPORT_LIMITS.details) return null
    return { subject_kind: kind, subject_ref: ref, reason, ...(note ? { details: note } : {}) }
}
