/**
 * Entity → GalleryCard prop mapping for the dashboard's image-forward rails.
 * Mirrors the shapes in `galleryConfig.tsx` (which maps raw API rows) but works
 * on the typed in-memory entities the DataProvider already holds, so the
 * dashboard and the galleries present identical cards.
 */

import type { Character, Item, World } from '@/shared'
import { resolveMediaUrl } from '@/infrastructure/api'
import type { Scene } from './sceneModel'

export interface LibraryCardProps {
    title: string
    badge?: string
    /** Mono "where" label above the name (adventures/scenes only). */
    eyebrow?: string
    /** One-line narrative hook shown under the name. */
    description?: string
    tags: string[]
    imageUrl?: string
    themeSongUrl?: string
}

/**
 * The dashboard's portrait-card grid recipe — shared by BeginZone and
 * SearchResults so their hand-rolled grids can't drift apart (matches the
 * gallery pages' comfortable density columns).
 */
export const CARD_GRID_CLASS =
    'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:gap-6'

export function characterCardProps(character: Character): LibraryCardProps {
    return {
        title: character.name,
        badge: character.race || undefined,
        description: character.description || undefined,
        tags: character.triggers ?? [],
        imageUrl: resolveMediaUrl(character.image_url),
        themeSongUrl: resolveMediaUrl(character.theme_song_url),
    }
}

export function personaCardProps(character: Character): LibraryCardProps {
    return {
        ...characterCardProps(character),
        badge: character.is_default_persona ? 'Default persona' : character.race || undefined,
    }
}

export function worldCardProps(world: World): LibraryCardProps {
    return {
        title: world.name,
        badge: [world.place_type, world.type].filter(Boolean).join(' / ') || undefined,
        description: world.description || undefined,
        tags: world.triggers ?? [],
        imageUrl: resolveMediaUrl(world.image_url),
        themeSongUrl: resolveMediaUrl(world.theme_song_url),
    }
}

export function itemCardProps(item: Item): LibraryCardProps {
    return {
        title: item.name,
        badge: [item.type, item.rarity].filter(Boolean).join(' / ') || undefined,
        description: item.description || undefined,
        tags: item.triggers ?? [],
        imageUrl: resolveMediaUrl(item.image_url),
        themeSongUrl: resolveMediaUrl(item.theme_song_url),
    }
}

export function sceneCardProps(scene: Scene): LibraryCardProps {
    return {
        title: scene.title,
        // The "where" reads as a mono eyebrow above the name (matches the
        // showcase card); the genre/trigger tags carry the rest. No description:
        // the title is already derived from the scenario when there's no persona.
        eyebrow: scene.location,
        tags: scene.tags,
        imageUrl: resolveMediaUrl(scene.template.image_url),
        themeSongUrl: resolveMediaUrl(scene.template.theme_song_url),
    }
}
