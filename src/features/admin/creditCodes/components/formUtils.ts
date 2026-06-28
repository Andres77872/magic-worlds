/** Small input helpers shared by the credit-code create forms. */

/**
 * Convert a `datetime-local` field value (`YYYY-MM-DDTHH:mm`, local time) to an
 * ISO 8601 string the backend can parse, or null when blank/invalid.
 */
export function toIsoOrNull(value: string): string | null {
    const trimmed = value.trim()
    if (!trimmed) return null
    const date = new Date(trimmed)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Inverse of {@link toIsoOrNull}: render an ISO 8601 stamp as a local
 * `datetime-local` field value (`YYYY-MM-DDTHH:mm`), or '' when blank/invalid.
 */
export function toDateTimeLocal(iso: string | null | undefined): string {
    if (!iso) return ''
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
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
