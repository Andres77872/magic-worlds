import { describe, expect, it } from 'vitest'

import type { Story, StoryChapter } from '@/shared'
import { chaptersFor, formatSaveState, storySourceLabel, wordCount } from './novelUtils'

function chapter(id: string, order: number): StoryChapter {
    return { id, storyId: 'story-1', title: id, body: '', order, status: 'draft', activeCardRefs: [], mentionRefs: [] }
}

function story(overrides: Partial<Story> = {}): Story {
    return {
        id: 'story-1',
        title: 'Glass War',
        scenes: [],
        activeCardRefs: [],
        activeContext: {
            includeSelectedCards: true,
            includeMentionedCards: true,
            includeLorebooks: true,
            includeRecentScenes: 2,
            tokenBudget: 6000,
        },
        ...overrides,
    }
}

describe('chaptersFor', () => {
    it('returns chapters sorted by order, preferring chapters over scenes', () => {
        const result = chaptersFor(story({ chapters: [chapter('b', 2), chapter('a', 1)], scenes: [chapter('x', 0)] }))
        expect(result.map((item) => item.id)).toEqual(['a', 'b'])
    })

    it('falls back to scenes and handles null story', () => {
        expect(chaptersFor(story({ scenes: [chapter('x', 0)] })).map((item) => item.id)).toEqual(['x'])
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
        expect(storySourceLabel(story())).toBe('Blank')
        expect(storySourceLabel(story({ source: { kind: 'character', title: 'Aria' } }))).toBe('Aria')
        expect(storySourceLabel(story({ source: { kind: 'adventure_template' } }))).toBe('Adventure')
    })
})

describe('formatSaveState', () => {
    it('formats each state', () => {
        expect(formatSaveState('saving', null)).toBe('Saving')
        expect(formatSaveState('error', null)).toBe('Save failed')
        expect(formatSaveState('dirty', null)).toBe('Unsaved')
        expect(formatSaveState('saved', null)).toBe('Saved')
        expect(formatSaveState('saved', new Date('2026-06-11T10:30:00'))).toMatch(/^Saved /)
    })
})
