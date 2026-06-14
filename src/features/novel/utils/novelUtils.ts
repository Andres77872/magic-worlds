/**
 * Pure helpers for the novel feature: chapter ordering, word counts, save
 * state copy, and story metadata labels. Ported survivors of the old
 * storyEditorUtils module.
 */

import type { TFunction } from 'i18next'
import type { Story, StoryChapter } from '@/shared'

export type NovelSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export function chaptersFor(story: Story | null): StoryChapter[] {
    const chapters = story ? (story.chapters ?? story.scenes ?? []) : []
    return [...chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function wordCount(text: string): number {
    return text.split(/\s+/).filter(Boolean).length
}

export function kindLabel(kind: string, t: TFunction): string {
    if (kind === 'adventure_template') return t('novelEditor.kind.adventure')
    if (kind === 'snapshot_card') return t('novelEditor.kind.snapshot')
    if (kind === 'lorebook_entry') return t('novelEditor.kind.loreEntry')
    return kind.charAt(0).toUpperCase() + kind.slice(1)
}

export function storySourceLabel(story: Story, t: TFunction): string {
    const source = story.source
    if (!source || source.kind === 'blank') return t('novelEditor.source.blank')
    return source.title || kindLabel(source.kind, t)
}

export function formatSaveState(state: NovelSaveState, lastSavedAt: Date | null, t: TFunction): string {
    if (state === 'saving') return t('novelEditor.save.saving')
    if (state === 'error') return t('novelEditor.save.failed')
    if (state === 'dirty') return t('novelEditor.save.unsaved')
    if (lastSavedAt) return t('novelEditor.save.savedAt', { time: lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
    return t('novelEditor.save.saved')
}

export function markdownFor(story: Story): string {
    const chapters = chaptersFor(story)
    return [`# ${story.title}`, story.description ? `\n${story.description}` : '', ...chapters.map((chapter) => `\n## ${chapter.title}\n\n${chapter.body}`)]
        .filter(Boolean)
        .join('\n')
        .trim()
}
