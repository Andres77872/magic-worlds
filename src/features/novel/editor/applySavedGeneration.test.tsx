import { act, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { StoryDocumentNode, StoryManuscriptDocument } from '@/shared'
import { documentText } from '@/shared/storyDocument'
import { manuscript, storyGeneration } from '@/test/fixtures/story'
import { novelAssistantReviewFixture } from '@/test/fixtures/novelAssistantReview'

vi.mock('@/app/hooks', () => ({
    useFloatingWindows: () => ({ openWindow: vi.fn(), closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
}))

import { NovelEditor } from './NovelEditor'
import { applySavedGeneration } from './applySavedGeneration'
import type { NovelEditorHandle, SavedGenerationReview } from './types'

const originalElementFromPoint = document.elementFromPoint
// jsdom has no layout; the placeholder's viewport tracking asks for a point.
beforeAll(() => { document.elementFromPoint = vi.fn(() => document.body) })
// The pinned BubbleMenu keeps its 250ms selection debounce after unregistering.
afterAll(async () => { document.elementFromPoint = originalElementFromPoint; await new Promise((resolve) => setTimeout(resolve, 300)) })

/** Accepted blocks get fresh random ids; everything else must match exactly. */
function withoutNewIds(node: StoryDocumentNode, kept: Set<string>): StoryDocumentNode {
    const attrs = node.attrs && typeof node.attrs.nodeId === 'string' && !kept.has(node.attrs.nodeId) ? { ...node.attrs, nodeId: 'new' } : node.attrs
    return { ...node, ...(attrs ? { attrs } : {}), ...(node.content ? { content: node.content.map((child) => withoutNewIds(child, kept)) } : {}) }
}
function ids(node: StoryDocumentNode): string[] {
    return [...(typeof node.attrs?.nodeId === 'string' ? [node.attrs.nodeId] : []), ...(node.content ?? []).flatMap(ids)]
}
const comparable = (document: StoryManuscriptDocument, base: StoryManuscriptDocument) => withoutNewIds(document.content, new Set(ids(base.content)))

async function acceptedInEditor(review: SavedGenerationReview) {
    const ref = createRef<NovelEditorHandle>(), onDocumentChange = vi.fn(), onAcceptGeneration = vi.fn(async () => {})
    const view = render(<NovelEditor ref={ref} initialBody="" codexEntries={[]} initialDocument={review.document} onDocumentChange={onDocumentChange}
        onRequestSaveFlush={vi.fn(async () => true)} onGenerate={vi.fn()} onAcceptGeneration={onAcceptGeneration}
        onDiscardGeneration={vi.fn(async () => {})} onCritiqueResult={vi.fn()} />)
    await screen.findByRole('textbox', { name: 'Scene manuscript' })
    act(() => expect(ref.current!.reviewGeneration(review)).toBe(true))
    await act(async () => { await ref.current!.resolveSuggestion('accept') })
    await waitFor(() => expect(onAcceptGeneration).toHaveBeenCalledWith(review.generation.id))
    const [document, anchorEdits] = onDocumentChange.mock.calls[onDocumentChange.mock.calls.length - 1]
    view.unmount()
    return { document: document as StoryManuscriptDocument, anchorEdits }
}

const base = manuscript('The gate held. The bell rang twice.', 'tide-1')
const reviews: [string, () => SavedGenerationReview][] = [
    ['the assistant fixture suggestion', () => {
        const fixture = novelAssistantReviewFixture()
        return { generation: fixture.detail.generation, operation: fixture.record.result.proposal!.operation, document: fixture.scene.document }
    }],
    ['a continuation', () => ({ operation: 'append_scene', document: base,
        generation: storyGeneration({ id: 'gen-append', command: 'continue', output: 'The harbor *woke*.\n\nBoats counted the tide.' }) })],
    ['a selection rewrite', () => ({ operation: 'replace_selection', document: base,
        generation: storyGeneration({ id: 'gen-selection', command: 'rewrite', inputRange: { startOffset: 15, endOffset: 35, text: 'The bell rang twice.' },
            output: 'The bell answered **once**.' }) })],
    ['a whole-scene rewrite', () => ({ operation: 'replace_scene', document: base,
        generation: storyGeneration({ id: 'gen-scene', command: 'rewrite', inputRange: { startOffset: 0, endOffset: 35, text: 'The gate held. The bell rang twice.' },
            output: 'The gate gave way.\n\n> The bell kept silent.' }) })],
]

describe('applySavedGeneration', () => {
    it.each(reviews)('writes %s exactly as reviewing it in the editor and accepting does', async (_name, make) => {
        const review = make()
        const editor = await acceptedInEditor(review)
        const applied = applySavedGeneration(review)
        expect(applied).not.toBeNull()
        expect(documentText(applied!.document)).toBe(documentText(editor.document))
        expect(documentText(applied!.document)).not.toBe(documentText(review.document))
        expect(comparable(applied!.document, review.document)).toEqual(comparable(editor.document, review.document))
        expect(applied!.anchorEdits).toEqual(editor.anchorEdits)
    })
    it('refuses a suggestion whose scene changed since it was made, or that is no longer a candidate', () => {
        const review = reviews[2][1]()
        expect(applySavedGeneration({ ...review, document: manuscript('The gate held. The bell rang.', 'tide-1') })).toBeNull()
        expect(applySavedGeneration({ ...review, generation: { ...review.generation, status: 'accepted' } })).toBeNull()
        expect(applySavedGeneration({ ...review, operation: 'append_scene' })).toBeNull()
    })
})
