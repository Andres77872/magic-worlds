/**
 * Reverie button — variants: primary (ember), secondary (outline), ghost,
 * arcane (AI), danger, danger-ghost (quiet destructive). Sizes xs/sm/md/lg (xs only for
 * dense surfaces such as hover-card footers). `variant` is the design-system term for
 * action emphasis (accent-coloured decor uses `tone` instead).
 *
 * `ButtonLink` is the same control as an `<a>`, for actions that navigate (open in a
 * new tab): the browser's own link affordances (middle-click, copy link) keep working.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'arcane' | 'danger' | 'danger-ghost'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonLookProps {
    variant?: ButtonVariant
    size?: ButtonSize
    full?: boolean
    iconLeft?: ReactNode
    iconRight?: ReactNode
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonLookProps {
    /** Anchors a popover or returns focus to the button (React 19 passes `ref` as a prop). */
    ref?: Ref<HTMLButtonElement>
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement>, ButtonLookProps {
    href: string
}

const VARIANT: Record<ButtonVariant, string> = {
    primary:
        'bg-ember-500 text-on-ember border border-transparent hover:bg-ember-400 hover:shadow-glow-ember active:bg-ember-600 active:scale-[.98]',
    secondary:
        'bg-transparent text-fg border border-line-strong hover:border-ember-500/60 hover:bg-parchment-50/[.05] active:scale-[.98]',
    ghost:
        'bg-transparent text-fg-muted border border-transparent hover:text-fg hover:bg-parchment-50/[.05]',
    arcane:
        'bg-arcane-500/15 text-arcane-300 border border-arcane-500/40 hover:bg-arcane-500/25 hover:shadow-glow-arcane active:scale-[.98]',
    danger:
        'bg-blood-500 text-fg border border-transparent hover:brightness-110 active:scale-[.98]',
    // Quiet destructive action — a filled danger button is too loud for a drawer
    // footer or a row action. Mirrors IconButton's `danger` tone. Use this rather
    // than adding text-blood-* on top of `ghost`: cx() is a plain join with no
    // tailwind-merge, so the variant's own text colour wins on source order and
    // the override silently does nothing.
    'danger-ghost':
        'bg-transparent text-blood-300 border border-transparent hover:text-blood-500 hover:bg-blood-500/10',
}

const SIZE: Record<ButtonSize, string> = {
    // Dense surfaces only (hover cards, popover footers): a fixed 28px row.
    xs: 'h-7 text-caption px-2.5 gap-1',
    sm:'text-label px-3.5 py-2 gap-1.5',
    md: 'text-sm px-[18px] py-[11px] gap-2',
    lg: 'text-base px-6 py-3.5 gap-2.5',
}

function buttonClassName(variant: ButtonVariant, size: ButtonSize, full: boolean, className?: string): string {
    return cx(
        'inline-flex items-center justify-center font-ui font-semibold whitespace-nowrap rounded-md cursor-pointer select-none transition-all disabled:opacity-50 disabled:saturate-[.65] disabled:pointer-events-none',
        VARIANT[variant],
        SIZE[size],
        full && 'w-full',
        className,
    )
}

export function Button({
    variant = 'primary',
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
        <button type={type} className={buttonClassName(variant, size, full, className)} {...rest}>
            {iconLeft}
            {children}
            {iconRight}
        </button>
    )
}

export function ButtonLink({
    variant = 'primary',
    size = 'md',
    full = false,
    iconLeft,
    iconRight,
    className,
    children,
    ...rest
}: ButtonLinkProps) {
    return (
        <a className={buttonClassName(variant, size, full, className)} {...rest}>
            {iconLeft}
            {children}
            {iconRight}
        </a>
    )
}
