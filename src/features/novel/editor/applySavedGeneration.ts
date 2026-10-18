/**
 * Apply a saved suggestion to a scene's saved document the way reviewing it in the editor and choosing Accept does,
 * without mounting the editor: the same schema, target, preview and accept commands, and the anchor edits the editor
 * would report. Lets several scenes' suggestions be accepted together (R14) while only one scene is open.
 */
import { Editor } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
import type { StoryAnchorEdit, StoryManuscriptDocument } from '@/shared'
import { isStoryAnchorEdits } from '@/shared/storyAnchorEdits'
import { transactionAnchorEdits } from './anchorEdits'
import { AiBeat } from './extensions/aiBeat'
import { AiSuggestion } from './extensions/aiSuggestion'
import { createCodexMention } from './extensions/codexMention'
import { createManuscriptHighlight } from './extensions/manuscriptHighlight'
import { ManuscriptIdentity } from './extensions/manuscriptIdentity'
import { captureDocument } from './manuscript'
import { manuscriptStarterKit } from './manuscriptStarterKit'
import { savedGenerationTarget } from './savedGenerationTarget'
import type { SavedGenerationReview } from './types'

export interface AppliedGeneration {
    document: StoryManuscriptDocument
    /** The plain-text edits for annotation anchors; null when they cannot be proven (the server then maps anchors itself). */
    anchorEdits: StoryAnchorEdit[] | null
}

/** Null when the suggestion no longer fits the document (or is not a reviewable candidate). */
export function applySavedGeneration(review: SavedGenerationReview): AppliedGeneration | null {
    const editor = new Editor({
        element: document.createElement('div'),
        extensions: [manuscriptStarterKit(), Markdown.configure({ indentation: { style: 'space', size: 2 } }), createManuscriptHighlight(() => false),
            AiBeat, AiSuggestion, createCodexMention(() => []), ManuscriptIdentity],
        content: review.document.content,
    })
    let edits: StoryAnchorEdit[] | null = []
    try {
        editor.on('transaction', ({ transaction, appendedTransactions }) => {
            if (!transaction.docChanged && !appendedTransactions.some((value) => value.docChanged)) return
            const next = transactionAnchorEdits([transaction, ...appendedTransactions])
            const combined = next === null || edits === null ? null : [...edits, ...next]
            edits = combined && isStoryAnchorEdits(combined) ? combined : null
        })
        const target = savedGenerationTarget(editor, review)
        if (!target) return null
        const json = review.variant ? review.variant.operation.document.content : editor.markdown!.parse(review.generation.output)
        if (!editor.commands.aiStartPending(target.pos, target.range)
            || !editor.commands.aiInsertGeneration(json, { inline: target.inline, exactSnapshot: Boolean(review.variant) })
            || !editor.commands.aiAccept()) return null
        return { document: captureDocument(editor), anchorEdits: edits }
    } catch {
        return null
    } finally {
        editor.destroy()
    }
}
