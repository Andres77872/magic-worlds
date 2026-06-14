import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { cx, IconButton, useIsDesktop } from '../../../ui/primitives'

interface SidePanelDrawerProps {
    side: 'left' | 'right'
    open: boolean
    onClose: () => void
    /** Used for the mobile close button's accessible label. */
    label: string
    children: ReactNode
}

/**
 * Interaction side panel that docks inline on desktop and becomes a true
 * overlay drawer on mobile.
 *
 * On `lg+` it renders as a static flex column in the page row. Below `lg` it
 * portals to <body> at the Modal/Drawer z-rung (z-50) so it slides in *above*
 * the global icon rail (z-40) instead of being clipped behind it — the same
 * reason the base Drawer primitive portals to body. The mobile sheet stays
 * mounted and the open/closed state is driven purely by CSS transforms, so it
 * animates in *and* out without any effect-driven state. The panel's own header
 * (Back button, etc.) lives in `children`; this only adds a slim close bar.
 */
export function SidePanelDrawer({ side, open, onClose, label, children }: SidePanelDrawerProps) {
    const { t } = useTranslation()
    const isDesktop = useIsDesktop()

    // Escape-to-close + body scroll-lock while the mobile drawer is open.
    useEffect(() => {
        if (isDesktop || !open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = prevOverflow
        }
    }, [open, isDesktop, onClose])

    if (isDesktop) {
        return (
            <aside
                className={cx(
                    'hidden w-[320px] shrink-0 overflow-y-auto bg-ink-900 lg:block',
                    side === 'left' ? 'border-r border-parchment-50/[.08]' : 'border-l border-parchment-50/[.08]',
                )}
            >
                {children}
            </aside>
        )
    }

    const closed = side === 'left' ? '-translate-x-full' : 'translate-x-full'

    return createPortal(
        <div
            className={cx(
                'fixed inset-0 z-50 flex overflow-hidden',
                side === 'right' && 'justify-end',
                !open && 'pointer-events-none',
            )}
        >
            <div
                className={cx(
                    'absolute inset-0 bg-ink-900/60 backdrop-blur-sm transition-opacity duration-200',
                    open ? 'opacity-100' : 'opacity-0',
                )}
                onClick={onClose}
                aria-hidden
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={label}
                className={cx(
                    'relative flex h-full w-[320px] max-w-[85%] flex-col bg-ink-900 shadow-xl transition-transform duration-200 ease-out',
                    side === 'left' ? 'border-r border-parchment-50/[.08]' : 'border-l border-parchment-50/[.08]',
                    open ? 'translate-x-0' : closed,
                )}
            >
                <div
                    className={cx(
                        'flex shrink-0 items-center border-b border-parchment-50/[.08] px-2 py-2',
                        side === 'right' ? 'justify-start' : 'justify-end',
                    )}
                >
                    <IconButton label={t('common.closePanel', { label })} size="sm" onClick={onClose}>
                        <X size={18} strokeWidth={1.75} />
                    </IconButton>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            </div>
        </div>,
        document.body,
    )
}
