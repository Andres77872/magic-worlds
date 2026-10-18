/**
 * Novel gallery configuration — copy, fetcher, and Story → gallery-item
 * mapping. Mirrors the shape of GALLERY_CONFIG entries so NovelGalleryPage
 * can stay a structural twin of GalleryPage.
 */

import type { Story,StoryLibraryFilters } from '@/shared'
import type { ApiService } from '@/infrastructure/api'
import type { TFunction } from 'i18next'
import { chaptersFor } from './utils/novelUtils'
import { novelOutline,sumSceneWords } from './utils/novelOutline'
import { storyCoverUrl } from '@/shared/storyNovelDetails'
import { savedStoryStatistics } from '@/shared/storyStatistics'

export interface NovelGalleryItem {
    id: string
    title: string
    /** Source badge: "Blank" or the source card's title. */
    badge?: string
    tags: string[]
    imageUrl?: string
    source: Story
}

function sourceLabelFor(story: Story, t: TFunction): string {
    const source = story.source
    if (source.kind === 'blank') return t('novelGallery.source.blank')
    if (source.title) return source.title
    if (source.kind === 'character') return t('novelGallery.source.character')
    if (source.kind === 'world') return t('novelGallery.source.world')
    if (source.kind === 'item') return t('novelGallery.source.item')
    if (source.kind === 'adventure_template') return t('novelGallery.source.adventure')
    if (source.kind === 'adventure_session') return t('novelGallery.source.adventureSession')
    return t('novelGallery.source.blank')
}

export function novelItems(raw: unknown, t: TFunction,includeArchived=false): NovelGalleryItem[] {
    const stories = Array.isArray(raw) ? (raw as Story[]) : []
    return stories.map((story) => {
        const chapters = chaptersFor(story)
        const saved=savedStoryStatistics(story,includeArchived)
        const outline=!saved&&!story.summary?novelOutline(story.chapters,story.parts):null
        const words=outline?(includeArchived?sumSceneWords(outline.chapters.flatMap((chapter)=>chapter.scenes).map((scene)=>scene.unit)):outline.words):0
        return {
            id: story.id,
            title: story.title,
            badge: sourceLabelFor(story, t),
            tags: story.summary&&story.chapterCount===null?[t('novelEditor.library.totalsUnavailable')]:[
                t('novelGallery.tags.chapter', { count: saved?.chapters??story.chapterCount??chapters.length }),
                ...(saved?[t('novelEditor.codex.context.scenes',{count:saved.scenes}),saved.wordCount===null?t('novelEditor.library.wordsUnavailable'):t('novelGallery.tags.words',{count:saved.wordCount.toLocaleString()})]:story.summary?[t('novelEditor.codex.context.scenes',{count:story.sceneCount??0}),t('novelEditor.library.wordsUnavailable')]:[words===null?t('novelEditor.library.wordsUnavailable'):t('novelGallery.tags.words', { count: words.toLocaleString() })]),
            ],
            imageUrl: storyCoverUrl(story.details.coverAssetId),
            source: story,
        }
    })
}

/**
 * `api` is the committed workspace's scoped client (Workspace R1): stories are
 * private content, and a new client identity on every workspace commit makes
 * the gallery restart from offset 0.
 */
export function getNovelGalleryConfig(t: TFunction, api: ApiService | null,trashed=false,filters:StoryLibraryFilters={}) {
    return {
        eyebrow: t('novelGallery.header.eyebrow'),
        title: t('novelGallery.header.title'),
        searchPlaceholder: t('novelGallery.search.placeholder'),
        emptyTitle: t('novelGallery.empty.noItemsTitle'),
        emptyDescription: t('novelGallery.empty.noItemsDescription'),
        noMatchTitle: t('novelGallery.empty.noMatchTitle'),
        noMatchDescription: t('novelGallery.empty.noMatchDescription'),
        createLabel: t('novelGallery.actions.new'),
        fetchPage: (skip: number, limit: number, q?: string): Promise<Story[]> =>
            api ? (Object.keys(filters).length?api.getStories(skip,limit,q,trashed,filters):trashed?api.getStories(skip,limit,q,true):api.getStories(skip, limit, q)) : Promise.resolve([]),
        toItems: (raw: unknown) => novelItems(raw, t,filters.includeArchivedSections),
    }
}
