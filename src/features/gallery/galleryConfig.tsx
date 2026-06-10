/**
 * Per-type gallery configuration — copy, fetcher, and raw-row → GalleryItem
 * mapping for the three card libraries. GalleryPage and useCardGallery are
 * generic; everything type-specific lives here.
 */

import { Globe, Swords, Users, type LucideIcon } from 'lucide-react'
import type { Adventure, Character, PageType, World } from '@/shared'
import { apiService, resolveMediaUrl } from '@/infrastructure/api'
import { transformCharacters, transformTemplates, transformWorlds } from '../../utils/cardTransforms'
import { sceneTags, sceneTitle } from '../landing/components/sceneModel'

export type GalleryType = 'character' | 'world' | 'adventure'

export interface GalleryItem {
    id: string
    title: string
    /** Identity badge: race / world type / world name. */
    badge?: string
    tags: string[]
    imageUrl?: string
    themeSongUrl?: string
    /** Original typed entity, for wiring actions. */
    source: Character | World | Adventure
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
    toItems: (raw: unknown) => GalleryItem[]
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
        fetchPage: (skip, limit, q) => apiService.getCharacters(skip, limit, q),
        toItems: (raw) =>
            transformCharacters(raw).map((character) => ({
                id: character.id,
                title: character.name,
                badge: character.race || undefined,
                tags: character.triggers ?? [],
                imageUrl: resolveMediaUrl(character.image_url),
                themeSongUrl: resolveMediaUrl(character.theme_song_url),
                source: character,
            })),
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
        toItems: (raw) =>
            transformWorlds(raw).map((world) => ({
                id: world.id,
                title: world.name,
                badge: world.type || undefined,
                tags: world.triggers ?? [],
                imageUrl: resolveMediaUrl(world.image_url),
                themeSongUrl: resolveMediaUrl(world.theme_song_url),
                source: world,
            })),
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
        toItems: (raw) =>
            transformTemplates(raw).map((template) => ({
                id: template.id,
                // Same title/tags derivation as the dashboard's scene cards.
                title: sceneTitle(template),
                badge: template.world?.name?.trim() || undefined,
                tags: sceneTags(template),
                imageUrl: resolveMediaUrl(template.image_url),
                themeSongUrl: resolveMediaUrl(template.theme_song_url),
                source: template,
            })),
    },
}
