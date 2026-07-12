import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'

import type { Story, StoryChapter } from '@/shared'
import { chaptersFor, formatSaveState, storySourceLabel, wordCount } from './novelUtils'

// Stub t that maps the keys these helpers use back to their English copy, so
// the pure formatting/labeling contract stays asserted without i18n wiring.
const COPY: Record<string, string> = {
    'novelEditor.kind.adventure': 'Adventure',
    'novelEditor.source.blank': 'Blank',
    'novelEditor.save.saving': 'Saving',
    'novelEditor.save.failed': 'Save failed',
    'novelEditor.save.unsaved': 'Unsaved',
    'novelEditor.save.saved': 'Saved',
}
const t = ((key: string, options?: { time?: string }) =>
    key === 'novelEditor.save.savedAt' ? `Saved ${options?.time ?? ''}` : (COPY[key] ?? key)) as unknown as TFunction

function chapter(id: string, order: number): StoryChapter {
    return {
        id,
        storyId: 'story-1',
        title: id,
        body: '',
        order,
        status: 'draft',
        povCardId: null,
        locationCardId: null,
        activeCardRefs: [],
        generationHistory: [],
    }
}

function story(overrides: Partial<Story> = {}): Story {
    return {
        id: 'story-1',
        title: 'Glass War',
        description: null,
        source: { kind: 'blank', id: null, title: null },
        chapters: [],
        activeCardRefs: [],
        activeContext: {
            includeSelectedCards: true,
            includeLorebooks: true,
            includeRecentChapters: 2,
            tokenBudget: 6000,
            styleSource: 'current_chapter',
            customStyleInstruction: null,
        },
        ...overrides,
    }
}

describe('chaptersFor', () => {
    it('returns canonical chapters sorted by order', () => {
        const result = chaptersFor(story({ chapters: [chapter('b', 2), chapter('a', 1)] }))
        expect(result.map((item) => item.id)).toEqual(['a', 'b'])
    })

    it('handles an empty or null story', () => {
        expect(chaptersFor(story()).map((item) => item.id)).toEqual([])
        expect(chaptersFor(null)).toEqual([])
    })
})

describe('wordCount', () => {
    it('counts words across whitespace', () => {
        expect(wordCount('  the moon\ncracks  over the wall ')).toBe(6)
        expect(wordCount('')).toBe(0)
    })
})

describe('storySourceLabel', () => {
    it('labels blank, titled, and kind-only sources', () => {
        expect(storySourceLabel(story(), t)).toBe('Blank')
        expect(storySourceLabel(story({ source: { kind: 'character', id: 'char-1', title: 'Aria' } }), t)).toBe('Aria')
        expect(storySourceLabel(story({ source: { kind: 'adventure_template', id: 'adv-1', title: null } }), t)).toBe('Adventure')
    })
})

describe('formatSaveState', () => {
    it('formats each state', () => {
        expect(formatSaveState('saving', null, t)).toBe('Saving')
        expect(formatSaveState('error', null, t)).toBe('Save failed')
        expect(formatSaveState('dirty', null, t)).toBe('Unsaved')
        expect(formatSaveState('saved', null, t)).toBe('Saved')
        expect(formatSaveState('saved', new Date('2026-06-11T10:30:00'), t)).toMatch(/^Saved /)
    })
})
