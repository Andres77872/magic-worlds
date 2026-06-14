/**
 * Novel gallery configuration — copy, fetcher, and Story → gallery-item
 * mapping. Mirrors the shape of GALLERY_CONFIG entries so NovelGalleryPage
 * can stay a structural twin of GalleryPage.
 */

import type { Story } from '@/shared'
import { apiService, resolveMediaUrl } from '@/infrastructure/api'
import type { TFunction } from 'i18next'
import { chaptersFor, wordCount } from './utils/novelUtils'

export interface NovelGalleryItem {
    id: string
    title: string
    /** Source badge: "Blank" or the source card's title. */
    badge?: string
    tags: string[]
    imageUrl?: string
    source: Story
}

/** Cover art: the first codex snapshot that carries an image. */
function coverFromRefs(story: Story): string | undefined {
    for (const ref of story.activeCardRefs ?? []) {
        const imageUrl = ref.snapshot?.image_url
        if (typeof imageUrl === 'string' && imageUrl) return resolveMediaUrl(imageUrl)
    }
    return undefined
}

function sourceLabelFor(story: Story, t: TFunction): string {
    const source = story.source
    if (!source || source.kind === 'blank') return t('novelGallery.source.blank')
    if (source.title) return source.title
    if (source.kind === 'character') return t('novelGallery.source.character')
    if (source.kind === 'world') return t('novelGallery.source.world')
    if (source.kind === 'item') return t('novelGallery.source.item')
    if (source.kind === 'adventure_template') return t('novelGallery.source.adventure')
    if (source.kind === 'adventure_session') return t('novelGallery.source.adventureSession')
    if (source.kind === 'character_chat') return t('novelGallery.source.characterChat')
    if (source.kind === 'lorebook') return t('novelGallery.source.lorebook')
    return t('novelGallery.source.blank')
}

export function novelItems(raw: unknown, t: TFunction): NovelGalleryItem[] {
    const stories = Array.isArray(raw) ? (raw as Story[]) : []
    return stories.map((story) => {
        const chapters = chaptersFor(story)
        const words = chapters.reduce((sum, chapter) => sum + wordCount(chapter.body ?? ''), 0)
        return {
            id: story.id,
            title: story.title,
            badge: sourceLabelFor(story, t),
            tags: [
                t('novelGallery.tags.chapter', { count: chapters.length }),
                t('novelGallery.tags.words', { count: words.toLocaleString() }),
            ],
            imageUrl: coverFromRefs(story),
            source: story,
        }
    })
}

export function getNovelGalleryConfig(t: TFunction) {
    return {
        eyebrow: t('novelGallery.header.eyebrow'),
        title: t('novelGallery.header.title'),
        searchPlaceholder: t('novelGallery.search.placeholder'),
        emptyTitle: t('novelGallery.empty.noItemsTitle'),
        emptyDescription: t('novelGallery.empty.noItemsDescription'),
        noMatchTitle: t('novelGallery.empty.noMatchTitle'),
        noMatchDescription: t('novelGallery.empty.noMatchDescription'),
        createLabel: t('novelGallery.actions.new'),
        fetchPage: (skip: number, limit: number, q?: string) => apiService.getStories(skip, limit, q),
        toItems: (raw: unknown) => novelItems(raw, t),
    }
}
