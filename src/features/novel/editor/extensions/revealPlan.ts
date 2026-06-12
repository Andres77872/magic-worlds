/**
 * buildRevealPlan — flattens a parsed markdown document (Tiptap JSON) into
 * the ordered steps the typewriter dispatches: block opens for paragraphs and
 * headings, word-chunked text runs (with their source marks), inline atoms
 * (e.g. codex mentions the model produced), and whole complex blocks
 * (blockquotes, lists, …) that don't typewriter well.
 *
 * Chunk size scales with output length so a full reveal stays around a few
 * seconds regardless of how much the model wrote.
 */

import type { JSONContent } from '@tiptap/core'

export type RevealStep =
    | { kind: 'newBlock'; nodeType: 'paragraph' | 'heading'; attrs?: Record<string, unknown> }
    | { kind: 'text'; text: string; marks?: NonNullable<JSONContent['marks']> }
    | { kind: 'atom'; node: JSONContent }
    | { kind: 'block'; node: JSONContent }

export interface RevealPlanOptions {
    /**
     * Flow the first paragraph inline at the cursor instead of opening a new
     * block — used when the suggestion replaces a selection mid-paragraph.
     */
    inlineFirstBlock?: boolean
    /** Soft cap on text steps; chunk size grows to fit. */
    maxTextSteps?: number
}

const DEFAULT_MAX_TEXT_STEPS = 200
export const AI_SUGGESTION_MARK_NAME = 'aiSuggestion'

/** Split into word chunks, whitespace attached to the preceding word. */
function chunkWords(text: string, wordsPerChunk: number): string[] {
    const parts = text.match(/\S+\s*|\s+/g) ?? []
    const chunks: string[] = []
    for (let i = 0; i < parts.length; i += wordsPerChunk) {
        chunks.push(parts.slice(i, i + wordsPerChunk).join(''))
    }
    return chunks.filter((chunk) => chunk.length > 0)
}

function countWords(node: JSONContent): number {
    if (node.type === 'text') return (node.text ?? '').split(/\s+/).filter(Boolean).length
    return (node.content ?? []).reduce((sum, child) => sum + countWords(child), 0)
}

function addSuggestionMark(node: JSONContent): JSONContent {
    const marks = [...(node.marks ?? [])]
    if (!marks.some((mark) => mark.type === AI_SUGGESTION_MARK_NAME)) marks.push({ type: AI_SUGGESTION_MARK_NAME })
    return { ...node, marks }
}

/**
 * Deep-clone a JSON subtree with the aiSuggestion mark added to every text
 * node (container/leaf blocks stay unmarked — block nodes may not allow
 * marks in the schema).
 */
export function withSuggestionMark(node: JSONContent): JSONContent {
    const next: JSONContent = node.type === 'text' ? addSuggestionMark(node) : { ...node }
    if (node.content) next.content = node.content.map(withSuggestionMark)
    return next
}

export function buildRevealPlan(doc: JSONContent, options: RevealPlanOptions = {}): RevealStep[] {
    const blocks = doc.content ?? []
    const totalWords = blocks.reduce((sum, block) => sum + countWords(block), 0)
    const maxTextSteps = options.maxTextSteps ?? DEFAULT_MAX_TEXT_STEPS
    const wordsPerChunk = Math.max(1, Math.ceil(totalWords / maxTextSteps))

    const steps: RevealStep[] = []

    blocks.forEach((block, blockIndex) => {
        const isTypewriterBlock = block.type === 'paragraph' || block.type === 'heading'
        if (!isTypewriterBlock) {
            steps.push({ kind: 'block', node: withSuggestionMark(block) })
            return
        }
        const skipOpen = blockIndex === 0 && options.inlineFirstBlock && block.type === 'paragraph'
        if (!skipOpen) {
            steps.push({
                kind: 'newBlock',
                nodeType: block.type as 'paragraph' | 'heading',
                attrs: block.attrs,
            })
        }
        for (const inline of block.content ?? []) {
            if (inline.type === 'text') {
                for (const chunk of chunkWords(inline.text ?? '', wordsPerChunk)) {
                    steps.push({ kind: 'text', text: chunk, marks: inline.marks })
                }
            } else {
                // Inline atoms accept marks; mark the atom itself so accept/
                // reject tracking covers it.
                steps.push({ kind: 'atom', node: addSuggestionMark(withSuggestionMark(inline)) })
            }
        }
    })

    return steps
}
