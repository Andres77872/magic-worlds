/**
 * Shared overlay behavior for Modal / Drawer (and any future dialog surface):
 * Escape-to-close, body scroll-lock, initial focus into the panel, a Tab
 * focus-trap that keeps focus inside the panel, and focus restoration to the
 * previously-focused element when the layer closes. No new dependency.
 *
 * The panel element must be focusable for the trap fallback — give it
 * `tabIndex={-1}` and attach `panelRef` to it.
 */
import { useEffect, useRef, type RefObject } from 'react'

interface DismissableLayerOptions<T extends HTMLElement> {
    open: boolean
    onClose: () => void
    panelRef: RefObject<T | null>
}

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useDismissableLayer<T extends HTMLElement>({ open, onClose, panelRef }: DismissableLayerOptions<T>) {
    // Read onClose through a ref so an inline (unstable) onClose doesn't re-run the
    // effect every render — that would re-capture focus and steal it back to the
    // first field on each parent re-render while the layer is open.
    const onCloseRef = useRef(onClose)
    useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])

    useEffect(() => {
        if (!open) return

        // Capture the trigger so focus can return to it when the layer closes.
        const previouslyFocused = document.activeElement as HTMLElement | null

        const getFocusable = (panel: T) =>
            Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
                (el) => el.offsetParent !== null || el === document.activeElement,
            )

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCloseRef.current()
                return
            }
            if (e.key !== 'Tab') return
            const panel = panelRef.current
            if (!panel) return
            const focusable = getFocusable(panel)
            if (focusable.length === 0) {
                e.preventDefault()
                panel.focus()
                return
            }
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            const active = document.activeElement
            if (e.shiftKey) {
                if (active === first || !panel.contains(active)) {
                    e.preventDefault()
                    last.focus()
                }
            } else if (active === last || !panel.contains(active)) {
                e.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', onKeyDown)
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        // Move focus into the panel (first focusable, else the panel itself).
        const panel = panelRef.current
        const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
        ;(firstFocusable ?? panel)?.focus()

        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = prevOverflow
            if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                previouslyFocused.focus()
            }
        }
    }, [open, panelRef])
}
