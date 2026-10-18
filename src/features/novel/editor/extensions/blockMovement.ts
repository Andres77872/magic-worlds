import { Extension } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { Plugin } from '@tiptap/pm/state'
import { BLOCK_MOVE_META } from '../blockMovement'

export function createBlockMovement(onMove: (direction: 'up' | 'down') => void) {
    return Extension.create({
        name: 'manuscriptBlockMovement',
        addKeyboardShortcuts() {
            return {
                'Alt-Shift-ArrowUp': () => { onMove('up'); return true },
                'Alt-Shift-ArrowDown': () => { onMove('down'); return true },
            }
        },
        addProseMirrorPlugins() {
            return [new Plugin({ appendTransaction(transactions, _before, state) {
                // End the move's history group as well as starting it. Immediate
                // typing and another move must each undo independently.
                return transactions.some((tr) => tr.getMeta(BLOCK_MOVE_META)) ? closeHistory(state.tr).setMeta('addToHistory', false) : null
            } })]
        },
    })
}
