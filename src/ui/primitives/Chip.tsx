/**
 * Reverie filter chip / pill. `active` lights it ember.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    active?: boolean
    icon?: ReactNode
}

export function Chip({ active = false, icon, className, children, type = 'button', ...rest }: ChipProps) {
    return (
        <button
            type={type}
            className={cx(
                'inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium font-ui px-3 py-1.5 rounded-full cursor-pointer transition-all',
                active
                    ? 'bg-ember-500/15 text-ember-300 border border-ember-500/45'
                    : 'bg-ink-600 text-parchment-200 border border-parchment-50/[.08] hover:text-parchment-50 hover:border-parchment-50/20',
                className,
            )}
            {...rest}
        >
            {icon}
            {children}
        </button>
    )
}
