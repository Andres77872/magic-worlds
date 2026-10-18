import { Extension } from '@tiptap/core'

/**
 * Mod-Shift-Enter in the prose asks for a completion at the cursor (A27). It has to be a keymap: the view cancels a real
 * Enter before the editor shell sees it. While completions are off the key is left alone.
 */
export function createCompletionShortcut(onRequest: () => boolean) {
    return Extension.create({
        name: 'manuscriptCompletionShortcut',
        addKeyboardShortcuts() {
            return { 'Mod-Shift-Enter': () => onRequest() }
        },
    })
}
