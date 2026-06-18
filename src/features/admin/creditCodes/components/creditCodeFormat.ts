/**
 * Shared formatting helpers for the credit-code lists: status → Badge tone /
 * label, and a compact date formatter for created / expiry / redeemed stamps.
 */
import type { TFunction } from 'i18next'
import type { BadgeTone } from '@/ui/primitives'
import type { FreeCreditStatus } from '@/shared'

export function statusTone(status: FreeCreditStatus): BadgeTone {
    switch (status) {
        case 'active':
            return 'live'
        case 'redeemed':
            return 'ember'
        default:
            return 'neutral'
    }
}

export function statusLabel(status: FreeCreditStatus, t: TFunction): string {
    return t(`admin.creditCodes.status.${status}`, { defaultValue: status })
}

/** Short, locale-aware date+time; returns null for empty/invalid stamps. */
export function formatStamp(value: string | null | undefined, locale?: string): string | null {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
