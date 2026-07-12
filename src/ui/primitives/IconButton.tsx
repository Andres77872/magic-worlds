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

// sm/md stay visually compact, but on coarse pointers (touch) an invisible
// ::after overlay extends the hit area to the 44px minimum target size.
const DIM: Record<IconButtonSize, string> = {
    sm: "h-8 w-8 pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5 pointer-coarse:after:content-['']",
    md: "h-10 w-10 pointer-coarse:after:absolute pointer-coarse:after:-inset-0.5 pointer-coarse:after:content-['']",
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
                'relative inline-flex shrink-0 items-center justify-center rounded-md transition-colors',
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
