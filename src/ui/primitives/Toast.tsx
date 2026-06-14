import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { cx } from './cx'
import { IconButton } from './IconButton'

export type ToastTone = 'success' | 'error'

interface ToastProps {
    open: boolean
    tone: ToastTone
    title: ReactNode
    message?: ReactNode
    onClose: () => void
    autoCloseMs?: number | false
}

const TONE: Record<ToastTone, string> = {
    success: 'border-verdant-500/30 bg-ink-800/95 shadow-[0_18px_44px_-18px_rgba(111,191,139,.55)]',
    error: 'border-blood-500/35 bg-ink-800/95 shadow-[0_18px_44px_-18px_rgba(226,104,95,.55)]',
}

/** Floating app notice for short-lived action feedback. */
export function Toast({ open, tone, title, message, onClose, autoCloseMs }: ToastProps) {
    const { t } = useTranslation()
    const titleId = useId()

    useEffect(() => {
        if (!open || autoCloseMs === false || !autoCloseMs) return
        const timer = window.setTimeout(onClose, autoCloseMs)
        return () => window.clearTimeout(timer)
    }, [autoCloseMs, onClose, open])

    if (!open || typeof document === 'undefined') return null

    const isError = tone === 'error'
    const Icon = isError ? AlertTriangle : CheckCircle2

    return createPortal(
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[110] flex justify-center sm:inset-x-auto sm:right-5 sm:bottom-5">
            <div
                role={isError ? 'alert' : 'status'}
                aria-live={isError ? 'assertive' : 'polite'}
                aria-labelledby={titleId}
                className={cx(
                    'pointer-events-auto flex w-full max-w-[min(calc(100vw-2rem),24rem)] items-start gap-3 rounded-lg border p-3.5 text-parchment-100 ring-1 ring-ink-900/60 backdrop-blur-md',
                    TONE[tone],
                )}
            >
                <span
                    className={cx(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        isError ? 'bg-blood-500/15 text-blood-500' : 'bg-verdant-500/15 text-verdant-500',
                    )}
                    aria-hidden="true"
                >
                    <Icon size={16} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                    <p id={titleId} className="font-ui text-[13px] font-semibold leading-snug text-parchment-50">
                        {title}
                    </p>
                    {message && (
                        <p className="mt-0.5 break-words font-ui text-[12px] leading-relaxed text-parchment-300">
                            {message}
                        </p>
                    )}
                </div>
                <IconButton label={t('ui.toast.dismiss')} size="sm" className="h-7 w-7" onClick={onClose}>
                    <X size={14} />
                </IconButton>
            </div>
        </div>,
        document.body,
    )
}
