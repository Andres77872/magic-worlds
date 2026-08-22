/**
 * Pure helpers for the novel feature: chapter ordering, word counts and save
 * state copy. Ported survivors of the old storyEditorUtils module.
 */

import type { TFunction } from 'i18next'
import type { Story, StoryChapter } from '@/shared'

export type NovelSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export function chaptersFor(story: Story | null): StoryChapter[] {
    const chapters = story?.chapters ?? []
    return [...chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function wordCount(text: string): number {
    // The body is markdown: bare syntax tokens ("##", "---", "*") are not
    // words, so only tokens carrying at least one letter or digit count.
    return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length
}

export function formatSaveState(state: NovelSaveState, lastSavedAt: Date | null, t: TFunction): string {
    if (state === 'saving') return t('novelEditor.save.saving')
    if (state === 'error') return t('novelEditor.save.failed')
    if (state === 'dirty') return t('novelEditor.save.unsaved')
    if (lastSavedAt) return t('novelEditor.save.savedAt', { time: lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
    return t('novelEditor.save.saved')
}

