/**
 * Library URLs (document 08 "Selected URL and browser-history algorithm").
 *
 * The canonical private card browser is
 * `#/library?workspace=<uuid>[&collection=<uuid>][&q=][&card_type=][&character_role=][&uncollected=true]`,
 * plus an optional transient `reveal=<card_type>:<card_id>` that pins one card
 * on top of the root (View card after a save hidden by the restored filters).
 * Parsing is strict and serializing is canonical, so a parse → build round trip
 * is stable and history entries compare by string.
 */
import type { LibraryQuery, WorkspaceCardType } from '@/shared/types'
import { isWorkspaceUuid } from '@/infrastructure/api/workspaceContract'
import type { LibraryLocation, LibraryTypeFilter } from './creationOrigin'

export const LIBRARY_PATH = '/library'
export const LIBRARY_PAGE_SIZE = 24

const CARD_TYPES: readonly WorkspaceCardType[] = ['character', 'world', 'adventure_template', 'item']
const CARD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const MAX_QUERY_LENGTH = 200

export const LIBRARY_TYPE_FILTERS: readonly LibraryTypeFilter[] = ['all', 'character', 'persona', 'world', 'item', 'adventure']

export interface LibraryCardRef {
    cardType: WorkspaceCardType
    cardId: string
}

export interface LibraryRoute {
    /** The workspace the URL names; `null` for a legacy/unstamped library link. */
    workspaceId: string | null
    /** The open folder; `null` at the library root. */
    collectionId: string | null
    query: string
    typeFilter: LibraryTypeFilter
    /** Root-only "Only uncollected" filter (ignored inside a folder). */
    uncollected: boolean
    reveal: LibraryCardRef | null
}

export const EMPTY_LIBRARY_ROUTE: LibraryRoute = Object.freeze({
    workspaceId: null,
    collectionId: null,
    query: '',
    typeFilter: 'all',
    uncollected: false,
    reveal: null,
}) as LibraryRoute

function isCardType(value: unknown): value is WorkspaceCardType {
    return typeof value === 'string' && (CARD_TYPES as readonly string[]).includes(value)
}

export function isLibraryCardId(value: unknown): value is string {
    return typeof value === 'string' && CARD_ID_PATTERN.test(value)
}

/** The `card_type`/`character_role` pair a type filter sends (Persona = character + persona role). */
export function typeFilterParams(filter: LibraryTypeFilter): Pick<LibraryQuery, 'card_type' | 'character_role'> {
    switch (filter) {
        case 'character':
            return { card_type: 'character', character_role: 'character' }
        case 'persona':
            return { card_type: 'character', character_role: 'persona' }
        case 'world':
            return { card_type: 'world' }
        case 'item':
            return { card_type: 'item' }
        case 'adventure':
            return { card_type: 'adventure_template' }
        default:
            return {}
    }
}

export function typeFilterFromParams(cardType: string | null, role: string | null): LibraryTypeFilter {
    if (cardType === 'character') return role === 'persona' ? 'persona' : 'character'
    if (cardType === 'world') return 'world'
    if (cardType === 'item') return 'item'
    if (cardType === 'adventure_template') return 'adventure'
    return 'all'
}

function splitHash(hash: string): { path: string; params: URLSearchParams } {
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    const queryIndex = withoutHash.indexOf('?')
    const path = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex)
    const query = queryIndex === -1 ? '' : withoutHash.slice(queryIndex + 1)
    return { path, params: new URLSearchParams(query) }
}

function parseReveal(raw: string | null): LibraryCardRef | null {
    if (!raw) return null
    const separator = raw.indexOf(':')
    if (separator <= 0) return null
    const cardType = raw.slice(0, separator)
    const cardId = raw.slice(separator + 1)
    return isCardType(cardType) && isLibraryCardId(cardId) ? { cardType, cardId } : null
}

/** Parses a library hash; `null` when the hash is not the library route. */
export function parseLibraryHash(hash: string = typeof window === 'undefined' ? '' : window.location.hash): LibraryRoute | null {
    const { path, params } = splitHash(hash)
    if (path !== LIBRARY_PATH) return null
    const workspace = params.get('workspace')
    const collection = params.get('collection')
    const collectionId = isWorkspaceUuid(collection) ? collection : null
    const query = (params.get('q') ?? '').slice(0, MAX_QUERY_LENGTH)
    return {
        workspaceId: isWorkspaceUuid(workspace) ? workspace : null,
        collectionId,
        query,
        typeFilter: typeFilterFromParams(params.get('card_type'), params.get('character_role')),
        uncollected: collectionId === null && params.get('uncollected') === 'true',
        reveal: parseReveal(params.get('reveal')),
    }
}

/** Canonical library hash; omitted/default fields are left out. */
export function buildLibraryHash(route: Partial<LibraryRoute> & { workspaceId: string | null }): string {
    const params = new URLSearchParams()
    if (route.workspaceId) params.set('workspace', route.workspaceId)
    if (route.collectionId) params.set('collection', route.collectionId)
    const query = route.query?.trim()
    if (query) params.set('q', query.slice(0, MAX_QUERY_LENGTH))
    const typeParams = typeFilterParams(route.typeFilter ?? 'all')
    if (typeParams.card_type) params.set('card_type', typeParams.card_type)
    if (typeParams.character_role) params.set('character_role', typeParams.character_role)
    if (!route.collectionId && route.uncollected) params.set('uncollected', 'true')
    if (route.reveal) params.set('reveal', `${route.reveal.cardType}:${route.reveal.cardId}`)
    const search = params.toString()
    return `#${LIBRARY_PATH}${search ? `?${search}` : ''}`
}

/** The server query of a location (without paging). Collection and uncollected stay exclusive. */
export function libraryQueryFor(route: Pick<LibraryRoute, 'collectionId' | 'query' | 'typeFilter' | 'uncollected'>): LibraryQuery {
    const query: LibraryQuery = { ...typeFilterParams(route.typeFilter) }
    const text = route.query.trim()
    if (text) query.q = text
    if (route.collectionId) query.collection_id = route.collectionId
    else if (route.uncollected) query.uncollected = true
    return query
}

/** A stable key of the server query, for caches and stale-result checks. */
export function libraryQueryKey(workspaceId: string, route: Pick<LibraryRoute, 'collectionId' | 'query' | 'typeFilter' | 'uncollected'>): string {
    const query = libraryQueryFor(route)
    return [workspaceId, query.collection_id ?? '', query.uncollected ? 'u' : '', query.card_type ?? '', query.character_role ?? '', query.q ?? ''].join('|')
}

/** The creation-origin return location of a route (document 08 "Creation from the unified library"). */
export function libraryLocationFor(route: LibraryRoute, scrollY: number | null = null): LibraryLocation {
    return {
        collectionId: route.collectionId,
        query: route.query,
        typeFilter: route.typeFilter,
        uncollected: route.collectionId === null && route.uncollected,
        scrollY,
    }
}

export function libraryRouteFromLocation(workspaceId: string, location: LibraryLocation, reveal: LibraryCardRef | null = null): LibraryRoute {
    return {
        workspaceId,
        collectionId: location.collectionId,
        query: location.query,
        typeFilter: location.typeFilter,
        uncollected: location.collectionId === null && location.uncollected,
        reveal,
    }
}

/** Whether a type filter would show a card of this type/role (used for the "hidden by filters" notice). */
export function typeFilterMatches(filter: LibraryTypeFilter, cardType: WorkspaceCardType, role?: string | null): boolean {
    if (filter === 'all') return true
    if (filter === 'persona') return cardType === 'character' && role === 'persona'
    if (filter === 'character') return cardType === 'character' && role !== 'persona'
    if (filter === 'adventure') return cardType === 'adventure_template'
    return cardType === filter
}
