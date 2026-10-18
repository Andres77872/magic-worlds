/** A real calendar date written YYYY-MM-DD. */
export function isCalendarDate(v: unknown): v is string {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
    const date = new Date(v + 'T00:00:00Z')
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
    return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000)
}

/** The date `days` after `date` (YYYY-MM-DD). */
export function addDays(date: string, days: number): string {
    const value = new Date(date + 'T00:00:00Z')
    value.setUTCDate(value.getUTCDate() + days)
    return value.toISOString().slice(0, 10)
}
