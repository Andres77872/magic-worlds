/**
 * Reverie drawer — right-anchored sliding panel over a dim+blur scrim. Mirrors the
 * Modal's candlelit surface and header/footer bands, but slides in from the edge and
 * fills the viewport height. Closes on scrim click or Escape.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { cx } from './cx'
import { IconButton } from './IconButton'
import { useDismissableLayer } from './useDismissableLayer'

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

interface DrawerProps {
    open: boolean
    onClose: () => void
    title?: ReactNode
    eyebrow?: ReactNode
    icon?: ReactNode
    showClose?: boolean
    size?: DrawerSize
    footer?: ReactNode
    className?: string
    children: ReactNode
}

const WIDTH: Record<DrawerSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-[600px]',
    '2xl': 'max-w-3xl',
}

const TRANSITION_MS = 220

export function Drawer({
    open,
    onClose,
    title,
    eyebrow,
    icon,
    showClose = true,
    size = 'md',
    footer,
    className,
    children,
}: DrawerProps) {
    const { t } = useTranslation()
    // Keep the panel mounted through the exit animation, then unmount.
    const [mounted, setMounted] = useState(open)
    const [entered, setEntered] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (open) {
            setMounted(true)
            const id = requestAnimationFrame(() => setEntered(true))
            return () => cancelAnimationFrame(id)
        }
        setEntered(false)
        const t = window.setTimeout(() => setMounted(false), TRANSITION_MS)
        return () => window.clearTimeout(t)
    }, [open])

    // Escape-to-close, body scroll-lock, focus-trap and focus restoration.
    useDismissableLayer({ open, onClose, panelRef })

    if (!mounted) return null

    // Portal to <body> so the fixed overlay isn't trapped by an ancestor's CSS
    // transform / backdrop-filter (e.g. the interaction left panel), which would
    // otherwise become its containing block and clip the drawer into a column.
    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
            <div
                className={cx(
                    'absolute inset-0 bg-ink-900/60 backdrop-blur-sm transition-opacity duration-200',
                    entered ? 'opacity-100' : 'opacity-0',
                )}
                onClick={onClose}
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className={cx(
                    'relative flex h-full w-full flex-col border-l border-parchment-50/10 bg-ink-700 shadow-xl outline-none transition-transform duration-200 ease-out',
                    WIDTH[size],
                    entered ? 'translate-x-0' : 'translate-x-full',
                    className,
                )}
            >
                {(title || eyebrow || showClose) && (
                    <div className="flex items-start justify-between gap-3 border-b border-parchment-50/10 px-6 py-4">
                        <div className="flex items-center gap-2.5">
                            {icon}
                            <div className="flex flex-col gap-0.5">
                                {eyebrow}
                                {title && (
                                    <h2 className="font-display text-[22px] font-semibold leading-tight text-parchment-50">
                                        {title}
                                    </h2>
                                )}
                            </div>
                        </div>
                        {showClose && (
                            <IconButton label={t('common.close')} onClick={onClose}>
                                <X size={18} strokeWidth={1.75} />
                            </IconButton>
                        )}
                    </div>
                )}
                <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer && (
                    <div className="flex justify-end gap-2 border-t border-parchment-50/10 px-6 py-4">{footer}</div>
                )}
            </div>
        </div>,
        document.body,
    )
}
