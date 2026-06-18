import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import type { CardMenuAnchor, CardOption } from './CardOptions'

interface UseCardActionContextMenuOptions {
    options: CardOption[]
    disabled?: boolean
    returnFocusRef: RefObject<HTMLElement>
    onOpenChange?: (isOpen: boolean) => void
}

const LONG_PRESS_MS = 520

function isNestedInteractiveTarget(target: EventTarget | null, currentTarget: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    const interactive = target.closest('button,a,input,textarea,select,[role="button"],[role="menuitem"],[contenteditable="true"]')
    return Boolean(interactive && interactive !== currentTarget)
}

export function useCardActionContextMenu({
    options,
    disabled = false,
    returnFocusRef,
    onOpenChange,
}: UseCardActionContextMenuOptions) {
    const [anchor, setAnchor] = useState<CardMenuAnchor | null>(null)
    const longPressTimerRef = useRef<number | null>(null)
    const didLongPressRef = useRef(false)

    const closeContextMenu = useCallback(() => {
        setAnchor(null)
        onOpenChange?.(false)
    }, [onOpenChange])

    const openContextMenu = useCallback((nextAnchor: CardMenuAnchor) => {
        if (disabled || options.length === 0) return false
        setAnchor(nextAnchor)
        onOpenChange?.(true)
        return true
    }, [disabled, onOpenChange, options.length])

    const clearLongPress = useCallback(() => {
        if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
        }
    }, [])

    useEffect(() => {
        return clearLongPress
    }, [clearLongPress])

    useEffect(() => {
        if (anchor && (disabled || options.length === 0)) closeContextMenu()
    }, [anchor, closeContextMenu, disabled, options.length])

    const handleContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
        if (disabled || options.length === 0) return
        if (isNestedInteractiveTarget(event.target, event.currentTarget)) return
        event.preventDefault()
        event.stopPropagation()
        openContextMenu({ top: event.clientY, left: event.clientX })
    }, [disabled, openContextMenu, options.length])

    const handleContextMenuKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
        if (!((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu')) return false
        const target = returnFocusRef.current
        if (!target || disabled || options.length === 0) return false
        event.preventDefault()
        event.stopPropagation()
        const rect = target.getBoundingClientRect()
        return openContextMenu({ top: rect.top + 16, left: rect.left + 16 })
    }, [disabled, openContextMenu, options.length, returnFocusRef])

    const handlePointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === 'mouse' || disabled || options.length === 0) return
        if (isNestedInteractiveTarget(event.target, event.currentTarget)) return
        const nextAnchor = { top: event.clientY, left: event.clientX }
        clearLongPress()
        longPressTimerRef.current = window.setTimeout(() => {
            didLongPressRef.current = true
            openContextMenu(nextAnchor)
        }, LONG_PRESS_MS)
    }, [clearLongPress, disabled, openContextMenu, options.length])

    const suppressClickAfterLongPress = useCallback((event: MouseEvent<HTMLElement>) => {
        if (!didLongPressRef.current) return false
        event.preventDefault()
        event.stopPropagation()
        didLongPressRef.current = false
        return true
    }, [])

    return {
        isOpen: anchor !== null,
        closeContextMenu,
        handleContextMenu,
        handleContextMenuKeyDown,
        menuProps: {
            options,
            open: anchor !== null,
            anchor,
            disabled,
            returnFocusRef,
            onClose: closeContextMenu,
        },
        pointerHandlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: clearLongPress,
            onPointerCancel: clearLongPress,
            onPointerLeave: clearLongPress,
            onPointerUp: clearLongPress,
        },
        suppressClickAfterLongPress,
    }
}
