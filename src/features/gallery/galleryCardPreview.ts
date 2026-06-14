/**
 * Map an already-loaded gallery item to the shared CardPreview shape so the
 * community/public/shared surfaces can open the full preview modal without an
 * extra fetch (public items already carry resolved media URLs + the resource).
 */
import type { CardPreview, CardPreviewTargetType } from '@/features/cards/cardPreview'
import type { CardMediaTargetType } from '@/shared'
import type { GalleryItem, GalleryType } from './galleryConfig'

const PREVIEW_TYPE: Record<GalleryType, CardPreviewTargetType> = {
    character: 'character',
    persona: 'persona',
    world: 'world',
    item: 'item',
    adventure: 'adventure_template',
}

export function galleryItemToCardPreview(item: GalleryItem): CardPreview {
    const source = (item.source ?? {}) as Record<string, unknown>
    const description =
        (typeof source.description === 'string' && source.description) ||
        (typeof source.scenario === 'string' && source.scenario) ||
        undefined
    return {
        id: item.id,
        type: PREVIEW_TYPE[item.galleryType],
        mediaType: item.backendType as CardMediaTargetType,
        title: item.title,
        badge: item.badge ?? item.originalCreatorName ?? undefined,
        description,
        imageUrl: item.imageUrl,
        themeSongUrl: item.themeSongUrl,
        triggers: item.tags ?? [],
        categories: Array.isArray(source.category)
            ? (source.category as CardPreview['categories'])
            : undefined,
        createdAt: typeof source.createdAt === 'string' ? source.createdAt : undefined,
        updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
    }
}
