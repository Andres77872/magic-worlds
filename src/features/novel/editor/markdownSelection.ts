/**
 * Selection → markdown offsets. The backend's generate endpoint receives the
 * selected passage as {startOffset, endOffset, text} measured against the
 * stored markdown body — best-effort substring location (offsets are only
 * used for prompting now; the client owns text application).
 */

import type { Editor } from '@tiptap/core'

export interface MarkdownSelection {
    startOffset: number
    endOffset: number
    text: string
}

function selectedMarkdown(editor: Editor): string {
    const selectedContent = editor.state.selection.content().content.toJSON()
    const content = Array.isArray(selectedContent) ? selectedContent : selectedContent ? [selectedContent] : []
    const markdown = editor.markdown?.serialize({ type: 'doc', content })
    return markdown?.trim() ?? ''
}

function selectedText(editor: Editor): string {
    const { from, to } = editor.state.selection
    return editor.state.doc.textBetween(from, to, '\n\n').trim()
}

export function selectionFromMarkdown(markdown: string, selected: string, plain: string): MarkdownSelection | null {
    const candidates = [selected, plain]
        .map((value) => value.trim())
        .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)

    for (const candidate of candidates) {
        const startOffset = markdown.indexOf(candidate)
        if (startOffset >= 0) {
            return { startOffset, endOffset: startOffset + candidate.length, text: candidate }
        }
    }

    const compact = plain.trim().replace(/\s+/g, ' ')
    if (!compact) return null
    const compactStart = markdown.replace(/\s+/g, ' ').indexOf(compact)
    if (compactStart < 0) return null
    return { startOffset: compactStart, endOffset: compactStart + compact.length, text: plain.trim() }
}

export function editorSelection(editor: Editor): MarkdownSelection | null {
    if (editor.state.selection.empty) return null
    return selectionFromMarkdown(editor.getMarkdown(), selectedMarkdown(editor), selectedText(editor))
}
