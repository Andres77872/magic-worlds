/**
 * Relative-time formatting — "2m ago" / "in 3h" style strings for task and
 * activity timestamps. Locale-aware via Intl.RelativeTimeFormat; pair with an
 * absolute timestamp in a `title` attribute for hover detail.
 */

const RTF = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' })

const DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
]

const EXPLICIT_TIME_ZONE_RE = /(?:z|[+-]\d{2}:?\d{2})$/i
const OFFSETLESS_API_DATETIME_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/

function normalizeApiTimestamp(value: string): string {
    const trimmed = value.trim()
    if (!trimmed || EXPLICIT_TIME_ZONE_RE.test(trimmed)) return trimmed
    if (!OFFSETLESS_API_DATETIME_RE.test(trimmed)) return trimmed
    const normalized = trimmed.replace(' ', 'T')
    return normalized.includes('T') ? `${normalized}Z` : `${normalized}T00:00:00Z`
}

/**
 * Parse backend timestamps. The API stores and returns MySQL DATETIME values in
 * UTC, often without a `Z` suffix; browsers otherwise read those as local time.
 */
export function parseApiTimestamp(value?: string | null): number {
    if (!value) return NaN
    return Date.parse(normalizeApiTimestamp(value))
}

export function dateFromApiTimestamp(value?: string | null): Date | null {
    const stamp = parseApiTimestamp(value)
    return Number.isNaN(stamp) ? null : new Date(stamp)
}

export function formatApiTime(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
    const date = dateFromApiTimestamp(value)
    if (!date) return ''
    return date.toLocaleTimeString([], options ?? { hour: '2-digit', minute: '2-digit' })
}

export function formatApiDateTime(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
    const date = dateFromApiTimestamp(value)
    if (!date) return ''
    return new Intl.DateTimeFormat(
        undefined,
        options ?? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
    ).format(date)
}

/**
 * Format an ISO timestamp relative to `now` ("2m ago", "in 3h"). Timestamps
 * within 45 seconds of `now` collapse to the locale's "now". Returns '' for
 * missing or unparseable input. `now` is injectable for deterministic tests.
 */
export function formatRelativeTime(value?: string | null, now: number = Date.now()): string {
    const stamp = parseApiTimestamp(value)
    if (Number.isNaN(stamp)) return ''
    if (Math.abs(stamp - now) < 45_000) return RTF.format(0, 'second')
    let duration = (stamp - now) / 1000
    for (const division of DIVISIONS) {
        if (Math.abs(duration) < division.amount) return RTF.format(Math.round(duration), division.unit)
        duration /= division.amount
    }
    return ''
}
