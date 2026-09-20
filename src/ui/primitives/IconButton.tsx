/**
 * Reverie icon button — square, ghost by default. Pass a lucide glyph as child.
 * `label` sets both aria-label and title. Forwards its ref to the <button>.
 */
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export type IconButtonSize = 'sm' | 'md' | 'lg'
export type IconButtonTone = 'default' | 'active' | 'danger'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
    label: string
    size?: IconButtonSize
    tone?: IconButtonTone
    children: ReactNode
}

// Touch targets occupy real layout space so adjacent actions cannot overlap.
const DIM: Record<IconButtonSize, string> = {
    sm: 'h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11',
    md: 'h-10 w-10 pointer-coarse:h-11 pointer-coarse:w-11',
    lg: 'h-11 w-11',
}

const TONE: Record<IconButtonTone, string> = {
    default: 'text-parchment-200 hover:text-parchment-50 hover:bg-parchment-50/[.05]',
    active: 'text-ember-400 bg-ember-500/15 hover:bg-ember-500/20',
    danger: 'text-parchment-200 hover:text-blood-500 hover:bg-parchment-50/[.05]',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { label, size = 'md', tone = 'default', className, children, type = 'button', ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            aria-label={label}
            title={label}
            className={cx(
                'inline-flex shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                // Preserve caller positioning; conflicting relative/absolute utilities
                // otherwise move search clears and lightbox close controls into the flow.
                !/(?:^|\s)(?:absolute|fixed|sticky|static)(?:\s|$)/.test(className ?? '') && 'relative',
                DIM[size],
                TONE[tone],
                className,
            )}
            {...rest}
        >
            {children}
        </button>
    )
})
