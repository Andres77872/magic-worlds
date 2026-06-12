/**
 * Novel gallery configuration — copy, fetcher, and Story → gallery-item
 * mapping. Mirrors the shape of GALLERY_CONFIG entries so NovelGalleryPage
 * can stay a structural twin of GalleryPage.
 */

import type { Story } from '@/shared'
import { apiService, resolveMediaUrl } from '@/infrastructure/api'
import { chaptersFor, storySourceLabel, wordCount } from './utils/novelUtils'

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

export function novelItems(raw: unknown): NovelGalleryItem[] {
    const stories = Array.isArray(raw) ? (raw as Story[]) : []
    return stories.map((story) => {
        const chapters = chaptersFor(story)
        const words = chapters.reduce((sum, chapter) => sum + wordCount(chapter.body ?? ''), 0)
        return {
            id: story.id,
            title: story.title,
            badge: storySourceLabel(story),
            tags: [`${chapters.length} chapter${chapters.length === 1 ? '' : 's'}`, `${words.toLocaleString()} words`],
            imageUrl: coverFromRefs(story),
            source: story,
        }
    })
}

export const NOVEL_GALLERY_CONFIG = {
    eyebrow: 'Your library',
    title: 'Novels',
    searchPlaceholder: 'Search novels by title or text…',
    emptyTitle: 'No novels yet',
    emptyDescription: 'Begin your first novel and weave your cards into its chapters.',
    noMatchTitle: 'No novels match',
    noMatchDescription: 'Try a different title or a phrase from the text.',
    createLabel: 'New novel',
    fetchPage: (skip: number, limit: number, q?: string) => apiService.getStories(skip, limit, q),
    toItems: novelItems,
}
