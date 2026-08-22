/**
 * useEditorChrome — the two ambient behaviours of the manuscript surface that
 * are about the writer's hands rather than the document: the Ctrl/Cmd "armed"
 * state that lights up detected references, and typewriter scrolling.
 *
 * They lived inline in NovelEditor and had nothing to do with anything else
 * there.
 */

import { useEffect, useState, type RefObject } from 'react'
import type { Editor } from '@tiptap/core'
import type { InlineAIPhase } from '../types'

interface UseEditorChromeOptions {
    containerRef: RefObject<HTMLElement | null>
    typewriter: boolean
    getPhase: () => InlineAIPhase
}

export function useEditorChrome(editor: Editor | null, { containerRef, typewriter, getPhase }: UseEditorChromeOptions) {
    const [armed, setArmed] = useState(false)

    // Holding Ctrl/Cmd brightens detected references and turns the cursor into
    // a pointer (mirrors the chat composer).
    useEffect(() => {
        const sync = (event: KeyboardEvent) => setArmed(event.ctrlKey || event.metaKey)
        const reset = () => setArmed(false)
        window.addEventListener('keydown', sync)
        window.addEventListener('keyup', sync)
        window.addEventListener('blur', reset)
        return () => {
            window.removeEventListener('keydown', sync)
            window.removeEventListener('keyup', sync)
            window.removeEventListener('blur', reset)
        }
    }, [])

    // Keep the caret line vertically centered. Never runs while the AI owns the
    // document — that lifecycle scrolls once, on its own terms.
    useEffect(() => {
        if (!editor || !typewriter) return
        const recenter = () => {
            if (getPhase() !== 'idle') return
            const container = containerRef.current
            if (!container) return
            try {
                const coords = editor.view.coordsAtPos(editor.state.selection.head)
                const rect = container.getBoundingClientRect()
                container.scrollTop += coords.top - rect.top - rect.height * 0.45
            } catch {
                // coordsAtPos can throw mid-transaction; skip this tick.
            }
        }
        editor.on('selectionUpdate', recenter)
        editor.on('update', recenter)
        return () => {
            editor.off('selectionUpdate', recenter)
            editor.off('update', recenter)
        }
    }, [containerRef, editor, getPhase, typewriter])

    return { armed }
}
