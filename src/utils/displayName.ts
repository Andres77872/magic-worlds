/**
 * Resolves the name shown to people: a user's chosen `display_name` when set,
 * otherwise their immutable login `username`. The backend stores `display_name`
 * raw (nullable) and exposes both fields on the user, the profile, and on card
 * creator attribution (`CardActor`); this single helper owns the fallback so the
 * rule is identical in the profile hero, the sidebar, and community-card credits.
 *
 * Returns `''` only when both are empty/absent (e.g. a sparse `CardActor`), so
 * callers can fall back to their own placeholder.
 */

interface NamedEntity {
    display_name?: string | null
    username?: string | null
}

export function effectiveName(entity: NamedEntity | null | undefined): string
export function effectiveName(displayName: string | null | undefined, username: string | null | undefined): string
export function effectiveName(
    a: NamedEntity | string | null | undefined,
    b?: string | null,
): string {
    const displayName = typeof a === 'object' && a !== null ? a.display_name : a
    const username = typeof a === 'object' && a !== null ? a.username : b

    const trimmed = (displayName ?? '').trim()
    if (trimmed.length > 0) return trimmed
    return (username ?? '').trim()
}
