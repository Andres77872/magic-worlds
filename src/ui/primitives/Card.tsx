/**
 * Reverie surface card. `interactive` adds the candlelight hover-lift + glow.
 */
import type { HTMLAttributes } from 'react'
import { cx } from './cx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    interactive?: boolean
}

export function Card({ interactive = false, className, children, ...rest }: CardProps) {
    return (
        <div
            className={cx(
                'rounded-xl bg-ink-700 border border-parchment-50/[.08] shadow-md overflow-hidden transition-all',
                interactive &&
                    'cursor-pointer hover:-translate-y-[3px] hover:border-ember-500/45 hover:shadow-card-hover',
                className,
            )}
            {...rest}
        >
            {children}
        </div>
    )
}
