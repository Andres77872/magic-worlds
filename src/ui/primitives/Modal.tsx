/**
 * Reverie modal — dim+blur scrim, centered candlelit panel, optional
 * display-serif header (with close) and footer action bar.
 */
import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { cx } from './cx'
import { IconButton } from './IconButton'

export type ModalSize = 'sm' | 'md' | 'lg'

interface ModalProps {
    open: boolean
    onClose: () => void
    title?: ReactNode
    icon?: ReactNode
    showClose?: boolean
    size?: ModalSize
    footer?: ReactNode
    className?: string
    closeLabel?: string
    children: ReactNode
}

const MAX: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
}

export function Modal({
    open,
    onClose,
    title,
    icon,
    showClose = true,
    size = 'md',
    footer,
    className,
    closeLabel,
    children,
}: ModalProps) {
    const { t } = useTranslation()
    const titleId = useId()

    if (!open) return null
    // Portal to <body> so the fixed overlay escapes any ancestor CSS transform /
    // backdrop-filter that would otherwise become its containing block.
    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                className={cx(
                    'w-full overflow-hidden rounded-2xl border border-parchment-50/10 bg-ink-700 shadow-lg',
                    MAX[size],
                    className,
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {(title || showClose) && (
                    <div className="flex items-center justify-between border-b border-parchment-50/10 px-6 py-4">
                        <div className="flex items-center gap-2.5">
                            {icon}
                            {title && (
                                <h2 id={titleId} className="font-display text-[24px] font-semibold text-parchment-50">
                                    {title}
                                </h2>
                            )}
                        </div>
                        {showClose && (
                            <IconButton label={closeLabel ?? t('common.close')} onClick={onClose}>
                                <X size={18} strokeWidth={1.75} />
                            </IconButton>
                        )}
                    </div>
                )}
                <div className="px-6 py-6">{children}</div>
                {footer && (
                    <div className="flex justify-end gap-2 border-t border-parchment-50/10 px-6 py-4">{footer}</div>
                )}
            </div>
        </div>,
        document.body,
    )
}
