/**
 * Formatting helpers shared by the Membership & plans console components.
 * Operation naming reuses the profile helpers so admins and members see the
 * same labels for the same quota buckets.
 */
import type { TFunction } from 'i18next'
import type { BadgeTone } from '@/ui/primitives'
import type { MembershipPlan } from '@/shared'
import { formatNumber, operationLabel, orderedLimitEntries } from '@/features/profile/components/membership.helpers'

export { formatNumber, orderedLimitEntries }

export function operationName(operation: string, t: TFunction): string {
    return t(`membership.operations.${operation}`, { defaultValue: operationLabel(operation) })
}

/** Ember for the fallback + custom plans (locally owned), arcane for billing-owned, neutral when inactive. */
export function planBadgeTone(plan: Pick<MembershipPlan, 'is_active' | 'is_billing_synced'>): BadgeTone {
    if (!plan.is_active) return 'neutral'
    return plan.is_billing_synced ? 'arcane' : 'ember'
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Format a timestamp or a date-only string (`YYYY-MM-DD`, the API's usage
 * dates). Date-only values are parsed as local calendar dates so they never
 * shift by a day west of UTC.
 */
export function formatDate(value: string | null | undefined, locale?: string): string | null {
    if (!value) return null
    const dateOnly = DATE_ONLY.exec(value)
    const parsed = dateOnly
        ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
        : new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatMonth(value: string, locale?: string): string {
    const parsed = new Date(`${value}-01T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString(locale, { year: 'numeric', month: 'long' })
}

/** 0–100 share of `part` in `total`, clamped; 0 when there is nothing to compare against. */
export function percentOf(part: number, total: number): number {
    if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0
    return Math.max(0, Math.min(100, Math.round((part / total) * 100)))
}
