/**
 * Reverie surface card. `interactive` adds the candlelight hover-lift + glow.
 */
import { forwardRef, type HTMLAttributes } from 'react'
import { cx } from './cx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    interactive?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
    { interactive = false, className, children, ...rest },
    ref,
) {
    return (
        <div
            ref={ref}
            className={cx(
                'rounded-xl bg-surface-raised border border-line-faint overflow-hidden',
                // `.lift` centralizes the candlelit hover (rise + warm hairline +
                // glow) shared by every interactive surface; non-interactive cards
                // keep a plain transition.
                interactive ? 'lift cursor-pointer shadow-sm' : 'transition-colors',
                className,
            )}
            {...rest}
        >
            {children}
        </div>
    )
})
