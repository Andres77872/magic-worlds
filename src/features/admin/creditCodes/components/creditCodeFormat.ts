/**
 * Shared formatting helpers for the credit-grant console: derives the presented
 * view-status (folding in the computed `expired` state), maps it to a Badge
 * tone / label, and formats created / expiry / claimed stamps.
 */
import type { TFunction } from 'i18next'
import type { BadgeTone } from '@/ui/primitives'
import type { CreditGrantStatus, CreditGrantViewStatus } from '@/shared'

/** The minimal shape needed to derive a presented status from either grant kind. */
interface GrantStatusLike {
    status: CreditGrantStatus
    is_expired?: boolean | null
}

/**
 * Fold the stored status + computed expiry into the four presented states.
 * An `active` grant past its `expires_at` reads as `expired`; everything else
 * maps straight through.
 */
export function viewStatus(grant: GrantStatusLike): CreditGrantViewStatus {
    if (grant.status === 'active' && grant.is_expired) return 'expired'
    return grant.status
}

export function statusTone(status: CreditGrantViewStatus): BadgeTone {
    switch (status) {
        case 'active':
            return 'live'
        case 'claimed':
            return 'ember'
        case 'expired':
            return 'danger'
        default:
            return 'neutral'
    }
}

export function statusLabel(status: CreditGrantViewStatus, t: TFunction): string {
    return t(`admin.creditCodes.status.${status}`, { defaultValue: status })
}

/** Short, locale-aware date+time; returns null for empty/invalid stamps. */
export function formatStamp(value: string | null | undefined, locale?: string): string | null {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
