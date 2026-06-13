import type { PageType } from '@/shared'
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
    profile: '#/profile',
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
}

const HASH_TO_PAGE = Object.entries(PAGE_TO_HASH).reduce<Record<string, PageType>>((acc, [page, hash]) => {
    acc[hash] = page as PageType
    return acc
}, {})

export interface GalleryHashTarget {
    type: GalleryType
    page: PageType
    cardId?: string
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

export function buildGalleryCardUrl(type: GalleryType, cardId: string): string {
    const hash = buildGalleryCardHash(type, cardId)
    if (typeof window === 'undefined') return hash
    return `${window.location.origin}${window.location.pathname}${hash}`
}

export function parseGalleryHash(hash: string = typeof window === 'undefined' ? '' : window.location.hash): GalleryHashTarget | null {
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    const [path, query = ''] = withoutHash.split('?')
    const match = path.match(/^\/gallery\/([^/?#]+)$/)
    if (!match) return null
    const type = SEGMENT_TO_TYPE[match[1]]
    if (!type) return null
    const cardId = new URLSearchParams(query).get('card') || undefined
    return { type, page: TYPE_TO_PAGE[type], cardId }
}

export function pageFromHash(hash: string = typeof window === 'undefined' ? '' : window.location.hash): PageType | null {
    const gallery = parseGalleryHash(hash)
    if (gallery) return gallery.page
    const normalized = (hash || '#/').split('?')[0]
    return HASH_TO_PAGE[normalized] ?? null
}
