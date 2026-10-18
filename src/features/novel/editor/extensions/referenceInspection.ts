import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { CODEX_MENTION_NAME } from './codexMention'

export function createReferenceInspection(onInspect: (position?: number) => void) {
    return Extension.create({
        name: 'manuscriptReferenceInspection',
        addKeyboardShortcuts() {
            return { 'Alt-Enter': () => { onInspect(); return true } }
        },
        addProseMirrorPlugins() {
            return [new Plugin({ props: {
                handleClickOn: (view, _pos, node, nodePos, event, direct) => {
                    if (!direct || node.type.name !== CODEX_MENTION_NAME || !(event.ctrlKey || event.metaKey || !view.editable)) return false
                    event.preventDefault(); onInspect(nodePos); return true
                },
            } })]
        },
    })
}
