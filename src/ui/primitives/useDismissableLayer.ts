/**
 * Shared overlay behavior for Modal / Drawer / ImageLightbox (and any future
 * dialog surface): Escape-to-close, page scroll-lock, initial focus into the
 * panel, a Tab focus-trap that keeps focus inside the panel, and focus
 * restoration to the previously-focused element when the layer closes.
 *
 * Stacking is handled by `layerStack`: only the FRONTMOST open layer acts on
 * Escape and traps Tab, so closing a lightbox opened from inside a drawer no
 * longer closes the drawer with it. The scroll lock is ref-counted there too.
 *
 * The panel element must be focusable for the trap fallback — give it
 * `tabIndex={-1}` and attach `panelRef` to it.
 */
import { useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import { isTopLayer, lockScroll, popLayer, pushLayer, unlockScroll } from './layerStack'

interface DismissableLayerOptions<T extends HTMLElement> {
    open: boolean
    onClose: () => void
    panelRef: RefObject<T | null>
    /** Set false for a layer that should not lock page scrolling. */
    lockScroll?: boolean
    /** Label used only to make the layer stack readable while debugging. */
    label?: string
}

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useDismissableLayer<T extends HTMLElement>({
    open,
    onClose,
    panelRef,
    lockScroll: shouldLockScroll = true,
    label = 'layer',
}: DismissableLayerOptions<T>) {
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
        const layerId = pushLayer(label)

        const getFocusable = (panel: T) =>
            Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
                (el) => el.offsetParent !== null || el === document.activeElement,
            )

        const onKeyDown = (e: KeyboardEvent) => {
            // Only the frontmost layer reacts: with a lightbox open over a drawer,
            // Escape must close the lightbox alone.
            if (!isTopLayer(layerId)) return
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
        if (shouldLockScroll) lockScroll()

        // Move focus into the panel (first focusable, else the panel itself).
        const panel = panelRef.current
        const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
        ;(firstFocusable ?? panel)?.focus()

        return () => {
            document.removeEventListener('keydown', onKeyDown)
            popLayer(layerId)
            if (shouldLockScroll) unlockScroll()
            if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                previouslyFocused.focus()
            }
        }
    }, [open, panelRef, shouldLockScroll, label])
}

/**
 * Scrim dismissal that survives a drag. A plain `onClick={onClose}` on the
 * backdrop also fires when a press *starts* inside the panel and *ends* outside
 * it — selecting text in a dialog and releasing over the scrim closed the
 * dialog and lost the work. These props only close when both the press and the
 * release land on the scrim itself.
 */
export function useScrimDismiss(onClose: () => void) {
    const armed = useRef(false)
    return {
        onPointerDown: (e: PointerEvent) => {
            armed.current = e.target === e.currentTarget
        },
        onClick: (e: MouseEvent) => {
            const shouldClose = armed.current && e.target === e.currentTarget
            armed.current = false
            if (shouldClose) onClose()
        },
    }
}
