/**
 * Reverie static tag pill (non-interactive; use Chip for filters).
 */
import type { HTMLAttributes } from 'react'
import { cx } from './cx'

export function Tag({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            className={cx(
                'inline-flex items-center rounded-full bg-ink-600 px-2.5 py-[3px] font-ui text-[11px] font-semibold text-parchment-200',
                className,
            )}
            {...rest}
        >
            {children}
        </span>
    )
}
