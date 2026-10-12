/**
 * Workspace R1 DTOs (docs/workspace_r1/15_execution_contracts.md).
 *
 * These mirror the BFF's strict response models exactly: personal workspaces,
 * flat collections, card membership, the mixed library list, workspace media
 * and the all-or-nothing card copy. IDs of workspaces and collections are
 * lowercase UUID strings; existing card/resource IDs keep their own formats.
 *
 * `organization` on private read DTOs is server-owned metadata: the client
 * reads it but never sends it back in create/update bodies, drafts, versions,
 * snapshots, exports or model prompts (see `stripOrganization`).
 */

/** The four persisted card types (`adventure_template` is the adventure card). */
export type WorkspaceCardType = 'character' | 'world' | 'adventure_template' | 'item'

/** Preferred use only chooses the landing page; it never restricts features. */
export type WorkspacePreferredUse = 'library' | 'writing' | 'roleplay' | 'sandbox'

export interface Workspace {
    id: string
    name: string
    description: string | null
    preferred_use: WorkspacePreferredUse
    /** The protected default: renameable, never archivable. */
    is_default: boolean
    archived_at: string | null
    /** Optimistic-concurrency version; sent back as the quoted `If-Match`. */
    row_version: number
    created_at: string
    updated_at: string
}

export interface WorkspaceList {
    /** Default first, then created_at/id. */
    items: Workspace[]
    default_workspace_id: string
}

/** The startup handshake result of `GET /workspaces/capabilities`. */
export interface WorkspaceCapabilities {
    workspace_r1: true
    contract_version: 1
    schema_revision: '2026_10_workspace_r1'
}

export interface WorkspaceCreate {
    name: string
    description?: string | null
    preferred_use?: WorkspacePreferredUse
}

/** At least one field. */
export interface WorkspaceUpdate {
    name?: string
    description?: string | null
    preferred_use?: WorkspacePreferredUse
}

export interface Collection {
    id: string
    workspace_id: string
    name: string
    description: string | null
    position: number
    /** Read-only aggregate of accessible same-workspace memberships (all card types). */
    card_count: number
    row_version: number
    created_at: string
    updated_at: string
}

export interface CollectionList {
    /** Ordered position/created_at/id. */
    items: Collection[]
}

export interface CollectionCreate {
    name: string
    description?: string | null
    position?: number
}

/** At least one field. */
export interface CollectionUpdate {
    name?: string
    description?: string | null
    position?: number
}

export interface CardIdentity {
    card_type: WorkspaceCardType
    card_id: string
}

/** 1–200 distinct identities in total; add and remove never overlap. */
export interface MembershipCommand {
    add: CardIdentity[]
    remove: CardIdentity[]
}

export interface MembershipResult {
    collection_id: string
    added: number
    removed: number
    unchanged: number
}

/** Server-owned organization of a private card (sorted current memberships). */
export interface CardOrganization {
    workspace_id: string
    collection_ids: string[]
}

/** Server-owned organization of a story, session, lorebook, resource, assistant conversation or media job. */
export interface RootOrganization {
    workspace_id: string
}

/** A generated card whose requested initial collection was deleted while it ran. */
export interface OrganizationWarning {
    code: 'COLLECTION_REMOVED'
    collection_id: string
}

/** Fields a read DTO may carry that the client must never write back. */
export interface ServerOrganizationFields<O = CardOrganization | RootOrganization> {
    organization?: O
}

/** A library entry: the existing per-kind card read DTO plus its organization. */
export interface LibraryItem<C extends Record<string, unknown> = Record<string, unknown>> {
    card_type: WorkspaceCardType
    card: C & { organization: CardOrganization }
}

export interface LibraryPage<C extends Record<string, unknown> = Record<string, unknown>> {
    items: LibraryItem<C>[]
    total: number
    limit: number
    offset: number
}

/** `GET /workspaces/{id}/cards` filters; `collection_id` and `uncollected` are exclusive. */
export interface LibraryQuery {
    card_type?: WorkspaceCardType
    /** Requires `card_type: 'character'`. */
    character_role?: 'character' | 'persona'
    q?: string
    collection_id?: string
    uncollected?: boolean
    /** 1–100, default 24. */
    limit?: number
    /** 0–100000, default 0. */
    offset?: number
}

export interface CopyCommand {
    /** `[A-Za-z0-9._:-]{1,64}`; reuse it for Try again, mint a new one for Copy again. */
    request_id: string
    source_workspace_id: string
    /** 1–20 distinct cards. */
    cards: CardIdentity[]
    /** At most 20 distinct collection UUIDs of the destination. */
    destination_collection_ids: string[]
}

export interface CopiedCard {
    source: CardIdentity
    destination: CardIdentity
}

export interface CopiedLorebook {
    source_id: string
    source_state_hash: string
    destination_id: string
}

export interface CopiedResource {
    source_id: string
    destination_id: string
}

export interface CopyResult {
    request_id: string
    source_workspace_id: string
    destination_workspace_id: string
    cards: CopiedCard[]
    lorebooks: CopiedLorebook[]
    resources: CopiedResource[]
}

/** A copy outcome: 201 for the first success, 200 + `X-Idempotent-Replay` for a stored result. */
export interface CopyOutcome {
    result: CopyResult
    replayed: boolean
}

export type WorkspaceMediaKind = 'image' | 'theme_song' | 'tts'

export interface WorkspaceMediaItem {
    media_kind: WorkspaceMediaKind
    asset_id: string
    job_id: string | null
    organization: RootOrganization
    /** The existing type-specific asset projection. */
    asset: Record<string, unknown>
}

export interface WorkspaceMediaPage {
    items: WorkspaceMediaItem[]
    total: number
    limit: number
    offset: number
}

export interface WorkspaceMediaQuery {
    media_kind?: WorkspaceMediaKind
    limit?: number
    offset?: number
}

/** Root kinds `GET /workspaces/resolve-content` can locate. */
export type ContentKind =
    | 'card'
    | 'lorebook'
    | 'resource'
    | 'story'
    | 'session'
    | 'assistant_conversation'
    | 'image_job'
    | 'theme_song_job'
    | 'tts_job'

export interface ContentResolveQuery {
    kind: ContentKind
    id: string
    /** Only with `kind: 'card'`. */
    card_type?: WorkspaceCardType
}

export interface ContentResolution {
    workspace_id: string
    archived: boolean
    kind: ContentKind
    id: string
}

/** Named workspace error codes (`{detail: {code}}`). */
export type WorkspaceErrorCode =
    | 'WORKSPACE_REQUIRED'
    | 'WORKSPACE_SELECTOR_MISMATCH'
    | 'WORKSPACE_INPUT_INVALID'
    | 'COLLECTION_INPUT_INVALID'
    | 'WORKSPACE_NOT_FOUND'
    | 'COLLECTION_NOT_FOUND'
    | 'CONTENT_NOT_FOUND'
    | 'WORKSPACE_ARCHIVED'
    | 'WORKSPACE_DEFAULT_PROTECTED'
    | 'WORKSPACE_ACTIVE_CALL'
    | 'WORKSPACE_VERSION_CONFLICT'
    | 'COLLECTION_VERSION_CONFLICT'
    | 'COPY_REQUEST_CONFLICT'
    | 'WORKSPACE_VERSION_REQUIRED'
    | 'COLLECTION_VERSION_REQUIRED'
    | 'COPY_LIMIT_EXCEEDED'
    | 'WORKSPACE_REQUEST_LIMIT_EXCEEDED'
    | 'WORKSPACE_CAPABILITY_UNAVAILABLE'

/** Optional per-scope request header for creation/import/duplicate/generation routes. */
export interface WorkspaceScopeOptions {
    /** Up to 20 distinct destination collection UUIDs, sent as `X-Initial-Collection-Ids`. */
    initialCollectionIds?: readonly string[]
}
