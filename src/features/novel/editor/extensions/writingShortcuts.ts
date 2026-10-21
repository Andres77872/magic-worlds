import { Extension } from '@tiptap/core'

/**
 * The prose's own AI shortcuts. Mod-Enter opens the beat composer at the cursor; Mod-Shift-Enter asks for a completion
 * (A27) while completions are on, and otherwise opens the composer too. They have to be keymaps: the view cancels a real
 * Enter before the editor shell sees it. The extension runs before StarterKit's hard break, which also binds Mod-Enter;
 * each handler declines when it does not apply, so Regenerate during review still answers Mod-Enter.
 */
export function createWritingShortcuts({ onBeat, onCompletion }: { onBeat: () => boolean; onCompletion: () => boolean }) {
    return Extension.create({
        name: 'manuscriptWritingShortcuts',
        priority: 1000,
        addKeyboardShortcuts() {
            return {
                'Mod-Enter': () => onBeat(),
                'Mod-Shift-Enter': () => onCompletion() || onBeat(),
            }
        },
    })
}
