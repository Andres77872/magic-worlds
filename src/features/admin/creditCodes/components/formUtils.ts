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

/** Split a free-text blob into a de-duplicated list of emails (comma / whitespace / newline separated). */
export function parseEmails(raw: string): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const token of raw.split(/[\s,;]+/)) {
        const email = token.trim().toLowerCase()
        if (email && !seen.has(email)) {
            seen.add(email)
            result.push(email)
        }
    }
    return result
}
