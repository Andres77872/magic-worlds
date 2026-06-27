/**
 * Reverie callout — an inline notice box for page-level feedback (errors,
 * success notices, usage warnings, AI/info hints). Replaces the ad-hoc
 * `border-<tone>-500/30 bg-<tone>-500/10` boxes that were hand-rolled across
 * screens. Tones: `danger` (blood), `success` (verdant), `warning` (ember),
 * `info` (arcane). Pass `action` for a right-aligned control (e.g. Retry).
 */
import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export type CalloutTone = 'danger' | 'success' | 'warning' | 'info'

interface CalloutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
    tone?: CalloutTone
    /** Leading icon, tinted to the tone (pass an <Icon> — size is yours to set). */
    icon?: ReactNode
    /** Right-aligned slot, e.g. a Retry button. */
    action?: ReactNode
    role?: 'alert' | 'status' | 'note'
}

const TONE: Record<CalloutTone, { box: string; icon: string }> = {
    danger: { box: 'border-blood-500/30 bg-blood-500/10', icon: 'text-blood-300' },
    success: { box: 'border-verdant-500/30 bg-verdant-500/10', icon: 'text-verdant-500' },
    warning: { box: 'border-ember-500/30 bg-ember-500/10', icon: 'text-ember-500' },
    info: { box: 'border-arcane-500/30 bg-arcane-500/10', icon: 'text-arcane-300' },
}

export function Callout({ tone = 'info', icon, action, role, className, children, ...rest }: CalloutProps) {
    return (
        <div
            role={role}
            className={cx(
                'flex gap-3 rounded-lg border px-4 py-3 font-ui text-sm text-parchment-200',
                action ? 'items-center justify-between' : 'items-start',
                TONE[tone].box,
                className,
            )}
            {...rest}
        >
            <div className="flex min-w-0 items-start gap-2.5">
                {icon && (
                    <span className={cx('mt-0.5 shrink-0', TONE[tone].icon)} aria-hidden="true">
                        {icon}
                    </span>
                )}
                <div className="min-w-0">{children}</div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    )
}
