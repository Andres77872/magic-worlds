/**
 * useAnchoredPopup — fixed-position coordinates for a body-portal popup
 * anchored to a trigger element. Flips above the trigger when the viewport
 * runs out of room below, and tracks scroll/resize while open. Shared by
 * Select and SuggestInput so both popups position identically.
 */
import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react'

export interface PopupPosition {
    top: number
    left: number
    width: number
}

const VIEWPORT_MARGIN = 8
const POPUP_GAP = 4

export function useAnchoredPopup(
    open: boolean,
    triggerRef: RefObject<HTMLElement>,
    popupRef: RefObject<HTMLElement>,
    /** Re-measure when this changes while open (e.g. the option list). */
    contentKey?: unknown,
): { position: PopupPosition | null; clearPosition: () => void } {
    const [position, setPosition] = useState<PopupPosition | null>(null)

    const updatePosition = useCallback(() => {
        const trigger = triggerRef.current
        if (!trigger) return
        const rect = trigger.getBoundingClientRect()
        const height = popupRef.current?.offsetHeight ?? 0
        const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN
        const openAbove = height > 0 && spaceBelow < height && rect.top - VIEWPORT_MARGIN > spaceBelow
        const top = openAbove
            ? Math.max(VIEWPORT_MARGIN, rect.top - POPUP_GAP - height)
            : rect.bottom + POPUP_GAP
        const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - rect.width - VIEWPORT_MARGIN))
        setPosition({ top, left, width: rect.width })
    }, [popupRef, triggerRef])

    useLayoutEffect(() => {
        if (open) updatePosition()
    }, [open, contentKey, updatePosition])

    useEffect(() => {
        if (!open) return
        window.addEventListener('scroll', updatePosition, true)
        window.addEventListener('resize', updatePosition)
        return () => {
            window.removeEventListener('scroll', updatePosition, true)
            window.removeEventListener('resize', updatePosition)
        }
    }, [open, updatePosition])

    const clearPosition = useCallback(() => setPosition(null), [])

    return { position, clearPosition }
}
