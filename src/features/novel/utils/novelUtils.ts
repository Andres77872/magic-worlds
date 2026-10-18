/**
 * Pure helpers for the novel feature: chapter ordering, word counts and save
 * state copy. Ported survivors of the old storyEditorUtils module.
 */

import type { TFunction } from 'i18next'
import type { Story,StoryOutline,StoryChapter,StoryChapterOutline } from '@/shared'

export type NovelSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict' | 'offline' | 'checking'

export function chaptersFor(story:Story|null):StoryChapter[]
export function chaptersFor(story:StoryOutline|null):StoryChapterOutline[]
export function chaptersFor(story:StoryOutline|null):StoryChapterOutline[] {
    const chapters = story?.chapters ?? []
    const parts=[...(story?.parts??[])].sort((a,b)=>a.order-b.order)
    const partOrder=new Map(parts.map((part,index)=>[part.id,index+1]))
    const hidden=new Set(parts.filter((part)=>part.trashedAt).map((part)=>part.id))
    return chapters.filter((chapter)=>!chapter.trashedAt&&!hidden.has(chapter.partId??'')).sort((a,b)=>(partOrder.get(a.partId??'')??0)-(partOrder.get(b.partId??'')??0)||a.order-b.order)
}

export function wordCount(text: string): number {
    const prose = text.replace(/<!--[\s\S]*?-->/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    return plainTextWordCount(prose)
}

/** Count literal canonical/editor text without interpreting it as Markdown. */
export function plainTextWordCount(prose:string):number {
    const Segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: string }) => {
        segment: (value: string) => Iterable<{ isWordLike?: boolean }>
    } }).Segmenter
    if (Segmenter) return [...new Segmenter('en', { granularity: 'word' }).segment(prose)].filter((s) => s.isWordLike).length
    return prose.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length
}

export function formatSaveState(state: NovelSaveState, lastSavedAt: Date | null, t: TFunction): string {
    if (state === 'offline') return t('novelEditor.offline.pending')
    if (state === 'checking') return t('novelEditor.offline.checking')
    if (state === 'conflict') return t('novelEditor.save.conflict')
    if (state === 'saving') return t('novelEditor.save.saving')
    if (state === 'error') return t('novelEditor.save.failed')
    if (state === 'dirty') return t('novelEditor.save.unsaved')
    if (lastSavedAt) return t('novelEditor.save.savedAt', { time: lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
    return t('novelEditor.save.saved')
}

