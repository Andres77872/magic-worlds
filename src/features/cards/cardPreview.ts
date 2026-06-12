import type { Adventure, CardMediaTargetType, Character, Item, World } from '@/shared'
import { readWorldPlaceType, worldPlaceTypeLabel } from '@/shared'
import { apiService, resolveMediaUrl } from '@/infrastructure/api'
import { transformCharacters, transformItems, transformTemplates, transformWorlds } from '@/utils/cardTransforms'

export type CardPreviewTargetType = CardMediaTargetType | 'persona'

export interface CardPreviewTarget {
    type: CardPreviewTargetType
    id: string
    fallbackName?: string
}

export interface CardPreview {
    id: string
    type: CardPreviewTargetType
    mediaType: CardMediaTargetType
    title: string
    badge?: string
    description?: string
    imageUrl?: string
    themeSongUrl?: string
    triggers: string[]
    categories?: Array<{ name: string; description?: string; attributes?: Array<Record<string, string>> }>
    createdAt?: string
    updatedAt?: string
}

export interface CardPreviewLibrary {
    characters: Character[]
    worlds: World[]
    items: Item[]
    templateAdventures: Adventure[]
}

export function mediaTargetType(type: CardPreviewTargetType): CardMediaTargetType {
    return type === 'persona' ? 'character' : type
}

export function cardPreviewTypeLabel(type: CardPreviewTargetType): string {
    if (type === 'adventure_template') return 'Adventure'
    if (type === 'item') return 'Item'
    if (type === 'persona') return 'Persona'
    return type === 'character' ? 'Character' : 'World'
}

function toCharacterPreview(card: Character, target: CardPreviewTarget): CardPreview {
    const type = target.type === 'persona' || card.role === 'persona' ? 'persona' : 'character'
    return {
        id: card.id || target.id,
        type,
        mediaType: 'character',
        title: card.name || target.fallbackName || 'Unnamed character',
        badge: type === 'persona' && card.is_default_persona ? 'Default persona' : card.race || cardPreviewTypeLabel(type),
        description: card.description,
        imageUrl: resolveMediaUrl(card.image_url),
        themeSongUrl: resolveMediaUrl(card.theme_song_url),
        triggers: card.triggers ?? [],
        categories: card.category,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
    }
}

function toWorldPreview(card: World, target: CardPreviewTarget): CardPreview {
    return {
        id: card.id || target.id,
        type: 'world',
        mediaType: 'world',
        title: card.name || target.fallbackName || 'Unnamed world',
        badge: [worldPlaceTypeLabel(readWorldPlaceType(card)), card.type].filter(Boolean).join(' / ') || 'World',
        description: card.description,
        imageUrl: resolveMediaUrl(card.image_url),
        themeSongUrl: resolveMediaUrl(card.theme_song_url),
        triggers: card.triggers ?? [],
        categories: card.category,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
    }
}

function toItemPreview(card: Item, target: CardPreviewTarget): CardPreview {
    return {
        id: card.id || target.id,
        type: 'item',
        mediaType: 'item',
        title: card.name || target.fallbackName || 'Unnamed item',
        badge: [card.type, card.rarity].filter(Boolean).join(' / ') || 'Item',
        description: card.description,
        imageUrl: resolveMediaUrl(card.image_url),
        themeSongUrl: resolveMediaUrl(card.theme_song_url),
        triggers: card.triggers ?? [],
        categories: card.category,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
    }
}

function toAdventurePreview(card: Adventure, target: CardPreviewTarget): CardPreview {
    const worldName = card.world?.name?.trim()
    return {
        id: card.id || target.id,
        type: 'adventure_template',
        mediaType: 'adventure_template',
        title: card.scenario || target.fallbackName || 'Adventure',
        badge: worldName || 'Adventure',
        description: card.scenario,
        imageUrl: resolveMediaUrl(card.image_url),
        themeSongUrl: resolveMediaUrl(card.theme_song_url),
        triggers: card.triggers ?? [],
        categories: card.category,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
    }
}

export function findLocalCardPreview(library: CardPreviewLibrary, target: CardPreviewTarget): CardPreview | null {
    if (target.type === 'character' || target.type === 'persona') {
        const card = library.characters.find((item) => item.id === target.id)
        return card ? toCharacterPreview(card, target) : null
    }
    if (target.type === 'world') {
        const card = library.worlds.find((item) => item.id === target.id)
        return card ? toWorldPreview(card, target) : null
    }
    if (target.type === 'item') {
        const card = library.items.find((item) => item.id === target.id)
        return card ? toItemPreview(card, target) : null
    }
    const card = library.templateAdventures.find((item) => item.id === target.id)
    return card ? toAdventurePreview(card, target) : null
}

export async function fetchCardPreview(target: CardPreviewTarget): Promise<CardPreview | null> {
    if (target.type === 'character' || target.type === 'persona') {
        const card = transformCharacters([await apiService.getCharacter(target.id)])[0]
        return card ? toCharacterPreview(card, target) : null
    }
    if (target.type === 'world') {
        const card = transformWorlds([await apiService.getWorld(target.id)])[0]
        return card ? toWorldPreview(card, target) : null
    }
    if (target.type === 'item') {
        const card = transformItems([await apiService.getItem(target.id)])[0]
        return card ? toItemPreview(card, target) : null
    }
    const card = transformTemplates([await apiService.getAdventureTemplate(target.id)])[0]
    return card ? toAdventurePreview(card, target) : null
}
