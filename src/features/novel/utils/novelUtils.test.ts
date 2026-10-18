import { novel, storyChapter } from '@/test/fixtures/story'
import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'

import type { Story, StoryChapter } from '@/shared'
import { chaptersFor, formatSaveState, wordCount,plainTextWordCount } from './novelUtils'

// Stub t that maps the keys these helpers use back to their English copy, so
// the pure formatting/labeling contract stays asserted without i18n wiring.
const COPY: Record<string, string> = {
    'novelEditor.save.saving': 'Saving',
    'novelEditor.save.failed': 'Save failed',
    'novelEditor.save.unsaved': 'Unsaved',
    'novelEditor.save.saved': 'Saved',
}
const t = ((key: string, options?: { time?: string }) =>
    key === 'novelEditor.save.savedAt' ? `Saved ${options?.time ?? ''}` : (COPY[key] ?? key)) as unknown as TFunction

function chapter(id: string, order: number): StoryChapter { return storyChapter({id,order}) }
function story(overrides: Partial<Story> = {}): Story { return novel({chapters:[],...overrides}) }

describe('chaptersFor', () => {
    it('returns stored chapters sorted by order', () => {
        const result = chaptersFor(story({ chapters: [chapter('b', 2), chapter('a', 1)] }))
        expect(result.map((item) => item.id)).toEqual(['a', 'b'])
    })

    it('handles an empty or null story', () => {
        expect(chaptersFor(story()).map((item) => item.id)).toEqual([])
        expect(chaptersFor(null)).toEqual([])
    })
})

describe('wordCount', () => {
    it('counts canonical literal links/comments without treating author text as Markdown',()=>{
        expect(plainTextWordCount('🙂 Café [door](route) <!-- note -->')).toBe(4)
        expect(plainTextWordCount("Don't stop. L’été arrive. 1,234.50")).toBe(5)
        expect(plainTextWordCount('猫在花园里睡觉。')).toBe(5)
    })
    it('excludes beat instructions and link destinations from manuscript goals', () => {
        expect(wordCount('The gate.\n\n<!-- ai-beat: Write the next long dramatic scene -->\n\n[A door](https://example.com/very/long/path).')).toBe(4)
    })

    it('segments words in prose without spaces', () => {
        expect(wordCount('猫在花园里睡觉。')).toBeGreaterThan(1)
        expect(wordCount('🙂 — ***')).toBe(0)
    })
    it('counts words across whitespace', () => {
        expect(wordCount('  the moon\ncracks  over the wall ')).toBe(6)
        expect(wordCount('')).toBe(0)
    })

    it('ignores bare markdown syntax tokens', () => {
        expect(wordCount('## The Fall\n\n---\n\n*Ash* fell — softly.')).toBe(5)
        expect(wordCount('---')).toBe(0)
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
