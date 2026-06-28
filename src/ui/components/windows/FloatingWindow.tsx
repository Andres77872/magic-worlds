/**
 * FloatingWindow — a non-modal, draggable panel that floats above the app like a
 * desktop window. Unlike Modal/Drawer it has no scrim and does not trap focus or
 * lock scroll: the page stays fully interactive behind it. Several can stack;
 * the parent layer orders them and assigns `zIndex` (kept below the z-50 modal
 * band so editor drawers still overlay windows).
 *
 * Capabilities: drag (titlebar handle, keyboard-nudgeable), resize (corner grip),
 * minimize/collapse to the titlebar, close, bring-to-front on pointer-down, and
 * Escape-to-close when focus is inside the topmost window. On small screens it
 * falls back to a full-width bottom sheet with drag/resize disabled.
 */
import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronUp, Minus, Pencil, X } from 'lucide-react'
import { Icon, IconButton, cx, useDraggable, useIsDesktop, type DragPosition } from '@/ui/primitives'

interface FloatingWindowProps {
    title: string
    onClose: () => void
    /** Bring this window to the front (called on pointer-down anywhere in it). */
    onFocus: () => void
    zIndex: number
    /** Topmost window — gets the active border and owns Escape-to-close. */
    isTop: boolean
    /** Desktop starting position; the layer cascades these so windows don't stack exactly. */
    initialPosition?: DragPosition
    /** Optional Edit action — opens the surface's editor (rendered in the titlebar). */
    onEdit?: () => void
    editLabel?: string
    children: ReactNode
}

const DEFAULT_SIZE = { width: 440, height: 520 }
const MIN_SIZE = { width: 300, height: 220 }
const VIEWPORT_PADDING = 16

export function FloatingWindow({
    title,
    onClose,
    onFocus,
    zIndex,
    isTop,
    initialPosition,
    onEdit,
    editLabel,
    children,
}: FloatingWindowProps) {
    const { t } = useTranslation()
    const isDesktop = useIsDesktop()
    const [collapsed, setCollapsed] = useState(false)
    const [size, setSize] = useState(DEFAULT_SIZE)
    const resizeRef = useRef<{ pointerId: number; startX: number; startY: number; width: number; height: number } | null>(null)

    const { ref, style, dragging, dragHandleProps } = useDraggable({
        initialPosition,
        defaultSize: size,
        disabled: !isDesktop,
    })

    const startResize = useCallback((e: PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        resizeRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, width: size.width, height: size.height }
        e.currentTarget.setPointerCapture?.(e.pointerId)
    }, [size.width, size.height])

    const moveResize = useCallback((e: PointerEvent<HTMLDivElement>) => {
        const r = resizeRef.current
        if (!r || r.pointerId !== e.pointerId) return
        e.preventDefault()
        const rect = ref.current?.getBoundingClientRect()
        const maxWidth = typeof window !== 'undefined' && rect ? window.innerWidth - rect.left - VIEWPORT_PADDING : Infinity
        const maxHeight = typeof window !== 'undefined' && rect ? window.innerHeight - rect.top - VIEWPORT_PADDING : Infinity
        setSize({
            width: Math.min(Math.max(r.width + e.clientX - r.startX, MIN_SIZE.width), maxWidth),
            height: Math.min(Math.max(r.height + e.clientY - r.startY, MIN_SIZE.height), maxHeight),
        })
    }, [ref])

    const endResize = useCallback((e: PointerEvent<HTMLDivElement>) => {
        const r = resizeRef.current
        if (!r || r.pointerId !== e.pointerId) return
        e.preventDefault()
        resizeRef.current = null
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture?.(e.pointerId)
    }, [])

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
        if (e.key === 'Escape' && isTop) {
            e.stopPropagation()
            onClose()
        }
    }, [isTop, onClose])

    // Desktop: free-floating, positioned + sized. Mobile: a bottom sheet.
    const panelStyle: CSSProperties = isDesktop
        ? { ...style, zIndex, width: size.width, height: collapsed ? undefined : size.height }
        : { zIndex }

    return (
        <section
            ref={ref}
            role="dialog"
            aria-modal={false}
            aria-label={title}
            tabIndex={-1}
            onPointerDownCapture={onFocus}
            onKeyDown={handleKeyDown}
            style={panelStyle}
            className={cx(
                'flex flex-col overflow-hidden border border-parchment-50/10 bg-ink-800 shadow-xl',
                isDesktop
                    ? 'fixed rounded-2xl'
                    : 'fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl',
                isTop ? 'border-ember-500/30' : 'border-parchment-50/10',
                dragging && 'select-none border-ember-500/45 shadow-card-hover',
            )}
            data-testid="floating-window"
        >
            {/* Titlebar — drag handle (desktop) + actions. */}
            <div className="flex shrink-0 items-center gap-1 border-b border-parchment-50/10 bg-ink-700/70 pl-3 pr-2">
                <button
                    type="button"
                    {...(isDesktop ? dragHandleProps : {})}
                    className={cx(
                        'flex min-w-0 flex-1 items-center gap-2 border-none bg-transparent py-2.5 text-left',
                        isDesktop ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                    )}
                    aria-label={isDesktop ? t('floatingWindows.dragHandle', { title }) : title}
                >
                    <span className="min-w-0 flex-1 truncate font-ui text-sm font-semibold text-parchment-100">{title}</span>
                </button>
                {onEdit && (
                    <IconButton
                        label={editLabel ?? t('floatingWindows.edit')}
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            onEdit()
                        }}
                    >
                        <Icon icon={Pencil} size={14} />
                    </IconButton>
                )}
                <IconButton
                    label={collapsed ? t('floatingWindows.expand') : t('floatingWindows.minimize')}
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation()
                        setCollapsed((value) => !value)
                    }}
                >
                    <Icon icon={collapsed ? ChevronUp : Minus} size={15} />
                </IconButton>
                <IconButton
                    label={t('floatingWindows.close')}
                    size="sm"
                    tone="danger"
                    onClick={(e) => {
                        e.stopPropagation()
                        onClose()
                    }}
                >
                    <Icon icon={X} size={15} />
                </IconButton>
            </div>

            {!collapsed && (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
            )}

            {/* Resize grip — desktop only, expanded only. */}
            {isDesktop && !collapsed && (
                <div
                    onPointerDown={startResize}
                    onPointerMove={moveResize}
                    onPointerUp={endResize}
                    onPointerCancel={endResize}
                    aria-hidden
                    className="group/resize absolute bottom-0 right-0 flex h-5 w-5 cursor-se-resize touch-none items-end justify-end p-1"
                >
                    <span className="h-2.5 w-2.5 border-b-2 border-r-2 border-parchment-50/25 transition-colors group-hover/resize:border-ember-500/50" />
                </div>
            )}
        </section>
    )
}
