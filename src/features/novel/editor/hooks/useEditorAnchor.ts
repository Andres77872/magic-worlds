/**
 * useEditorAnchor — tracks a document position as container-relative pixel
 * coordinates (for the suggestion pill). Recomputes on editor transactions,
 * container scroll, and window resize.
 */

import { useEffect, useState, type RefObject } from 'react'
import type { Editor } from '@tiptap/core'

export interface EditorAnchor {
    left: number
    top: number
}

export function useEditorAnchor(
    editor: Editor | null,
    containerRef: RefObject<HTMLElement | null>,
    getPos: () => number | null,
    active: boolean,
): EditorAnchor | null {
    const [anchor, setAnchor] = useState<EditorAnchor | null>(null)

    useEffect(() => {
        if (!editor || !active) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAnchor(null)
            return
        }
        const update = () => {
            const container = containerRef.current
            const pos = getPos()
            if (!container || pos == null) {
                setAnchor(null)
                return
            }
            try {
                const coords = editor.view.coordsAtPos(Math.min(pos, editor.state.doc.content.size))
                const rect = container.getBoundingClientRect()
                setAnchor({
                    left: Math.max(8, Math.min(coords.left - rect.left, rect.width - 8)),
                    top: coords.bottom - rect.top + container.scrollTop + 8,
                })
            } catch {
                setAnchor(null)
            }
        }
        update()
        editor.on('transaction', update)
        const container = containerRef.current
        container?.addEventListener('scroll', update)
        window.addEventListener('resize', update)
        return () => {
            editor.off('transaction', update)
            container?.removeEventListener('scroll', update)
            window.removeEventListener('resize', update)
        }
        // getPos is a stable closure by convention (reads live editor state).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, active, containerRef])

    return anchor
}
