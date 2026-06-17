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
    /** True when the owner has unpublished draft edits (additive — optional for compat). */
    has_draft?: boolean
    draft_updated_at?: string | null
    /** The published version the draft was forked from (drives "unsaved since v{n}"). */
    based_on_version_number?: number | null
}

/** Derived usage for a card: distinct sessions (adventures + chats) and stories. */
export interface CardUsage {
    sessions: number
    stories: number
}

/**
 * The editable body returned by `GET /{cards}/{id}/draft` — the private draft when one
 * exists, else the published body flagged `is_draft: false`. Carries the full card body
 * fields (name/description/category/props…) plus the draft markers below. Typed loosely
 * because the body shape differs per card type; callers narrow via the card mappers.
 */
export interface CardDraftDocument extends Record<string, unknown> {
    id?: string
    name?: string
    /** True when this body is the private draft; false when it's the published fallback. */
    is_draft?: boolean
    /** The published version this draft was forked from. */
    based_on_version_number?: number | null
    latest_version_number?: number
    /** True when this body is a read-only historical version (from `GET /{cards}/{id}/versions/{n}`). */
    is_historical?: boolean
    /** The version number this body represents (historical read-only view only). */
    viewing_version_number?: number
}

/**
 * Body returned by `GET /{cards}/{id}/versions/{n}` — a read-only snapshot of a past version.
 * Same shape as {@link CardDraftDocument} but always `is_draft: false` / `is_historical: true`;
 * `latest_version_*` still reflect the current head so "newer version available" can show.
 */
export type CardHistoricalDocument = CardDraftDocument

/** Result of `POST /{cards}/{id}/publish`: the new version + the published card document. */
export interface CardPublishResult {
    version_id: string
    version_number: number
    label?: string | null
    name?: string
    /** The freshly published card document (now live for sessions/clones). */
    card: CardDraftDocument
}
