import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { cx } from './cx'
import { Button } from './Button'
import { IconButton } from './IconButton'

export type ToastTone = 'success' | 'error'

interface ToastProps {
    open: boolean
    tone: ToastTone
    title: ReactNode
    message?: ReactNode
    onClose: () => void
    autoCloseMs?: number | false
    /** Optional follow-up action rendered under the text (e.g. "Open tasks"). */
    action?: { label: string; onClick: () => void }
}

const TONE: Record<ToastTone, string> = {
    success: 'border-verdant-500/30 bg-ink-800/95 shadow-glow-verdant',
    error: 'border-blood-500/35 bg-ink-800/95 shadow-glow-blood',
}

/** Floating app notice for short-lived action feedback. */
export function Toast({ open, tone, title, message, onClose, autoCloseMs, action }: ToastProps) {
    const { t } = useTranslation()
    const titleId = useId()

    useEffect(() => {
        // Errors stay until dismissed — auto-close only ever applies to success notices.
        if (!open || tone === 'error' || autoCloseMs === false || !autoCloseMs) return
        const timer = window.setTimeout(onClose, autoCloseMs)
        return () => window.clearTimeout(timer)
    }, [autoCloseMs, onClose, open, tone])

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
                    <p id={titleId} className="font-ui text-label font-semibold leading-snug text-parchment-50">
                        {title}
                    </p>
                    {message && (
                        <p className="mt-0.5 break-words font-ui text-caption leading-relaxed text-parchment-300">
                            {message}
                        </p>
                    )}
                    {action && (
                        <Button variant="ghost" size="sm" className="mt-1.5 -ml-2" onClick={action.onClick}>
                            {action.label}
                        </Button>
                    )}
                </div>
                <IconButton label={t('ui.toast.dismiss')} size="sm" onClick={onClose}>
                    <X size={14} />
                </IconButton>
            </div>
        </div>,
        document.body,
    )
}
