/**
 * Per-type gallery configuration — copy, fetcher, and raw-row → GalleryItem
 * mapping for the three card libraries. GalleryPage and useCardGallery are
 * generic; everything type-specific lives here.
 */

import { Gem, Globe, Swords, UserCircle, Users, type LucideIcon } from 'lucide-react'
import type { Adventure, CardActor, CardVisibility, Character, Item, PageType, SharedCardResource, ShareableCardType, World } from '@/shared'
import { apiService, resolveMediaUrl } from '@/infrastructure/api'
import { effectiveName } from '@/utils/displayName'
import { transformCharacters, transformItems, transformTemplates, transformWorlds } from '../../utils/cardTransforms'
import { sceneTags, sceneTitle } from '../landing/components/sceneModel'

/** Creator/owner credit: prefer the chosen display name, fall back to username. */
function actorName(actor?: CardActor | null): string | null {
    return actor ? (effectiveName(actor) || null) : null
}

export type GalleryType = 'character' | 'persona' | 'world' | 'item' | 'adventure'

export interface GalleryItem {
    id: string
    title: string
    /** Identity badge: race / world type / world name. */
    badge?: string
    /** Mono "where" label above the name (adventures only). */
    eyebrow?: string
    /** One-line narrative hook shown under the name. */
    description?: string
    tags: string[]
    imageUrl?: string
    themeSongUrl?: string
    visibility?: CardVisibility
    resource?: SharedCardResource
    ownerName?: string | null
    originalCreatorName?: string | null
    backendType: ShareableCardType
    galleryType: GalleryType
    /** Original typed entity, for wiring actions. */
    source: Character | World | Item | Adventure
}

export interface GalleryConfig {
    eyebrow: string
    title: string
    icon: LucideIcon
    searchPlaceholder: string
    emptyTitle: string
    emptyDescription: string
    noMatchTitle: string
    noMatchDescription: string
    createLabel: string
    createPage: PageType
    fetchPage: (skip: number, limit: number, q?: string) => Promise<unknown>
    fetchItem?: (id: string) => Promise<unknown>
    toItems: (raw: unknown) => GalleryItem[]
    toItem?: (raw: unknown) => GalleryItem | null
}

const characterItems = (raw: unknown): GalleryItem[] =>
    transformCharacters(raw).map((character) => ({
        id: character.id,
        title: character.name,
        badge: character.race || undefined,
        description: character.description || undefined,
        tags: character.triggers ?? [],
        imageUrl: resolveMediaUrl(character.image_url),
        themeSongUrl: resolveMediaUrl(character.theme_song_url),
        visibility: character.visibility,
        originalCreatorName: actorName(character.original_creator),
        backendType: 'character',
        galleryType: 'character',
        source: character,
    }))

const personaItems = (raw: unknown): GalleryItem[] =>
    transformCharacters(raw).map((character) => ({
        id: character.id,
        title: character.name,
        badge: character.is_default_persona ? 'Default persona' : character.race || undefined,
        description: character.description || undefined,
        tags: character.triggers ?? [],
        imageUrl: resolveMediaUrl(character.image_url),
        themeSongUrl: resolveMediaUrl(character.theme_song_url),
        visibility: character.visibility,
        originalCreatorName: actorName(character.original_creator),
        backendType: 'character',
        galleryType: 'persona',
        source: character,
    }))

const worldItems = (raw: unknown): GalleryItem[] =>
    transformWorlds(raw).map((world) => ({
        id: world.id,
        title: world.name,
        badge: [world.place_type, world.type].filter(Boolean).join(' / ') || undefined,
        description: world.description || undefined,
        tags: world.triggers ?? [],
        imageUrl: resolveMediaUrl(world.image_url),
        themeSongUrl: resolveMediaUrl(world.theme_song_url),
        visibility: world.visibility,
        originalCreatorName: actorName(world.original_creator),
        backendType: 'world',
        galleryType: 'world',
        source: world,
    }))

const itemItems = (raw: unknown): GalleryItem[] =>
    transformItems(raw).map((item) => ({
        id: item.id,
        title: item.name,
        badge: [item.type, item.rarity].filter(Boolean).join(' / ') || undefined,
        description: item.description || undefined,
        tags: item.triggers ?? [],
        imageUrl: resolveMediaUrl(item.image_url),
        themeSongUrl: resolveMediaUrl(item.theme_song_url),
        visibility: item.visibility,
        originalCreatorName: actorName(item.original_creator),
        backendType: 'item',
        galleryType: 'item',
        source: item,
    }))

const adventureItems = (raw: unknown): GalleryItem[] =>
    transformTemplates(raw).map((template) => ({
        id: template.id,
        // Same title/tags derivation as the dashboard's scene cards.
        title: sceneTitle(template),
        // World name reads as a mono eyebrow above the title (matches the
        // showcase card). No description: the title is already derived from the
        // scenario when there's no persona, so a description line would just echo it.
        eyebrow: template.world?.name?.trim() || undefined,
        tags: sceneTags(template),
        imageUrl: resolveMediaUrl(template.image_url),
        themeSongUrl: resolveMediaUrl(template.theme_song_url),
        visibility: template.visibility,
        originalCreatorName: actorName(template.original_creator),
        backendType: 'adventure_template',
        galleryType: 'adventure',
        source: template,
    }))

const firstItem = (mapper: (raw: unknown) => GalleryItem[], raw: unknown): GalleryItem | null =>
    mapper(Array.isArray(raw) ? raw : [raw])[0] ?? null

function resourceActorName(actor?: CardActor | null): string | null {
    return actorName(actor)
}

function resourceCard(resource: SharedCardResource): Record<string, unknown> {
    const card = resource.card && typeof resource.card === 'object' ? { ...resource.card } as Record<string, unknown> : {}
    if (resource.visibility) card.visibility = resource.visibility
    if (resource.original_creator) card.original_creator = resource.original_creator
    return card
}

function resourceList(raw: unknown): SharedCardResource[] {
    if (Array.isArray(raw)) return raw as SharedCardResource[]
    if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) {
        return (raw as { items: SharedCardResource[] }).items
    }
    if (raw && typeof raw === 'object' && 'card_type' in raw && 'card' in raw) return [raw as SharedCardResource]
    return []
}

function annotateResourceItems(items: GalleryItem[], resource: SharedCardResource, galleryType: GalleryType): GalleryItem[] {
    return items.map((item) => ({
        ...item,
        resource,
        visibility: resource.visibility ?? item.visibility,
        ownerName: resourceActorName(resource.owner),
        originalCreatorName: resourceActorName(resource.original_creator) ?? item.originalCreatorName,
        backendType: resource.card_type,
        galleryType,
    }))
}

export function backendCardTypeFor(type: GalleryType): ShareableCardType {
    if (type === 'adventure') return 'adventure_template'
    if (type === 'persona') return 'character'
    return type
}

export function roleForGalleryType(type: GalleryType): 'character' | 'persona' | undefined {
    if (type === 'character') return 'character'
    if (type === 'persona') return 'persona'
    return undefined
}

export function galleryTypeForResource(resource: SharedCardResource): GalleryType {
    if (resource.card_type === 'adventure_template') return 'adventure'
    if (resource.card_type === 'character') {
        const card = resource.card as { role?: unknown } | undefined
        return card?.role === 'persona' ? 'persona' : 'character'
    }
    return resource.card_type
}

export function publicItems(raw: unknown, fallbackType?: GalleryType): GalleryItem[] {
    return resourceList(raw).flatMap((resource) => {
        const galleryType = galleryTypeForResource(resource)
        if (fallbackType && galleryType !== fallbackType) return []
        const card = resourceCard(resource)
        if (resource.card_type === 'character') {
            const mapper = galleryType === 'persona' ? personaItems : characterItems
            return annotateResourceItems(mapper([card]), resource, galleryType)
        }
        if (resource.card_type === 'world') return annotateResourceItems(worldItems([card]), resource, 'world')
        if (resource.card_type === 'item') return annotateResourceItems(itemItems([card]), resource, 'item')
        if (resource.card_type === 'adventure_template') return annotateResourceItems(adventureItems([card]), resource, 'adventure')
        return []
    })
}

export function publicConfigFor(type: GalleryType): GalleryConfig {
    const base = GALLERY_CONFIG[type]
    const cardType = backendCardTypeFor(type)
    const role = roleForGalleryType(type)
    return {
        ...base,
        eyebrow: 'Community gallery',
        searchPlaceholder: `Search public ${base.title.toLowerCase()} by name or trigger...`,
        emptyTitle: `No public ${base.title.toLowerCase()} yet`,
        emptyDescription: 'Published cards from the community will appear here.',
        noMatchTitle: `No public ${base.title.toLowerCase()} match`,
        noMatchDescription: 'Try a different name or trigger keyword.',
        fetchPage: (skip, limit, q) => apiService.listPublicCards(skip, limit, q, cardType, role),
        fetchItem: (id) => apiService.getPublicCard(cardType, id),
        toItems: (raw) => publicItems(raw, type),
        toItem: (raw) => publicItems(raw, type)[0] ?? null,
    }
}

export const GALLERY_CONFIG: Record<GalleryType, GalleryConfig> = {
    character: {
        eyebrow: 'Your library',
        title: 'Characters',
        icon: Users,
        searchPlaceholder: 'Search characters by name or trigger…',
        emptyTitle: 'No characters yet',
        emptyDescription: 'Create your first character and they will gather here.',
        noMatchTitle: 'No characters match',
        noMatchDescription: 'Try a different name or trigger keyword.',
        createLabel: 'New character',
        createPage: 'character',
        fetchPage: (skip, limit, q) => apiService.getCharacters(skip, limit, q, 'character'),
        fetchItem: (id) => apiService.getCharacter(id),
        toItems: characterItems,
        toItem: (raw) => firstItem(characterItems, raw),
    },
    persona: {
        eyebrow: 'Your library',
        title: 'Personas',
        icon: UserCircle,
        searchPlaceholder: 'Search personas by name or trigger...',
        emptyTitle: 'No personas yet',
        emptyDescription: 'Create a persona and set it as your default player card.',
        noMatchTitle: 'No personas match',
        noMatchDescription: 'Try a different name or trigger keyword.',
        createLabel: 'New persona',
        createPage: 'character',
        fetchPage: (skip, limit, q) => apiService.getCharacters(skip, limit, q, 'persona'),
        fetchItem: (id) => apiService.getCharacter(id),
        toItems: personaItems,
        toItem: (raw) => firstItem(personaItems, raw),
    },
    world: {
        eyebrow: 'Your library',
        title: 'Worlds',
        icon: Globe,
        searchPlaceholder: 'Search worlds by name or trigger…',
        emptyTitle: 'No worlds yet',
        emptyDescription: 'Shape your first world and it will appear here.',
        noMatchTitle: 'No worlds match',
        noMatchDescription: 'Try a different name or trigger keyword.',
        createLabel: 'New world',
        createPage: 'world',
        fetchPage: (skip, limit, q) => apiService.getWorlds(skip, limit, q),
        fetchItem: (id) => apiService.getWorld(id),
        toItems: worldItems,
        toItem: (raw) => firstItem(worldItems, raw),
    },
    item: {
        eyebrow: 'Your library',
        title: 'Items',
        icon: Gem,
        searchPlaceholder: 'Search items by name or trigger…',
        emptyTitle: 'No items yet',
        emptyDescription: 'Create your first relic, tool, key, or object and it will appear here.',
        noMatchTitle: 'No items match',
        noMatchDescription: 'Try a different name or trigger keyword.',
        createLabel: 'New item',
        createPage: 'item',
        fetchPage: (skip, limit, q) => apiService.getItems(skip, limit, q),
        fetchItem: (id) => apiService.getItem(id),
        toItems: itemItems,
        toItem: (raw) => firstItem(itemItems, raw),
    },
    adventure: {
        eyebrow: 'Your library',
        title: 'Adventures',
        icon: Swords,
        searchPlaceholder: 'Search adventures by name or trigger…',
        emptyTitle: 'No adventures yet',
        emptyDescription: 'Weave your first adventure and it will live here.',
        noMatchTitle: 'No adventures match',
        noMatchDescription: 'Try a different name or trigger keyword.',
        createLabel: 'New adventure',
        createPage: 'adventure',
        fetchPage: (skip, limit, q) => apiService.getAdventureTemplates(skip, limit, q),
        fetchItem: (id) => apiService.getAdventureTemplate(id),
        toItems: adventureItems,
        toItem: (raw) => firstItem(adventureItems, raw),
    },
}
