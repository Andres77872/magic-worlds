/**
 * useDraggable — pointer-driven dragging for a free-floating panel, clamped to
 * the viewport. Extracted from the PlaylistDock / AssistantShell drag (same
 * algorithm): pointer capture on a titlebar handle, 16px viewport padding,
 * keyboard arrow nudging, and an optional localStorage-persisted position.
 *
 * Attach `ref` to the panel, spread `dragHandleProps` onto a `<button>` handle
 * (keep it a real button so pointer capture re-targets reliably under React 19),
 * and apply `style` (left/top) to the panel. `dragHandleProps` matches the shape
 * used by AssistantDragContext so drag handles stay interchangeable.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

export interface DragPosition {
    x: number
    y: number
}

interface DragSize {
    width: number
    height: number
}

interface UseDraggableOptions {
    /** Seed position when there's no persisted value. `null` keeps the panel CSS-anchored. */
    initialPosition?: DragPosition | null
    /** When set, the position is restored from / saved to localStorage under this key. */
    storageKey?: string
    /** Minimum gap kept between the panel and each viewport edge. */
    viewportPadding?: number
    /** Used to clamp before the panel has been measured. */
    defaultSize?: DragSize
    /** Disable dragging entirely (e.g. on mobile sheets). */
    disabled?: boolean
}

export interface DragHandleProps {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void
    onPointerMove: (e: PointerEvent<HTMLElement>) => void
    onPointerUp: (e: PointerEvent<HTMLElement>) => void
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
}

export interface UseDraggableResult {
    ref: React.RefObject<HTMLElement | null>
    position: DragPosition | null
    style: CSSProperties | undefined
    dragging: boolean
    dragHandleProps: DragHandleProps
}

const DEFAULT_PADDING = 16
const FALLBACK_SIZE: DragSize = { width: 320, height: 200 }

function readPosition(storageKey?: string): DragPosition | null {
    if (!storageKey || typeof window === 'undefined') return null
    try {
        const parsed = JSON.parse(window.localStorage.getItem(storageKey) || 'null') as Partial<DragPosition> | null
        if (!parsed || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null
        return { x: Number(parsed.x), y: Number(parsed.y) }
    } catch {
        return null
    }
}

function savePosition(storageKey: string | undefined, position: DragPosition): void {
    if (!storageKey || typeof window === 'undefined') return
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(position))
    } catch {
        /* Position persistence is a convenience; the window must work without it. */
    }
}

function samePosition(a: DragPosition, b: DragPosition): boolean {
    return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y)
}

export function useDraggable({
    initialPosition = null,
    storageKey,
    viewportPadding = DEFAULT_PADDING,
    defaultSize = FALLBACK_SIZE,
    disabled = false,
}: UseDraggableOptions = {}): UseDraggableResult {
    const ref = useRef<HTMLElement | null>(null)
    const [position, setPosition] = useState<DragPosition | null>(() => readPosition(storageKey) ?? initialPosition)
    const [dragging, setDragging] = useState(false)
    const positionRef = useRef<DragPosition | null>(position)
    const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: DragPosition; size: DragSize } | null>(null)

    useEffect(() => {
        positionRef.current = position
    }, [position])

    const measure = useCallback((): DragSize => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return defaultSize
        return { width: rect.width || defaultSize.width, height: rect.height || defaultSize.height }
    }, [defaultSize])

    const clamp = useCallback(
        (pos: DragPosition, size: DragSize): DragPosition => {
            if (typeof window === 'undefined') return pos
            const minX = viewportPadding
            const minY = viewportPadding
            const maxX = Math.max(minX, window.innerWidth - size.width - viewportPadding)
            const maxY = Math.max(minY, window.innerHeight - size.height - viewportPadding)
            return {
                x: Math.min(Math.max(pos.x, minX), maxX),
                y: Math.min(Math.max(pos.y, minY), maxY),
            }
        },
        [viewportPadding],
    )

    const clampCurrent = useCallback(() => {
        const current = positionRef.current
        if (!current) return
        const next = clamp(current, measure())
        if (samePosition(current, next)) return
        positionRef.current = next
        setPosition(next)
        savePosition(storageKey, next)
    }, [clamp, measure, storageKey])

    // Re-clamp after the panel paints (size known) and on viewport resize.
    useEffect(() => {
        if (!position || disabled) return
        const frame = window.requestAnimationFrame(clampCurrent)
        return () => window.cancelAnimationFrame(frame)
    }, [position, clampCurrent, disabled])

    useEffect(() => {
        if (disabled) return undefined
        const onResize = () => clampCurrent()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [clampCurrent, disabled])

    const onPointerDown = useCallback(
        (e: PointerEvent<HTMLElement>) => {
            if (disabled || e.button !== 0) return
            const rect = ref.current?.getBoundingClientRect()
            if (!rect) return
            e.preventDefault()
            e.stopPropagation()
            const size = { width: rect.width, height: rect.height }
            const origin = clamp(positionRef.current ?? { x: rect.left, y: rect.top }, size)
            positionRef.current = origin
            setPosition(origin)
            setDragging(true)
            dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origin, size }
            e.currentTarget.setPointerCapture?.(e.pointerId)
        },
        [clamp, disabled],
    )

    const onPointerMove = useCallback(
        (e: PointerEvent<HTMLElement>) => {
            const drag = dragRef.current
            if (!drag || drag.pointerId !== e.pointerId) return
            e.preventDefault()
            const next = clamp(
                { x: drag.origin.x + e.clientX - drag.startX, y: drag.origin.y + e.clientY - drag.startY },
                drag.size,
            )
            positionRef.current = next
            setPosition(next)
        },
        [clamp],
    )

    const onPointerUp = useCallback((e: PointerEvent<HTMLElement>) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        e.preventDefault()
        dragRef.current = null
        setDragging(false)
        if (positionRef.current) savePosition(storageKey, positionRef.current)
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture?.(e.pointerId)
    }, [storageKey])

    const onKeyDown = useCallback(
        (e: KeyboardEvent<HTMLElement>) => {
            if (disabled) return
            const delta = e.shiftKey ? 64 : 16
            const move: Partial<Record<string, DragPosition>> = {
                ArrowLeft: { x: -delta, y: 0 },
                ArrowRight: { x: delta, y: 0 },
                ArrowUp: { x: 0, y: -delta },
                ArrowDown: { x: 0, y: delta },
            }
            const step = move[e.key]
            if (!step) return
            const rect = ref.current?.getBoundingClientRect()
            if (!rect) return
            e.preventDefault()
            e.stopPropagation()
            const origin = positionRef.current ?? { x: rect.left, y: rect.top }
            const next = clamp({ x: origin.x + step.x, y: origin.y + step.y }, { width: rect.width, height: rect.height })
            positionRef.current = next
            setPosition(next)
            savePosition(storageKey, next)
        },
        [clamp, disabled, storageKey],
    )

    const style: CSSProperties | undefined = position ? { left: position.x, top: position.y } : undefined

    return {
        ref,
        position,
        style,
        dragging,
        dragHandleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
    }
}
