/**
 * Workspace R1 response contracts (docs/workspace_r1/15_execution_contracts.md).
 *
 * Strict shape checks for the new workspace/collection/library/copy DTOs, the
 * server-owned `organization` metadata that private read DTOs gain, and the
 * helpers that keep that metadata out of everything the client writes back.
 */
import type {
    CardOrganization,
    Collection,
    CollectionList,
    ContentResolution,
    CopyResult,
    LibraryPage,
    MembershipResult,
    OrganizationWarning,
    RootOrganization,
    Workspace,
    WorkspaceErrorCode,
    WorkspaceList,
    WorkspaceMediaPage,
} from '@/shared/types/workspace.types'

/** The capability contract this build implements. */
export const WORKSPACE_CONTRACT_VERSION = 1
export const WORKSPACE_SCHEMA_REVISION = '2026_10_workspace_r1'
/** `X-Initial-Collection-Ids` carries at most this many collection IDs. */
export const MAX_INITIAL_COLLECTION_IDS = 20
export const MAX_COPY_CARDS = 20

export const WORKSPACE_ERROR_CODES: ReadonlySet<WorkspaceErrorCode> = new Set<WorkspaceErrorCode>([
    'WORKSPACE_REQUIRED', 'WORKSPACE_SELECTOR_MISMATCH', 'WORKSPACE_INPUT_INVALID', 'COLLECTION_INPUT_INVALID',
    'WORKSPACE_NOT_FOUND', 'COLLECTION_NOT_FOUND', 'CONTENT_NOT_FOUND',
    'WORKSPACE_ARCHIVED', 'WORKSPACE_DEFAULT_PROTECTED', 'WORKSPACE_ACTIVE_CALL',
    'WORKSPACE_VERSION_CONFLICT', 'COLLECTION_VERSION_CONFLICT', 'COPY_REQUEST_CONFLICT',
    'WORKSPACE_VERSION_REQUIRED', 'COLLECTION_VERSION_REQUIRED',
    'COPY_LIMIT_EXCEEDED', 'WORKSPACE_REQUEST_LIMIT_EXCEEDED', 'WORKSPACE_CAPABILITY_UNAVAILABLE',
])

export function isWorkspaceErrorCode(value: unknown): value is WorkspaceErrorCode {
    return typeof value === 'string' && WORKSPACE_ERROR_CODES.has(value as WorkspaceErrorCode)
}

type RecordValue = Record<string, unknown>

const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value)
const exact = (value: RecordValue, keys: readonly string[]): boolean =>
    Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const nullableText = (value: unknown): boolean => value === null || typeof value === 'string'
const count = (value: unknown, minimum = 0): value is number =>
    Number.isSafeInteger(value) && !Object.is(value, -0) && (value as number) >= minimum

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const CARD_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/
const CARD_TYPES = ['character', 'world', 'adventure_template', 'item']
const PREFERRED_USES = ['library', 'writing', 'roleplay', 'sandbox']
const CONTENT_KINDS = ['card', 'lorebook', 'resource', 'story', 'session', 'assistant_conversation', 'image_job', 'theme_song_job', 'tts_job']
const MEDIA_KINDS = ['image', 'theme_song', 'tts']

/** New workspace/collection IDs are lowercase UUID strings. */
export function isWorkspaceUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID.test(value)
}

export function isCopyRequestId(value: unknown): value is string {
    return typeof value === 'string' && REQUEST_ID.test(value)
}

/**
 * Canonical `X-Initial-Collection-Ids` value: up to 20 distinct lowercase
 * UUIDs. Throws on malformed input instead of letting the server reject it.
 */
export function canonicalInitialCollectionIds(ids: readonly string[] | undefined): readonly string[] {
    const values = [...(ids ?? [])]
    if (values.length > MAX_INITIAL_COLLECTION_IDS || values.some((id) => !isWorkspaceUuid(id)) || new Set(values).size !== values.length) {
        throw new Error('Initial collection IDs must be at most 20 distinct lowercase UUIDs.')
    }
    return Object.freeze(values)
}

export type WorkspaceCapabilityVerdict = 'supported' | 'predecessor' | 'newer'

/**
 * Classify `GET /workspaces/capabilities` (document 08, Startup handshake):
 * `supported` continues; `predecessor` (no `workspace_r1`, an older or
 * malformed contract) blocks private pages; `newer` means this build is stale.
 */
export function classifyWorkspaceCapabilities(value: unknown): WorkspaceCapabilityVerdict {
    if (!record(value) || value.workspace_r1 !== true || !count(value.contract_version, 0)) return 'predecessor'
    if (value.contract_version > WORKSPACE_CONTRACT_VERSION) return 'newer'
    if (value.contract_version < WORKSPACE_CONTRACT_VERSION) return 'predecessor'
    return value.schema_revision === WORKSPACE_SCHEMA_REVISION ? 'supported' : 'predecessor'
}

export function isCardOrganization(value: unknown): value is CardOrganization {
    if (!record(value) || !exact(value, ['workspace_id', 'collection_ids']) || !isWorkspaceUuid(value.workspace_id)) return false
    const ids = value.collection_ids
    return Array.isArray(ids) && ids.every(isWorkspaceUuid) && new Set(ids).size === ids.length
}

export function isRootOrganization(value: unknown): value is RootOrganization {
    return record(value) && exact(value, ['workspace_id']) && isWorkspaceUuid(value.workspace_id)
}

export function isOrganizationWarnings(value: unknown): value is OrganizationWarning[] {
    return Array.isArray(value) && value.every((warning) => record(warning) && exact(warning, ['code', 'collection_id'])
        && warning.code === 'COLLECTION_REMOVED' && isWorkspaceUuid(warning.collection_id))
}

/** A read DTO's optional organization: absent, or exactly the expected shape. */
export function hasValidOptionalOrganization(value: RecordValue, kind: 'card' | 'root'): boolean {
    if (!Object.prototype.hasOwnProperty.call(value, 'organization') || value.organization === undefined) return true
    return kind === 'card' ? isCardOrganization(value.organization) : isRootOrganization(value.organization)
}

/** Keep a validated card organization from a raw read row (dropped when malformed). */
export function readCardOrganization(value: unknown): CardOrganization | undefined {
    return isCardOrganization(value) ? { workspace_id: value.workspace_id, collection_ids: [...value.collection_ids] } : undefined
}

/** Keep a validated root organization from a raw read row (dropped when malformed). */
export function readRootOrganization(value: unknown): RootOrganization | undefined {
    return isRootOrganization(value) ? { workspace_id: value.workspace_id } : undefined
}

/** Server-owned fields a read DTO can carry and the client never writes back. */
export const SERVER_ORGANIZATION_FIELDS = ['organization', 'organization_warnings'] as const

/**
 * Remove server-owned organization metadata from one body (shallow). Bodies
 * the client builds field by field are already clean; this is the boundary
 * guard for writes that start from a read DTO.
 */
export function stripOrganization<T>(value: T): T {
    if (!record(value) || !SERVER_ORGANIZATION_FIELDS.some((key) => key in value)) return value
    const copy: RecordValue = { ...value }
    for (const key of SERVER_ORGANIZATION_FIELDS) delete copy[key]
    return copy as T
}

/**
 * Strip organization from a card body and from the cards embedded in an
 * adventure-template body (persona, cast, worlds). Only these known card
 * positions are touched: user-defined attribute keys may legitimately be
 * called "organization".
 */
export function stripCardBodyOrganization<T>(value: T): T {
    const body = stripOrganization(value)
    if (!record(body)) return body
    const nested: RecordValue = {}
    if (record(body.persona)) nested.persona = stripOrganization(body.persona)
    if (Array.isArray(body.characters)) nested.characters = body.characters.map(stripOrganization)
    if (Array.isArray(body.world)) nested.world = body.world.map(stripOrganization)
    else if (record(body.world)) nested.world = stripOrganization(body.world)
    return (Object.keys(nested).length ? { ...body, ...nested } : body) as T
}

export function verifyWorkspace(value: unknown): value is Workspace {
    return record(value)
        && exact(value, ['id', 'name', 'description', 'preferred_use', 'is_default', 'archived_at', 'row_version', 'created_at', 'updated_at'])
        && isWorkspaceUuid(value.id) && text(value.name) && nullableText(value.description)
        && PREFERRED_USES.includes(value.preferred_use as string) && typeof value.is_default === 'boolean'
        && nullableText(value.archived_at) && count(value.row_version, 1) && text(value.created_at) && text(value.updated_at)
}

export function verifyWorkspaceList(value: unknown): value is WorkspaceList {
    if (!record(value) || !exact(value, ['items', 'default_workspace_id']) || !isWorkspaceUuid(value.default_workspace_id)
        || !Array.isArray(value.items) || !value.items.every(verifyWorkspace)) return false
    const items = value.items as Workspace[]
    const defaults = items.filter((workspace) => workspace.is_default)
    return new Set(items.map((workspace) => workspace.id)).size === items.length
        && defaults.length === 1 && defaults[0].id === value.default_workspace_id && defaults[0].archived_at === null
}

export function verifyCollection(value: unknown, workspaceId?: string): value is Collection {
    return record(value)
        && exact(value, ['id', 'workspace_id', 'name', 'description', 'position', 'card_count', 'row_version', 'created_at', 'updated_at'])
        && isWorkspaceUuid(value.id) && isWorkspaceUuid(value.workspace_id)
        && (workspaceId === undefined || value.workspace_id === workspaceId)
        && text(value.name) && nullableText(value.description) && count(value.position) && count(value.card_count)
        && count(value.row_version, 1) && text(value.created_at) && text(value.updated_at)
}

export function verifyCollectionList(value: unknown, workspaceId: string): value is CollectionList {
    return record(value) && exact(value, ['items']) && Array.isArray(value.items)
        && value.items.every((item) => verifyCollection(item, workspaceId))
}

export function verifyMembershipResult(value: unknown, collectionId: string): value is MembershipResult {
    return record(value) && exact(value, ['collection_id', 'added', 'removed', 'unchanged'])
        && value.collection_id === collectionId && count(value.added) && count(value.removed) && count(value.unchanged)
}

function isCardIdentity(value: unknown): boolean {
    return record(value) && exact(value, ['card_type', 'card_id']) && CARD_TYPES.includes(value.card_type as string)
        && typeof value.card_id === 'string' && CARD_ID.test(value.card_id)
}

function isPage(value: RecordValue): boolean {
    return exact(value, ['items', 'total', 'limit', 'offset']) && Array.isArray(value.items)
        && count(value.total) && count(value.limit, 1) && count(value.offset)
}

export function verifyLibraryPage(value: unknown, workspaceId: string): value is LibraryPage {
    return record(value) && isPage(value) && (value.items as unknown[]).every((item) => record(item)
        && exact(item, ['card_type', 'card']) && CARD_TYPES.includes(item.card_type as string) && record(item.card)
        && isCardOrganization(item.card.organization) && item.card.organization.workspace_id === workspaceId)
}

export function verifyWorkspaceMediaPage(value: unknown, workspaceId: string, mediaKind: string): value is WorkspaceMediaPage {
    return record(value) && isPage(value) && (value.items as unknown[]).every((item) => record(item)
        && exact(item, ['media_kind', 'asset_id', 'job_id', 'organization', 'asset'])
        && MEDIA_KINDS.includes(item.media_kind as string) && item.media_kind === mediaKind
        && text(item.asset_id) && nullableText(item.job_id) && isRootOrganization(item.organization)
        && item.organization.workspace_id === workspaceId && record(item.asset))
}

export function verifyCopyResult(value: unknown, requestId: string, destinationId: string): value is CopyResult {
    if (!record(value) || !exact(value, ['request_id', 'source_workspace_id', 'destination_workspace_id', 'cards', 'lorebooks', 'resources'])
        || value.request_id !== requestId || value.destination_workspace_id !== destinationId
        || !isWorkspaceUuid(value.source_workspace_id)) return false
    return Array.isArray(value.cards) && value.cards.every((card) => record(card) && exact(card, ['source', 'destination'])
            && isCardIdentity(card.source) && isCardIdentity(card.destination))
        && Array.isArray(value.lorebooks) && value.lorebooks.every((book) => record(book)
            && exact(book, ['source_id', 'source_state_hash', 'destination_id'])
            && text(book.source_id) && text(book.source_state_hash) && text(book.destination_id))
        && Array.isArray(value.resources) && value.resources.every((resource) => record(resource)
            && exact(resource, ['source_id', 'destination_id']) && text(resource.source_id) && text(resource.destination_id))
}

export function verifyContentResolution(value: unknown, kind: string, id: string): value is ContentResolution {
    return record(value) && exact(value, ['workspace_id', 'archived', 'kind', 'id']) && isWorkspaceUuid(value.workspace_id)
        && typeof value.archived === 'boolean' && CONTENT_KINDS.includes(value.kind as string) && value.kind === kind && value.id === id
}
