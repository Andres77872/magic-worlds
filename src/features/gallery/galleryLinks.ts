import type { PageType } from '@/shared'
import { readAuthDeepLinkToken, type AuthDeepLinkKind } from '@/app/bootstrap/authDeepLink'
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

const PAGE_TO_HASH: Partial<Record<PageType, string>> = {
    landing: '#/',
    character: '#/character',
    world: '#/world',
    item: '#/item',
    adventure: '#/adventure',
    lorebook: '#/lorebook',
    interaction: '#/interaction',
    'character-chat': '#/character-chat',
    chatroom: '#/chatroom',
    'active-adventures': '#/active-adventures',
    calls: '#/calls',
    community: '#/community',
    'shared-card': '#/shared',
    profile: '#/profile',
    'voice-studio': '#/voices',
    'admin-voices': '#/admin/voices',
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
    'gallery-media': '#/gallery/media',
    'gallery-stories': '#/gallery/stories',
    story: '#/story',
    'password-reset': '#/password-reset',
    'verify-email': '#/verify-email',
    'google-callback': '#/google-callback',
}

const HASH_TO_PAGE = Object.entries(PAGE_TO_HASH).reduce<Record<string, PageType>>((acc, [page, hash]) => {
    acc[hash] = page as PageType
    return acc
}, {})

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
