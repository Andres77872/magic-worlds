/**
 * "Report a minor" (R2-BE-02, 13 §3.4): the EP-10 wire shapes of
 * `GET /reports/minor/status`, `POST /reports/minor` and the root review
 * routes under `/admin/voices/minor-reports`. Snake_case, mirroring the
 * BFF's strict DTOs.
 *
 * The reporter never learns whether a hold was placed or whether the subject
 * resolved: the 202 body is the same either way.
 */

/** What the report points at: a public card id, or a username as typed. */
export type MinorReportSubjectKind = 'public_card' | 'username'

export type MinorReportReason = 'stated_age' | 'content' | 'other'

/** `GET /reports/minor/status`. A closed gate reads `{enabled: false, can_report: false, reports_left_today: 0, reason: null}`. */
export interface MinorReportStatus {
    enabled: boolean
    can_report: boolean
    reports_left_today: number
    /** Why `can_report` is false: the daily limit, or reporting disabled after unfounded reports. */
    reason: 'limit' | 'disabled' | null
}

/** `POST /reports/minor` body (extra keys are refused). `subject_ref` is 1..191 chars trimmed; `details` at most 1000. */
export interface MinorReportInput {
    subject_kind: MinorReportSubjectKind
    subject_ref: string
    reason: MinorReportReason
    details?: string | null
}

/** 202 body; identical whether or not a hold was placed. */
export interface MinorReportAccepted {
    report_id: string
    received: true
}

/** Root review outcome. `escalated` lifts the hold and places a kill switch. */
export type MinorReportOutcome = 'unfounded' | 'inconclusive' | 'escalated'

/** Lifecycle of a report row. */
export type MinorReportState = 'open' | 'lifted' | 'escalated' | 'expired'

/** The temporary voice hold a report placed, if any. */
export interface MinorReportHold {
    restriction_id: string
    ends_at: string | null
    lifted_at: string | null
}

/** One row of the root review queue (`MinorReportAdminOut`). */
export interface MinorReportAdminItem {
    report_id: string
    reporter_user_id: number
    /** Null when the subject did not resolve to an account. */
    reported_user_id: number | null
    subject_kind: MinorReportSubjectKind
    subject_ref: string
    reason: MinorReportReason
    details: string | null
    reporter_eligible: boolean
    hold: MinorReportHold | null
    status: MinorReportState
    review_outcome: MinorReportOutcome | null
    reviewed_at: string | null
    created_at: string
}

/** `GET /admin/voices/minor-reports`; `next_before` is the cursor for the next page, null at the end. */
export interface MinorReportAdminList {
    items: MinorReportAdminItem[]
    next_before: string | null
}
