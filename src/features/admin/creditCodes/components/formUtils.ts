/** Small input helpers shared by the credit-code create / edit forms. */
import { dateFromApiTimestamp } from '@/utils/time'

/**
 * Convert a `datetime-local` field value (`YYYY-MM-DDTHH:mm`, local wall clock)
 * to the timestamp shape the admin billing endpoints accept, or null when
 * blank/invalid.
 *
 * The API parses `expires_at` with Python's `datetime.fromisoformat` and then
 * rejects anything that is not a timezone-naive, whole-second stamp — so
 * `toISOString()` output (`2026-09-24T07:34:00.000Z`) fails validation. Naive
 * stamps are UTC on the wire (see {@link dateFromApiTimestamp}), so the local
 * wall clock is converted to UTC and truncated to seconds:
 * `2026-09-24T07:34:00`.
 */
export function toIsoOrNull(value: string): string | null {
    const trimmed = value.trim()
    if (!trimmed) return null
    // `datetime-local` text carries no offset, so `Date` reads it as local time.
    const date = new Date(trimmed)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString().slice(0, 19)
}

/**
 * Inverse of {@link toIsoOrNull}: render an API stamp as a local
 * `datetime-local` field value (`YYYY-MM-DDTHH:mm`), or '' when blank/invalid.
 * Offset-less stamps are read as UTC, matching what the backend returns.
 */
export function toDateTimeLocal(iso: string | null | undefined): string {
    const date = dateFromApiTimestamp(iso)
    if (!date) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Split a free-text blob into a de-duplicated list of emails (comma / whitespace / newline separated). */
export function parseEmails(raw: string): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const entry of raw.split(/[\s,;]+/)) {
        const email = entry.trim().toLowerCase()
        if (email && !seen.has(email)) {
            seen.add(email)
            result.push(email)
        }
    }
    return result
}
