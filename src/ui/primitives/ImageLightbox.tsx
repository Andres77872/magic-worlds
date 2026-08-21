/**
 * Reverie image lightbox — a full-bleed portal overlay that shows a single image
 * at its natural size (capped to the viewport). Dim+blur scrim, click-scrim or
 * Esc to close. `src` is used as-is (resolve relative media URLs before passing).
 *
 * Uses the shared dismissable-layer behavior so it stacks correctly: it is
 * commonly opened from inside a Drawer, and Escape must close the lightbox
 * alone rather than the drawer underneath it as well.
 */
import type { ReactNode } from 'react'
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { AuthenticatedImage } from './AuthenticatedImage'
import { cx } from './cx'
import { IconButton } from './IconButton'
import { useDismissableLayer, useScrimDismiss } from './useDismissableLayer'

interface ImageLightboxProps {
    open: boolean
    src?: string
    alt?: string
    details?: ReactNode
    onClose: () => void
}

export function ImageLightbox({ open, src, alt = '', details, onClose }: ImageLightboxProps) {
    const { t } = useTranslation()
    const panelRef = useRef<HTMLDivElement>(null)
    const shown = open && Boolean(src)
    useDismissableLayer({ open: shown, onClose, panelRef, label: 'lightbox' })
    const scrim = useScrimDismiss(onClose)

    if (!shown) return null
    return createPortal(
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/80 p-4 backdrop-blur-sm"
            {...scrim}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={alt || t('common.close')}
                tabIndex={-1}
                className="flex max-h-[90dvh] w-full max-w-[90vw] flex-col items-center gap-3 outline-none"
            >
                {/* Inside the panel: the focus trap cycles panel descendants only,
                    and this is the dialog's single control. The scrim stays its
                    containing block (the panel is not positioned), so it keeps its
                    viewport-corner placement. */}
                <IconButton label={t('common.close')} onClick={onClose} className="absolute right-4 top-4 bg-ink-900/40">
                    <X size={20} strokeWidth={1.75} />
                </IconButton>
                <AuthenticatedImage
                    src={src}
                    alt={alt}
                    className={cx(
                        'max-w-full rounded-xl object-contain shadow-lg',
                        details ? 'max-h-[68dvh]' : 'max-h-[90dvh]',
                    )}
                />
                {details && (
                    <div className="max-h-44 w-full max-w-3xl overflow-y-auto rounded-lg border border-parchment-50/10 bg-ink-800/95 p-4 shadow-lg">
                        {details}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    )
}
