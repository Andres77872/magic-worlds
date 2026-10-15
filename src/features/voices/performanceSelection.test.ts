import { describe, expect, it } from 'vitest'
import { performanceSelection, selectedWords } from './performanceSelection'

describe('performance selection offsets', () => {
    it('translates UTF-16 selection to code points without changing canonical text', () => {
        const text = 'A 👩‍🚀 a\u0301 Nora.'
        const start = text.indexOf('Nora')
        const selection = performanceSelection(text, start, start + 4)!
        expect(selection.start).toBe(Array.from(text.slice(0, start)).length)
        expect(selectedWords(text, selection.start, selection.end)).toBe('Nora')
    })
    it.each(['a\u0301', '👩‍🚀', '🇲🇽'])('refuses a partial grapheme in %s', text => {
        expect(performanceSelection(text, 0, 1)).toBeNull()
        expect(performanceSelection(text, 0, text.length)).toEqual({ start: 0, end: Array.from(text).length })
    })
    it('accepts a cursor at a grapheme boundary and refuses invalid offsets', () => {
        expect(performanceSelection('Nora', 2, 2)).toEqual({ start: 2, end: 2 })
        expect(performanceSelection('Nora', -1, 2)).toBeNull()
        expect(performanceSelection('Nora', 0, 5)).toBeNull()
    })
})
