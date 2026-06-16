/**
 * Explicit card versioning + usage metadata (character / world / item only).
 *
 * Versions are created by an explicit "Save version" action; normal edits update the
 * card in place. A session/story that clones a card pins the card id + version it cloned,
 * so the app can show an informative "newer version available" notice on load.
 */

/** Card types that carry version history + usage. Adventures are never versioned. */
export type VersionableCardType = 'character' | 'world' | 'item'

/** One immutable saved version of a card body. */
export interface CardVersion {
    version_id: string
    version_number: number
    /** Optional human-readable label captured at save time. */
    label?: string | null
    name?: string
    created_at?: string | null
}

/** Response of `GET /{cards}/{id}/versions`: the history plus the current latest pointer. */
export interface CardVersionList {
    card_id: string
    latest_version_id?: string | null
    latest_version_number: number
    versions: CardVersion[]
}

/** Derived usage for a card: distinct sessions (adventures + chats) and stories. */
export interface CardUsage {
    sessions: number
    stories: number
}
