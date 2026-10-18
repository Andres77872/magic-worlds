/** Map a frozen saved suggestion into the exact current canonical document. */
import type { Editor } from '@tiptap/core'
import { documentSignature, documentText } from '@/shared/storyDocument'
import { captureDocument, documentRange } from './manuscript'
import { manuscriptSegments } from './extensions/manuscriptSearchTarget'
import type { SavedGenerationReview } from './types'
import { verifyStoryVariantSnapshot } from '@/infrastructure/api/storyVariantContract'
import type { StorySelection } from '@/shared'

export function savedGenerationTarget(editor: Editor, review: SavedGenerationReview) {
    const { generation, operation, document, variant } = review
    if (editor.isDestroyed || !['candidate', 'stashed'].includes(generation.status) || !generation.output.trim()
        || documentSignature(captureDocument(editor)) !== documentSignature(document)) return null
    const text = documentText(document), size = editor.state.doc.content.size, selection = generation.inputRange
    if (variant) {
        if (operation !== 'replace_scene' || !verifyStoryVariantSnapshot(variant, generation.storyId)
            || documentSignature(variant.baseDocument) !== documentSignature(document)) return null
        const parent = variant.parent.parent
        if (parent.id !== generation.id || parent.sceneId !== generation.sceneId || parent.chapterId !== generation.chapterId
            || parent.baseRevision !== generation.baseRevision || parent.command !== generation.command || parent.output !== generation.output
            || parent.instruction !== (generation.instruction ?? null)) return null
        return { pos: size, range: { from: 0, to: size }, inline: false }
    }
    if (generation.command !== (operation === 'append_scene' ? 'continue' : 'rewrite')) return null
    if (operation === 'append_scene') {
        if (selection !== null) return null
        return { pos: size, range: text ? undefined : { from: 0, to: size }, inline: false }
    }
    if (!selection || !Number.isSafeInteger(selection.startOffset) || !Number.isSafeInteger(selection.endOffset)
        || selection.startOffset < 0 || selection.endOffset < selection.startOffset || selection.endOffset > text.length
        || text.slice(selection.startOffset, selection.endOffset) !== selection.text) return null
    if (operation === 'replace_scene') {
        if (selection.startOffset !== 0 || selection.endOffset !== text.length) return null
        return { pos: size, range: { from: 0, to: size }, inline: false }
    }
    const range = exactManuscriptRange(editor, selection)
    return range ? { pos: range.to, range, inline: true } : null
}

/** Exact UTF-16 passage lookup, including indivisible saved mentions. */
export function exactManuscriptRange(editor: Editor, selection: StorySelection) {
    const text = documentText(captureDocument(editor))
    if (!Number.isSafeInteger(selection.startOffset) || !Number.isSafeInteger(selection.endOffset)
        || selection.startOffset < 0 || selection.endOffset > text.length || selection.endOffset < selection.startOffset
        || text.slice(selection.startOffset, selection.endOffset) !== selection.text) return null
    const split = (at: number) => at > 0 && at < text.length
        && /[\uD800-\uDBFF]/u.test(text[at - 1]) && /[\uDC00-\uDFFF]/u.test(text[at])
    if (selection.startOffset === selection.endOffset || split(selection.startOffset) || split(selection.endOffset)) return null
    const segments = manuscriptSegments(editor.state.doc)
    const positions = (offset: number) => [...new Set(segments.flatMap(segment => {
        if (offset < segment.start || offset > segment.end) return []
        if (!segment.atom) return [segment.from + offset - segment.start]
        return offset === segment.start ? [segment.from] : offset === segment.end ? [segment.to] : []
    }))]
    for (const from of positions(selection.startOffset)) for (const to of positions(selection.endOffset)) {
        if (to <= from) continue
        const exact = documentRange(editor, from, to)
        if (exact && exact.startOffset === selection.startOffset && exact.endOffset === selection.endOffset && exact.text === selection.text) {
            return { from, to }
        }
    }
    return null
}
