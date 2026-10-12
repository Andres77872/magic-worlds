import type { PageType } from '@/shared'
import type { ContentResolveQuery, WorkspaceCardType } from '@/shared/types'
import { readAuthDeepLinkToken, type AuthDeepLinkKind } from '@/app/bootstrap/authDeepLink'
import { isWorkspaceUuid } from '@/infrastructure/api/workspaceContract'
import type { GalleryType } from './galleryConfig'

const TYPE_TO_SEGMENT: Record<GalleryType, string> = {
    character: 'characters',
    persona: 'personas',
    world: 'worlds',
    item: 'items',
    adventure: 'adventures',
}

const SEGMENT_TO_TYPE: Record<string, GalleryType> = {
    characters: 'character',
    personas: 'persona',
    worlds: 'world',
    items: 'item',
    adventures: 'adventure',
}

const TYPE_TO_PAGE: Record<GalleryType, PageType> = {
    character: 'gallery-characters',
    persona: 'gallery-personas',
    world: 'gallery-worlds',
    item: 'gallery-items',
    adventure: 'gallery-adventures',
}

const PAGE_TO_HASH: Record<PageType, string> = {
    landing: '#/',
    library: '#/library',
    character: '#/character',
    world: '#/world',
    item: '#/item',
    adventure: '#/adventure',
    lorebook: '#/lorebook',
    interaction: '#/interaction',
    'character-chat': '#/character-chat',
    chatroom: '#/chatroom',
    'active-adventures': '#/active-adventures',
    notifications: '#/notifications',
    calls: '#/calls',
    community: '#/community',
    assistant: '#/assistant',
    'shared-card': '#/shared',
    profile: '#/profile',
    'llm-profiles': '#/models',
    'admin-llm-profiles': '#/admin/llm-profiles',
    'image-profiles': '#/image-models',
    'admin-image-profiles': '#/admin/image-profiles',
    billing: '#/billing',
    'voice-studio': '#/voices',
    'admin-voices': '#/admin/voices',
    'admin-agents': '#/admin/agents',
    'admin-credit-codes': '#/admin/credit-codes',
    'admin-membership': '#/admin/membership',
    docs: '#/docs',
    about: '#/about',
    contact: '#/contact',
    privacy: '#/privacy',
    disclaimer: '#/disclaimer',
    'gallery-characters': '#/gallery/characters',
    'gallery-personas': '#/gallery/personas',
    'gallery-worlds': '#/gallery/worlds',
    'gallery-items': '#/gallery/items',
    'gallery-adventures': '#/gallery/adventures',
    'gallery-lorebooks': '#/gallery/lorebooks',
    'gallery-resources': '#/gallery/resources',
    'gallery-media': '#/gallery/media',
    'gallery-stories': '#/gallery/stories',
    story: '#/story',
    'password-reset': '#/password-reset',
    'verify-email': '#/verify-email',
    'google-callback': '#/google-callback',
    'not-found': '#/404',
}

const HASH_TO_PAGE = Object.entries(PAGE_TO_HASH).reduce<Record<string, PageType>>((acc, [page, hash]) => {
    acc[hash] = page as PageType
    return acc
}, {})

// Legacy deep link: the membership console used to live on the credit-codes page.
HASH_TO_PAGE['#/admin/membership-management'] = 'admin-membership'

export interface GalleryHashTarget {
    type: GalleryType
    page: PageType
    cardId?: string
    mode?: 'group-chat'
    view?: 'public'
}

export function galleryPageForType(type: GalleryType): PageType {
    return TYPE_TO_PAGE[type]
}

export function pageHash(page: PageType): string {
    return PAGE_TO_HASH[page] ?? '#/'
}

export function buildGalleryCardHash(type: GalleryType, cardId: string): string {
    const params = new URLSearchParams({ card: cardId })
    return `#/gallery/${TYPE_TO_SEGMENT[type]}?${params.toString()}`
}

export function buildGalleryViewHash(type: GalleryType, view?: GalleryHashTarget['view']): string {
    const params = new URLSearchParams()
    if (view) params.set('view', view)
    const query = params.toString()
    return `#/gallery/${TYPE_TO_SEGMENT[type]}${query ? `?${query}` : ''}`
}

export function buildGalleryModeHash(type: GalleryType, mode: GalleryHashTarget['mode']): string {
    const params = new URLSearchParams()
    if (mode) params.set('mode', mode)
    const query = params.toString()
    return `#/gallery/${TYPE_TO_SEGMENT[type]}${query ? `?${query}` : ''}`
}

export function buildGalleryCardUrl(type: GalleryType, cardId: string): string {
    const hash = buildGalleryCardHash(type, cardId)
    if (typeof window === 'undefined') return hash
    return `${window.location.origin}${window.location.pathname}${hash}`
}

export function buildSharedCardHash(token: string): string {
    return `#/shared/${encodeURIComponent(token)}`
}

export function buildSharedCardUrl(token: string): string {
    const hash = buildSharedCardHash(token)
    if (typeof window === 'undefined') return hash
    return `${window.location.origin}${window.location.pathname}${hash}`
}

export function parseSharedCardToken(hash: string = typeof window === 'undefined' ? '' : window.location.hash): string | null {
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    const [path] = withoutHash.split('?')
    const match = path.match(/^\/shared\/([^/?#]+)$/)
    if (!match) return null
    return decodeURIComponent(match[1])
}

export function parseGalleryHash(hash: string = typeof window === 'undefined' ? '' : window.location.hash): GalleryHashTarget | null {
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    const [path, query = ''] = withoutHash.split('?')
    const match = path.match(/^\/gallery\/([^/?#]+)$/)
    if (!match) return null
    const type = SEGMENT_TO_TYPE[match[1]]
    if (!type) return null
    const params = new URLSearchParams(query)
    const cardId = params.get('card') || undefined
    const mode = type === 'character' && params.get('mode') === 'group-chat' ? 'group-chat' : undefined
    const view = params.get('view') === 'public' ? 'public' : undefined
    return { type, page: TYPE_TO_PAGE[type], cardId, mode, view }
}

// --- Card editor deep-links (character / world / item) -----------------------------
// The editor for a versionable card lives at `#/<type>?card=<id>[&version=<v>]`, reusing the
// same query convention as the gallery `?card=` links. The bare `#/<type>` (no `card`) stays the
// "create" route, so `pageFromHash` needs no change — only param extraction is new.

/** Versionable card types that have a deep-linkable editor (persona edits via `character`). */
export type CardEditType = 'character' | 'world' | 'item'

/** Version selector in the URL: the private draft, the latest published, or a specific version. */
export type CardEditVersion = 'draft' | 'latest' | number

export interface CardEditHashTarget {
    page: PageType
    cardType: CardEditType
    cardId: string
    /** undefined ⇒ server default (draft if one exists, else the latest published body). */
    version?: CardEditVersion
}

/** Normalize a raw `version` query value to `draft` | `latest` | a positive integer | undefined. */
function normalizeCardEditVersion(raw: string | null): CardEditVersion | undefined {
    if (!raw) return undefined
    if (raw === 'draft' || raw === 'latest') return raw
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : undefined
}

export function buildCardEditHash(cardType: CardEditType, cardId: string, version?: CardEditVersion): string {
    const params = new URLSearchParams({ card: cardId })
    if (version !== undefined) params.set('version', String(version))
    return `#/${cardType}?${params.toString()}`
}

export function parseCardEditHash(
    hash: string = typeof window === 'undefined' ? '' : window.location.hash,
): CardEditHashTarget | null {
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    const [path, query = ''] = withoutHash.split('?')
    const match = path.match(/^\/(character|world|item)$/)
    if (!match) return null
    const cardType = match[1] as CardEditType
    const cardId = new URLSearchParams(query).get('card')
    if (!cardId) return null
    return {
        page: cardType,
        cardType,
        cardId,
        version: normalizeCardEditVersion(new URLSearchParams(query).get('version')),
    }
}

// --- Adventure / lorebook / story editor deep-links ---------------------------------
// `#/adventure?card=<id>`, `#/lorebook?lorebook=<id>` and `#/story?story=<id>` open those
// editors on a library record (e.g. in a new browser tab). Unlike the versionable cards
// above, these editors take the record from the library DataProvider already holds
// (`LinkedEditorGate`).

export type LinkedEditorPage = 'adventure' | 'lorebook' | 'story'

const LINKED_EDITOR_PARAM: Record<LinkedEditorPage, string> = { adventure: 'card', lorebook: 'lorebook', story: 'story' }

export function buildLinkedEditorHash(page: LinkedEditorPage, id: string): string {
    return `${pageHash(page)}?${new URLSearchParams({ [LINKED_EDITOR_PARAM[page]]: id }).toString()}`
}

export function parseLinkedEditorId(
    page: LinkedEditorPage,
    hash: string = typeof window === 'undefined' ? '' : window.location.hash,
): string | null {
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    const [path, query = ''] = withoutHash.split('?')
    if (path !== `/${page}`) return null
    return new URLSearchParams(query).get(LINKED_EDITOR_PARAM[page]) || null
}

// --- Lorebook resource deep-links --------------------------------------------------
// A single resource opens at `#/gallery/resources?resource=<id>` — a dedicated in-page
// view (not a slide-in drawer). `?resource=new&type=md|txt` opens the create form. The
// query is ignored by `pageFromHash` route matching (it strips the query first), so the
// page stays `gallery-resources`; only param extraction is new — mirrors `parseCardEditHash`.

export interface ResourceEditHashTarget {
    /** Always `gallery-resources` — kept for symmetry with the other hash targets. */
    page: PageType
    /** A resource id, or the literal `new` for the create form. */
    resourceId: string
    /** File type for a fresh resource; only meaningful when `resourceId === 'new'`. */
    createType?: 'md' | 'txt'
}

export function buildResourceHash(resourceId: string, createType?: 'md' | 'txt'): string {
    const params = new URLSearchParams({ resource: resourceId })
    if (resourceId === 'new' && createType) params.set('type', createType)
    return `#/gallery/resources?${params.toString()}`
}

export function parseResourceEditHash(
    hash: string = typeof window === 'undefined' ? '' : window.location.hash,
): ResourceEditHashTarget | null {
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    const [path, query = ''] = withoutHash.split('?')
    if (path !== '/gallery/resources') return null
    const params = new URLSearchParams(query)
    const resourceId = params.get('resource')
    if (!resourceId) return null
    const rawType = params.get('type')
    const createType = rawType === 'md' || rawType === 'txt' ? rawType : undefined
    return { page: 'gallery-resources', resourceId, createType }
}

export function pageFromHash(hash: string = typeof window === 'undefined' ? '' : window.location.hash): PageType | null {
    if (parseSharedCardToken(hash)) return 'shared-card'
    const gallery = parseGalleryHash(hash)
    if (gallery) return gallery.page
    const normalized = (hash || '#/').split('?')[0]
    if (normalized === '#/community' || normalized.startsWith('#/community/')) return 'community'
    return HASH_TO_PAGE[normalized] ?? null
}

/**
 * Resolve the single-use token for an auth deep-link page. Prefers the token the
 * bootstrap lifted out of the provider URL (`authDeepLink`); falls back to an
 * in-app hash form (`#/password-reset?token=...`) so the route also works when
 * navigated to directly. Returns null when no token is present.
 */
export function parseAuthToken(
    kind: AuthDeepLinkKind,
    hash: string = typeof window === 'undefined' ? '' : window.location.hash,
): string | null {
    const stashed = readAuthDeepLinkToken(kind)
    if (stashed) return stashed
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    const [, query = ''] = withoutHash.split('?')
    return new URLSearchParams(query).get('token') || null
}

// --- Workspace R1 hashes (document 08 "Selected URL and browser-history algorithm") ---
// Private content routes carry `workspace=<uuid>` (first query param) when the
// workspace UI is enabled, e.g. `#/character?workspace=<uuid>&card=<id>`. Global
// auth/profile/billing/admin/community/share routes keep their hashes.

function splitAppHash(hash: string): { path: string; params: URLSearchParams } {
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    const queryIndex = withoutHash.indexOf('?')
    return {
        path: queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex),
        params: new URLSearchParams(queryIndex === -1 ? '' : withoutHash.slice(queryIndex + 1)),
    }
}

function joinAppHash(path: string, params: URLSearchParams): string {
    const query = params.toString()
    return `#${path || '/'}${query ? `?${query}` : ''}`
}

/** The `workspace` param of an app hash when it is a workspace UUID, else null. */
export function readHashWorkspace(hash: string = typeof window === 'undefined' ? '' : window.location.hash): string | null {
    const value = splitAppHash(hash).params.get('workspace')
    return isWorkspaceUuid(value) ? value : null
}

/** The hash with `workspace=<id>` as its first param (replacing any previous one). */
export function withHashWorkspace(hash: string, workspaceId: string): string {
    const { path, params } = splitAppHash(hash || '#/')
    const next = new URLSearchParams({ workspace: workspaceId })
    params.forEach((value, key) => {
        if (key !== 'workspace') next.append(key, value)
    })
    return joinAppHash(path, next)
}

/** An owned type-gallery hash the Library replaces (flag on); public/group-chat views stay galleries. */
export interface LegacyGalleryTarget {
    typeFilter: GalleryType
    cardId: string | null
}

export function legacyGalleryTarget(hash: string): LegacyGalleryTarget | null {
    const target = parseGalleryHash(hash)
    if (!target || target.view === 'public' || target.mode === 'group-chat') return null
    return { typeFilter: target.type, cardId: target.cardId ?? null }
}

/**
 * The owned record a legacy content link names, for `resolve-content` before
 * loading (never resolved under the active workspace just because the URL
 * lacks the parameter). `null` when the hash names no stored record.
 */
export function legacyContentRef(page: PageType, hash: string): ContentResolveQuery | null {
    const { params } = splitAppHash(hash)
    const card = params.get('card')
    switch (page) {
        case 'character':
        case 'world':
        case 'item':
            return card ? { kind: 'card', id: card, card_type: page } : null
        case 'adventure':
            return card ? { kind: 'card', id: card, card_type: 'adventure_template' } : null
        case 'lorebook': {
            const id = params.get('lorebook')
            return id ? { kind: 'lorebook', id } : null
        }
        case 'story': {
            const id = params.get('story')
            return id ? { kind: 'story', id } : null
        }
        case 'gallery-resources': {
            const id = params.get('resource')
            return id && id !== 'new' ? { kind: 'resource', id } : null
        }
        case 'gallery-characters':
        case 'gallery-personas':
        case 'gallery-worlds':
        case 'gallery-items':
        case 'gallery-adventures': {
            const target = parseGalleryHash(hash)
            if (!target?.cardId || target.view === 'public') return null
            return { kind: 'card', id: target.cardId, card_type: backendCardType(target.type) }
        }
        default:
            return null
    }
}

function backendCardType(type: GalleryType): WorkspaceCardType {
    if (type === 'adventure') return 'adventure_template'
    if (type === 'persona') return 'character'
    return type
}

// --- Creator role hint -----------------------------------------------------------------
// The Library's New › Persona opens the existing character creator preset to the
// persona role: `#/character?role=persona`. It only seeds a new card's role.

export function buildPersonaCreatorHash(): string {
    return `${pageHash('character')}?${new URLSearchParams({ role: 'persona' }).toString()}`
}

/** True when a new-character hash asks for the persona role. */
export function isPersonaCreatorHash(hash: string = typeof window === 'undefined' ? '' : window.location.hash): boolean {
    const { path, params } = splitAppHash(hash)
    return path === '/character' && !params.get('card') && params.get('role') === 'persona'
}
