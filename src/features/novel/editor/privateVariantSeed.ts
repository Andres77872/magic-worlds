import type { Editor } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import { documentSignature, documentText, identifyDocument, isStoryDocument } from '@/shared/storyDocument'
import type { AuthorVariantContext } from '../persistence/authorVariantJournal'
import { captureDocument } from './manuscript'
import { exactManuscriptRange } from './savedGenerationTarget'
import { identifyManuscriptTransaction } from './extensions/manuscriptIdentity'

/** Compute a private starting document without dispatch, history or API effects. */
export function privateVariantSeed(editor: Editor, context: AuthorVariantContext) {
    if (editor.isDestroyed || !editor.markdown || documentSignature(captureDocument(editor)) !== documentSignature(context.baseDocument)) return null
    const command = context.parent.parent.command, selection = context.inputRange, size = editor.state.doc.content.size
    let from: number, to: number, inline = false
    if (command === 'continue' && selection === null) { from = documentText(context.baseDocument) ? size : 0; to = size }
    else if (command === 'rewrite' && selection === null) { from = 0; to = size }
    else if (['rewrite', 'expand', 'condense', 'custom'].includes(command) && selection) {
        const range = exactManuscriptRange(editor, selection)
        if (!range) return null
        from = range.from; to = range.to; inline = true
    } else return null // An unrecorded insertion point requires an explicit new target.
    try {
        const parsed = editor.markdown.parse(context.parent.parent.output)
        const fragment = Fragment.fromJSON(editor.schema, parsed.content ?? [])
        if (!fragment.childCount) return null
        const tr = editor.state.tr.replaceRange(from, to, new Slice(fragment, inline ? 1 : 0, inline ? 1 : 0))
        identifyManuscriptTransaction(tr)
        const result = identifyDocument(tr.doc.toJSON())
        return isStoryDocument(result) ? result : null
    } catch { return null }
}
