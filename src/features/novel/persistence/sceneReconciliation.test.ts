import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import type { StoryDocumentNode, StoryManuscriptDocument } from '@/shared'
import { documentText, isStoryDocument } from '@/shared/storyDocument'
import { reviewSceneReconciliation, resolveSceneReconciliation } from './sceneReconciliation'

const paragraph = (id: string, text: string): StoryDocumentNode => ({ type: 'paragraph', attrs: { nodeId: id }, content: [{ type: 'text', text }] })
const doc = (...content: StoryDocumentNode[]): StoryManuscriptDocument => ({ schemaVersion: 1, content: { type: 'doc', content } })
const a = paragraph('a', 'The gate stood open.'), b = paragraph('b', 'A letter waited.'), c = paragraph('c', 'Mara read it.')
const order = (value: StoryManuscriptDocument) => value.content.content!.map((node) => node.attrs!.nodeId)

describe('reviewed scene reconciliation', () => {
    it('combines independent rich block edits while preserving their exact identity and marks', () => {
        const local = paragraph('a', 'The gate stood open at dawn.')
        local.content![0].marks = [{ type: 'highlight' }, { type: 'bold' }]
        const remote = paragraph('b', 'A letter waited by the window.')
        remote.content![0].marks = [{ type: 'link', attrs: { href: 'https://example.test/letter', title: 'Reference' } }]
        const review = reviewSceneReconciliation(doc(a, b), doc(local, b), doc(a, remote))!
        expect(review.conflicts).toEqual([])
        const result = resolveSceneReconciliation(review, {})!
        expect(result).toEqual(doc(local, remote))
        expect(isStoryDocument(result)).toBe(true)
        if (process.env.NOVEL_RECONCILIATION_WIRE_OUT) {
            writeFileSync(process.env.NOVEL_RECONCILIATION_WIRE_OUT, JSON.stringify({ base: doc(a, b), device: doc(local, b), account: doc(a, remote), merged: result }), { mode: 0o600 })
        }
        result.content.content![0].content![0].text = 'Later editing'
        expect(review.device.content.content![0].content![0].text).toBe('The gate stood open at dawn.')
    })

    it('requires an explicit choice for simultaneous changes within one canonical block', () => {
        const local = paragraph('a', 'The gate was barred.'), remote = paragraph('a', 'The gate was broken.')
        const review = reviewSceneReconciliation(doc(a, b), doc(local, b), doc(remote, b))!
        expect(review.conflicts.map((item) => item.id)).toEqual(['a'])
        expect(resolveSceneReconciliation(review, {})).toBeNull()
        expect(resolveSceneReconciliation(review, { a: 'device' })).toEqual(doc(local, b))
        expect(resolveSceneReconciliation(review, { a: 'account' })).toEqual(doc(remote, b))
    })

    it('merges an unchanged deletion with another block edit and an independent insertion', () => {
        const remote = paragraph('b', 'The sealed letter waited.')
        const review = reviewSceneReconciliation(doc(a, b), doc(b, c), doc(a, remote))!
        const result = resolveSceneReconciliation(review, {})!
        expect(order(result)).toEqual(['b', 'c'])
        expect(documentText(result)).toContain('The sealed letter waited.')
    })

    it('makes deletion versus editing visible and keeps the other blocks', () => {
        const remote = paragraph('a', 'Someone had unbarred the gate.')
        const review = reviewSceneReconciliation(doc(a, b), doc(b), doc(remote, b))!
        expect(review.conflicts[0]).toMatchObject({ id: 'a', device: null, account: remote })
        expect(resolveSceneReconciliation(review, { a: 'device' })).toEqual(doc(b))
        expect(resolveSceneReconciliation(review, { a: 'account' })).toEqual(doc(remote, b))
    })

    it('never guesses an addition or deletion when the acknowledged base is unavailable', () => {
        const review = reviewSceneReconciliation(null, doc(a, c), doc(a, b))!
        expect(review.baseAvailable).toBe(false)
        expect(new Set(review.conflicts.map((item) => item.id))).toEqual(new Set(['b', 'c']))
        expect(resolveSceneReconciliation(review, {})).toBeNull()
        expect(resolveSceneReconciliation(review, { b: 'device', c: 'device' })).toEqual(doc(a, c))
    })

    it('preserves a single-side reorder alongside the other side’s independent prose', () => {
        const edited = paragraph('b', 'Mara unfolded the letter.')
        const review = reviewSceneReconciliation(doc(a, b, c), doc(c, a, b), doc(a, edited, c))!
        expect(review.orderConflict).toBe(false)
        expect(review.preferredOrder).toBe('device')
        expect(resolveSceneReconciliation(review, {})).toEqual(doc(c, a, edited))
    })

    it('requires an order choice when both sides reorder the common blocks differently', () => {
        const review = reviewSceneReconciliation(doc(a, b, c), doc(c, a, b), doc(b, a, c))!
        expect(review.orderConflict).toBe(true)
        expect(resolveSceneReconciliation(review, {})).toBeNull()
        expect(order(resolveSceneReconciliation(review, {}, 'device')!)).toEqual(['c', 'a', 'b'])
        expect(order(resolveSceneReconciliation(review, {}, 'account')!)).toEqual(['b', 'a', 'c'])
    })

    it('keeps independent insertions from both sides near their stable neighbors', () => {
        const local = paragraph('device-insert', 'A watchman approached.')
        const remote = paragraph('account-insert', 'Rain darkened the seal.')
        const review = reviewSceneReconciliation(doc(a, b), doc(a, local, b), doc(a, remote, b))!
        expect(resolveSceneReconciliation(review, {})).toEqual(doc(a, local, remote, b))
    })

    it('refuses a mixed result with duplicated nested identities instead of silently renaming them', () => {
        const quote = (id: string, ...content: StoryDocumentNode[]): StoryDocumentNode => ({ type: 'blockquote', attrs: { nodeId: id }, content })
        const base = doc(quote('quote-a', a), quote('quote-b', b))
        const local = doc(quote('quote-a', a, b))
        const remote = doc(quote('quote-a', a), quote('quote-b', paragraph('b', 'The letter was gone.')))
        const review = reviewSceneReconciliation(base, local, remote)!
        expect(resolveSceneReconciliation(review, { 'quote-b': 'account' })).toBeNull()
        expect(resolveSceneReconciliation(review, { 'quote-b': 'device' })).toEqual(local)
    })

    it('treats concurrent formatting or reference changes as meaningful conflicts', () => {
        const local = structuredClone(a), remote = structuredClone(a)
        local.content![0].marks = [{ type: 'bold' }]
        remote.content![0].marks = [{ type: 'italic' }]
        const review = reviewSceneReconciliation(doc(a), doc(local), doc(remote))!
        expect(review.conflicts).toHaveLength(1)
        expect(resolveSceneReconciliation(review, { a: 'device' })).toEqual(doc(local))
    })

    it('rejects unsupported input and cannot resolve an empty manuscript', () => {
        expect(reviewSceneReconciliation(doc(a), doc(a, a), doc(a))).toBeNull()
        const review = reviewSceneReconciliation(doc(a, b), doc(a), doc(b))!
        expect(resolveSceneReconciliation(review, {})).toBeNull()
    })
})
