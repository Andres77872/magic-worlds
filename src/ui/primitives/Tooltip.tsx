import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type FocusEvent,
    type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from './cx'

export type TooltipPlacement = 'right'

export interface TooltipProps {
    label: string
    children: ReactNode
    disabled?: boolean
    wrapperClassName?: string
    placement?: TooltipPlacement
}

interface TooltipPosition {
    top: number
    left: number
}

const VIEWPORT_MARGIN = 8
const TOOLTIP_GAP = 8

/**
 * Visual-only hover/focus label for icon controls.
 * The floating label is portaled to the document body so overflow containers
 * cannot clip it; controls should keep their own aria-label/title.
 */
export function Tooltip({
    label,
    children,
    disabled = false,
    wrapperClassName,
    placement = 'right',
}: TooltipProps) {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const tooltipRef = useRef<HTMLDivElement>(null)
    const [hovered, setHovered] = useState(false)
    const [focusedWithin, setFocusedWithin] = useState(false)
    const [position, setPosition] = useState<TooltipPosition | null>(null)
    const visible = !disabled && label.length > 0 && (hovered || focusedWithin) && typeof document !== 'undefined'

    const updatePosition = useCallback(() => {
        if (placement !== 'right') return

        const wrapper = wrapperRef.current
        if (!wrapper) return

        const rect = wrapper.getBoundingClientRect()
        const tooltipWidth = tooltipRef.current?.offsetWidth ?? 0
        const tooltipHeight = tooltipRef.current?.offsetHeight ?? 0
        const maxLeft = window.innerWidth - tooltipWidth - VIEWPORT_MARGIN
        const maxTop = window.innerHeight - tooltipHeight - VIEWPORT_MARGIN
        const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.right + TOOLTIP_GAP, maxLeft))
        const centeredTop = rect.top + rect.height / 2 - tooltipHeight / 2
        const top = Math.max(VIEWPORT_MARGIN, Math.min(centeredTop, Math.max(VIEWPORT_MARGIN, maxTop)))

        setPosition({ top, left })
    }, [placement])

    useLayoutEffect(() => {
        if (!visible) {
            setPosition(null)
            return
        }

        updatePosition()
    }, [label, updatePosition, visible])

    useEffect(() => {
        if (!visible) return

        window.addEventListener('scroll', updatePosition, true)
        window.addEventListener('resize', updatePosition)
        return () => {
            window.removeEventListener('scroll', updatePosition, true)
            window.removeEventListener('resize', updatePosition)
        }
    }, [updatePosition, visible])

    useEffect(() => {
        if (!disabled) return
        setHovered(false)
        setFocusedWithin(false)
    }, [disabled])

    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        const nextTarget = event.relatedTarget
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            setFocusedWithin(false)
        }
    }

    return (
        <div
            ref={wrapperRef}
            className={cx('inline-flex', wrapperClassName)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setFocusedWithin(true)}
            onBlur={handleBlur}
        >
            {children}
            {visible &&
                createPortal(
                    <div
                        ref={tooltipRef}
                        role="tooltip"
                        style={{
                            position: 'fixed',
                            top: position?.top ?? -9999,
                            left: position?.left ?? -9999,
                        }}
                        className="pointer-events-none z-[100] max-w-[calc(100vw-1rem)] truncate rounded-md border border-parchment-50/[.08] bg-ink-900 px-2.5 py-1.5 font-ui text-xs text-parchment-100 shadow-xl"
                    >
                        {label}
                    </div>,
                    document.body,
                )}
        </div>
    )
}
