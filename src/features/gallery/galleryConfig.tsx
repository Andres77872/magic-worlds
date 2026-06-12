/**
 * Per-type gallery configuration — copy, fetcher, and raw-row → GalleryItem
 * mapping for the three card libraries. GalleryPage and useCardGallery are
 * generic; everything type-specific lives here.
 */

import { Gem, Globe, Swords, UserCircle, Users, type LucideIcon } from 'lucide-react'
import type { Adventure, Character, Item, PageType, World } from '@/shared'
import { apiService, resolveMediaUrl } from '@/infrastructure/api'
import { transformCharacters, transformItems, transformTemplates, transformWorlds } from '../../utils/cardTransforms'
import { sceneTags, sceneTitle } from '../landing/components/sceneModel'

export type GalleryType = 'character' | 'persona' | 'world' | 'item' | 'adventure'

export interface GalleryItem {
    id: string
    title: string
    /** Identity badge: race / world type / world name. */
    badge?: string
    tags: string[]
    imageUrl?: string
    themeSongUrl?: string
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
        tags: character.triggers ?? [],
        imageUrl: resolveMediaUrl(character.image_url),
        themeSongUrl: resolveMediaUrl(character.theme_song_url),
        source: character,
    }))

const personaItems = (raw: unknown): GalleryItem[] =>
    transformCharacters(raw).map((character) => ({
        id: character.id,
        title: character.name,
        badge: character.is_default_persona ? 'Default persona' : character.race || undefined,
        tags: character.triggers ?? [],
        imageUrl: resolveMediaUrl(character.image_url),
        themeSongUrl: resolveMediaUrl(character.theme_song_url),
        source: character,
    }))

const worldItems = (raw: unknown): GalleryItem[] =>
    transformWorlds(raw).map((world) => ({
        id: world.id,
        title: world.name,
        badge: [world.place_type, world.type].filter(Boolean).join(' / ') || undefined,
        tags: world.triggers ?? [],
        imageUrl: resolveMediaUrl(world.image_url),
        themeSongUrl: resolveMediaUrl(world.theme_song_url),
        source: world,
    }))

const itemItems = (raw: unknown): GalleryItem[] =>
    transformItems(raw).map((item) => ({
        id: item.id,
        title: item.name,
        badge: [item.type, item.rarity].filter(Boolean).join(' / ') || undefined,
        tags: item.triggers ?? [],
        imageUrl: resolveMediaUrl(item.image_url),
        themeSongUrl: resolveMediaUrl(item.theme_song_url),
        source: item,
    }))

const adventureItems = (raw: unknown): GalleryItem[] =>
    transformTemplates(raw).map((template) => ({
        id: template.id,
        // Same title/tags derivation as the dashboard's scene cards.
        title: sceneTitle(template),
        badge: template.world?.name?.trim() || undefined,
        tags: sceneTags(template),
        imageUrl: resolveMediaUrl(template.image_url),
        themeSongUrl: resolveMediaUrl(template.theme_song_url),
        source: template,
    }))

const firstItem = (mapper: (raw: unknown) => GalleryItem[], raw: unknown): GalleryItem | null =>
    mapper(Array.isArray(raw) ? raw : [raw])[0] ?? null

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
