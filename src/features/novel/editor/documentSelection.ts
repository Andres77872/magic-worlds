/** UTF-16 offsets in the exact scene plain-text projection, bound to its revision. */
import type { Editor } from '@tiptap/core'
import type { StorySelection } from '@/shared'
import { documentRange } from './manuscript'
export type DocumentSelection = StorySelection
export function editorRangeSelection(editor:Editor,from:number,to:number):StorySelection|null {
    return documentRange(editor,from,to)
}
export function editorSelection(editor:Editor):StorySelection|null {
    const selection=editor.state.selection
    return selection.empty ? null : documentRange(editor,selection.from,selection.to)
}
export function editorCursorOffset(editor:Editor,at:number):number|null {
    return documentRange(editor,at)?.startOffset??null
}
