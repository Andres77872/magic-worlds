import { describe, expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import { buildRevealPlan, withSuggestionMark } from './revealPlan'

function paragraph(...content: JSONContent[]): JSONContent {
    return { type: 'paragraph', content }
}

function text(value: string, marks?: JSONContent['marks']): JSONContent {
    return { type: 'text', text: value, marks }
}

describe('buildRevealPlan', () => {
    it('opens a block per paragraph and chunks text into word steps', () => {
        const doc: JSONContent = { type: 'doc', content: [paragraph(text('one two three')), paragraph(text('four'))] }
        const steps = buildRevealPlan(doc, { maxTextSteps: 1000 })

        expect(steps[0]).toEqual({ kind: 'newBlock', nodeType: 'paragraph', attrs: undefined })
        const texts = steps.filter((step) => step.kind === 'text')
        expect(texts.map((step) => (step.kind === 'text' ? step.text : ''))).toEqual(['one ', 'two ', 'three', 'four'])
        expect(steps.filter((step) => step.kind === 'newBlock')).toHaveLength(2)
    })

    it('keeps source marks on text steps', () => {
        const doc: JSONContent = { type: 'doc', content: [paragraph(text('bold words', [{ type: 'bold' }]))] }
        const steps = buildRevealPlan(doc, { maxTextSteps: 1000 })
        const textStep = steps.find((step) => step.kind === 'text')
        expect(textStep).toMatchObject({ marks: [{ type: 'bold' }] })
    })

    it('skips the first block open when revealing inline (selection replacement)', () => {
        const doc: JSONContent = { type: 'doc', content: [paragraph(text('alpha')), paragraph(text('beta'))] }
        const steps = buildRevealPlan(doc, { inlineFirstBlock: true, maxTextSteps: 1000 })
        expect(steps[0].kind).toBe('text')
        expect(steps.filter((step) => step.kind === 'newBlock')).toHaveLength(1)
    })

    it('emits headings as typewriter blocks and complex blocks whole, marked', () => {
        const doc: JSONContent = {
            type: 'doc',
            content: [
                { type: 'heading', attrs: { level: 2 }, content: [text('The Fall')] },
                { type: 'blockquote', content: [paragraph(text('ash'))] },
            ],
        }
        const steps = buildRevealPlan(doc, { maxTextSteps: 1000 })
        expect(steps[0]).toEqual({ kind: 'newBlock', nodeType: 'heading', attrs: { level: 2 } })
        const block = steps.find((step) => step.kind === 'block')
        expect(block).toBeDefined()
        if (block?.kind === 'block') {
            expect(block.node.content?.[0].content?.[0].marks).toEqual([{ type: 'aiSuggestion' }])
        }
    })

    it('grows the chunk size for long outputs to bound the step count', () => {
        const longText = Array.from({ length: 1000 }, (_, i) => `w${i}`).join(' ')
        const doc: JSONContent = { type: 'doc', content: [paragraph(text(longText))] }
        const steps = buildRevealPlan(doc, { maxTextSteps: 200 })
        expect(steps.filter((step) => step.kind === 'text').length).toBeLessThanOrEqual(201)
    })

    it('emits inline atoms as marked atom steps', () => {
        const doc: JSONContent = {
            type: 'doc',
            content: [paragraph(text('Hello '), { type: 'codexMention', attrs: { id: 'r1', label: 'Aria' } })],
        }
        const steps = buildRevealPlan(doc, { maxTextSteps: 1000 })
        const atom = steps.find((step) => step.kind === 'atom')
        expect(atom).toBeDefined()
        if (atom?.kind === 'atom') {
            expect(atom.node.marks).toEqual([{ type: 'aiSuggestion' }])
        }
    })
})

describe('withSuggestionMark', () => {
    it('adds the mark to every text node exactly once', () => {
        const node = paragraph(text('a', [{ type: 'bold' }]), text('b', [{ type: 'aiSuggestion' }]))
        const marked = withSuggestionMark(node)
        expect(marked.content?.[0].marks).toEqual([{ type: 'bold' }, { type: 'aiSuggestion' }])
        expect(marked.content?.[1].marks).toEqual([{ type: 'aiSuggestion' }])
    })
})
