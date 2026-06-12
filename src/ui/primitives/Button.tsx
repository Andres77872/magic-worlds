/**
 * Reverie button — kinds: primary (ember), secondary (outline), ghost,
 * arcane (AI), danger. Sizes sm/md/lg. Mirrors ui_kits/app/components.jsx.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'arcane' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    kind?: ButtonKind
    size?: ButtonSize
    full?: boolean
    iconLeft?: ReactNode
    iconRight?: ReactNode
}

const KIND: Record<ButtonKind, string> = {
    primary:
        'bg-ember-500 text-on-ember border border-transparent hover:bg-ember-400 hover:shadow-glow-ember active:bg-ember-600 active:scale-[.98]',
    secondary:
        'bg-transparent text-parchment-50 border border-parchment-50/22 hover:border-ember-500/60 hover:bg-parchment-50/[.05] active:scale-[.98]',
    ghost:
        'bg-transparent text-parchment-200 border border-transparent hover:text-parchment-50 hover:bg-parchment-50/[.05]',
    arcane:
        'bg-arcane-500/15 text-arcane-300 border border-arcane-500/40 hover:bg-arcane-500/25 hover:shadow-glow-arcane active:scale-[.98]',
    danger:
        'bg-blood-500 text-parchment-50 border border-transparent hover:brightness-110 active:scale-[.98]',
}

const SIZE: Record<ButtonSize, string> = {
    sm: 'text-[13px] px-3.5 py-2 gap-1.5',
    md: 'text-sm px-[18px] py-[11px] gap-2',
    lg: 'text-base px-6 py-3.5 gap-2.5',
}

export function Button({
    kind = 'primary',
    size = 'md',
    full = false,
    iconLeft,
    iconRight,
    className,
    children,
    type = 'button',
    ...rest
}: ButtonProps) {
    return (
        <button
            type={type}
            className={cx(
                'inline-flex items-center justify-center font-ui font-semibold whitespace-nowrap rounded-md cursor-pointer select-none transition-all disabled:opacity-50 disabled:pointer-events-none',
                KIND[kind],
                SIZE[size],
                full && 'w-full',
                className,
            )}
            {...rest}
        >
            {iconLeft}
            {children}
            {iconRight}
        </button>
    )
}
