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

/**
 * Format an ISO timestamp relative to `now` ("2m ago", "in 3h"). Timestamps
 * within 45 seconds of `now` collapse to the locale's "now". Returns '' for
 * missing or unparseable input. `now` is injectable for deterministic tests.
 */
export function formatRelativeTime(value?: string | null, now: number = Date.now()): string {
    const stamp = Date.parse(value || '')
    if (Number.isNaN(stamp)) return ''
    if (Math.abs(stamp - now) < 45_000) return RTF.format(0, 'second')
    let duration = (stamp - now) / 1000
    for (const division of DIVISIONS) {
        if (Math.abs(duration) < division.amount) return RTF.format(Math.round(duration), division.unit)
        duration /= division.amount
    }
    return ''
}
