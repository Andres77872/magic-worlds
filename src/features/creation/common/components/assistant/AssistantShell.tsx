/**
 * Shared shell for floating assistant copilots: the closed-state FAB and the
 * open-state fixed dialog panel. Owns the positioning/z-index/sizing so the
 * card creators and the lorebook studio can never drift apart.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { MessageCircle } from 'lucide-react'
import { cx } from '@/ui/primitives'
import { AssistantDragContext, type AssistantDragContextValue } from './assistantDragContext'

interface AssistantPosition {
    x: number
    y: number
}

interface AssistantSize {
    width: number
    height: number
}

const VIEWPORT_PADDING = 16
const DEFAULT_PANEL_SIZE: AssistantSize = { width: 420, height: 640 }

function positionStorageKey(dialogLabel: string): string {
    return `magic_worlds:assistant_position:v1:${dialogLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function readPosition(key: string): AssistantPosition | null {
    if (typeof window === 'undefined') return null
    try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || 'null') as Partial<AssistantPosition> | null
        if (!parsed || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null
        return { x: Number(parsed.x), y: Number(parsed.y) }
    } catch {
        return null
    }
}

function savePosition(key: string, position: AssistantPosition): void {
    try {
        window.localStorage.setItem(key, JSON.stringify(position))
    } catch {
        /* Position persistence is a convenience; assistant behavior should not depend on it. */
    }
}

function samePosition(a: AssistantPosition, b: AssistantPosition): boolean {
    return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y)
}

function clampPosition(position: AssistantPosition, size: AssistantSize): AssistantPosition {
    if (typeof window === 'undefined') return position
    const minX = VIEWPORT_PADDING
    const minY = VIEWPORT_PADDING
    const maxX = Math.max(minX, window.innerWidth - size.width - VIEWPORT_PADDING)
    const maxY = Math.max(minY, window.innerHeight - size.height - VIEWPORT_PADDING)
    return {
        x: Math.min(Math.max(position.x, minX), maxX),
        y: Math.min(Math.max(position.y, minY), maxY),
    }
}

function panelSizeFrom(element: HTMLElement | null): AssistantSize {
    if (!element) return DEFAULT_PANEL_SIZE
    const rect = element.getBoundingClientRect()
    return {
        width: rect.width || DEFAULT_PANEL_SIZE.width,
        height: rect.height || DEFAULT_PANEL_SIZE.height,
    }
}

interface AssistantShellProps {
    open: boolean
    onOpen: () => void
    /** Accessible label for the closed-state FAB, e.g. "Open card assistant". */
    fabLabel: string
    /** Accessible label for the open dialog, e.g. "Card assistant". */
    dialogLabel: string
    children: ReactNode
}

export function AssistantShell({ open, onOpen, fabLabel, dialogLabel, children }: AssistantShellProps) {
    const storageKey = positionStorageKey(dialogLabel)
    const [position, setPosition] = useState<AssistantPosition | null>(() => readPosition(storageKey))
    const [dragging, setDragging] = useState(false)
    const panelRef = useRef<HTMLElement>(null)
    const positionRef = useRef<AssistantPosition | null>(position)
    const dragRef = useRef<{
        pointerId: number
        startX: number
        startY: number
        origin: AssistantPosition
        size: AssistantSize
    } | null>(null)

    useEffect(() => {
        positionRef.current = position
    }, [position])

    const clampCurrentPosition = useCallback(() => {
        const current = positionRef.current
        if (!current) return
        const next = clampPosition(current, panelSizeFrom(panelRef.current))
        if (samePosition(current, next)) return
        positionRef.current = next
        setPosition(next)
        savePosition(storageKey, next)
    }, [storageKey])

    useEffect(() => {
        if (!open || !position) return
        const frame = window.requestAnimationFrame(clampCurrentPosition)
        return () => window.cancelAnimationFrame(frame)
    }, [open, position, clampCurrentPosition])

    useEffect(() => {
        if (!open || !position) return undefined
        const handleResize = () => clampCurrentPosition()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [open, position, clampCurrentPosition])

    const startDrag = (e: PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return
        const rect = panelRef.current?.getBoundingClientRect()
        if (!rect) return
        e.preventDefault()
        e.stopPropagation()
        const size = { width: rect.width || DEFAULT_PANEL_SIZE.width, height: rect.height || DEFAULT_PANEL_SIZE.height }
        const origin = positionRef.current ?? { x: rect.left, y: rect.top }
        const nextOrigin = clampPosition(origin, size)
        positionRef.current = nextOrigin
        setPosition(nextOrigin)
        setDragging(true)
        dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            origin: nextOrigin,
            size,
        }
        e.currentTarget.setPointerCapture?.(e.pointerId)
    }

    const moveDrag = (e: PointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        e.preventDefault()
        const next = clampPosition(
            {
                x: drag.origin.x + e.clientX - drag.startX,
                y: drag.origin.y + e.clientY - drag.startY,
            },
            drag.size,
        )
        positionRef.current = next
        setPosition(next)
    }

    const endDrag = (e: PointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        e.preventDefault()
        dragRef.current = null
        setDragging(false)
        if (positionRef.current) savePosition(storageKey, positionRef.current)
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture?.(e.pointerId)
    }

    const nudgePanel = (e: KeyboardEvent<HTMLButtonElement>) => {
        const delta = e.shiftKey ? 64 : 16
        const direction: Partial<Record<string, AssistantPosition>> = {
            ArrowLeft: { x: -delta, y: 0 },
            ArrowRight: { x: delta, y: 0 },
            ArrowUp: { x: 0, y: -delta },
            ArrowDown: { x: 0, y: delta },
        }
        const move = direction[e.key]
        if (!move) return
        const rect = panelRef.current?.getBoundingClientRect()
        if (!rect) return
        e.preventDefault()
        e.stopPropagation()
        const size = { width: rect.width || DEFAULT_PANEL_SIZE.width, height: rect.height || DEFAULT_PANEL_SIZE.height }
        const origin = positionRef.current ?? { x: rect.left, y: rect.top }
        const next = clampPosition({ x: origin.x + move.x, y: origin.y + move.y }, size)
        positionRef.current = next
        setPosition(next)
        savePosition(storageKey, next)
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={onOpen}
                title={dialogLabel}
                aria-label={fabLabel}
                className="fixed bottom-5 right-5 z-50 grid h-14 w-14 cursor-pointer place-items-center rounded-full bg-ember-500 text-on-ember shadow-lg transition-all hover:bg-ember-400 hover:shadow-glow-ember active:scale-[.98]"
            >
                <MessageCircle size={24} />
            </button>
        )
    }

    const customPosition = position !== null
    const panelStyle: CSSProperties | undefined = customPosition ? { left: position.x, top: position.y } : undefined
    const dragContext: AssistantDragContextValue = {
        dragging,
        dragHandleProps: {
            onPointerDown: startDrag,
            onPointerMove: moveDrag,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            onKeyDown: nudgePanel,
        },
    }

    return (
        <AssistantDragContext.Provider value={dragContext}>
            <section
                ref={panelRef}
                role="dialog"
                aria-label={dialogLabel}
                style={panelStyle}
                className={cx(
                    'fixed z-50 flex h-[min(640px,calc(100vh-2.5rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800 shadow-xl',
                    customPosition ? 'left-0 top-0' : 'bottom-5 right-5',
                    dragging && 'select-none border-ember-500/45 shadow-card-hover',
                )}
            >
                {children}
            </section>
        </AssistantDragContext.Provider>
    )
}
