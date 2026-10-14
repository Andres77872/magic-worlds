/**
 * "Report a minor" availability for the signed-in account (R2-BE-02, EP-10:
 * `GET /reports/minor/status`). The BFF answers `enabled: false` while the
 * feature is closed (its env switch is off; there is no rollout or cohort term
 * since I-68), so nobody sees the form while it is closed.
 *
 * Fails closed: signed out, a failed read, a body that is not a status, or the
 * voice feature flag being off all read as "no form".
 */
import { useCallback, useEffect, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import type { MinorReportStatus } from '@/shared/types/minorReport.types'

export interface MinorReportStatusState {
    /** The account's status; null while loading for a new account, when closed by a failure, or signed out. */
    status: MinorReportStatus | null
    loading: boolean
    /** Read the status again (e.g. after a report, so the daily count is current). */
    reload: () => void
}

/** Validates a status body; null for anything else. */
export function parseMinorReportStatus(value: unknown): MinorReportStatus | null {
    if (typeof value !== 'object' || value === null) return null
    const body = value as Record<string, unknown>
    if (typeof body.enabled !== 'boolean' || typeof body.can_report !== 'boolean') return null
    const left = body.reports_left_today
    const reason = body.reason
    return {
        enabled: body.enabled,
        can_report: body.enabled && body.can_report,
        reports_left_today: typeof left === 'number' && Number.isFinite(left) && left > 0 ? Math.floor(left) : 0,
        reason: reason === 'limit' || reason === 'disabled' ? reason : null,
    }
}

interface StatusResult {
    account: string
    request: string
    status: MinorReportStatus | null
}

/**
 * `accountKey` is the signed-in account's key, or null when signed out (no
 * request). A reload keeps showing the account's last status until the new
 * one arrives, so the form does not flicker.
 */
export function useMinorReportStatus(accountKey: string | null): MinorReportStatusState {
    const [nonce, setNonce] = useState(0)
    const request = accountKey === null ? null : `${accountKey}:${nonce}`
    const [result, setResult] = useState<StatusResult | null>(null)

    useEffect(() => {
        if (accountKey === null || request === null) return
        let cancelled = false
        apiService.getMinorReportStatus().then(
            (body) => {
                if (!cancelled) setResult({ account: accountKey, request, status: parseMinorReportStatus(body) })
            },
            () => {
                if (!cancelled) setResult({ account: accountKey, request, status: null })
            },
        )
        return () => {
            cancelled = true
        }
    }, [accountKey, request])

    const reload = useCallback(() => setNonce((value) => value + 1), [])
    const current = accountKey !== null && result?.account === accountKey ? result : null
    return {
        status: current?.status ?? null,
        loading: request !== null && result?.request !== request,
        reload,
    }
}
