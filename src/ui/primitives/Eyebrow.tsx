/**
 * Reverie eyebrow — uppercase tracked label (kit `.t-eyebrow`).
 */
import type { HTMLAttributes } from 'react'
import { cx } from './cx'

interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
    tone?: 'ember' | 'arcane' | 'muted'
}

const TONE = {
    ember: 'text-ember-500',
    arcane: 'text-arcane-300',
    muted: 'text-parchment-400',
} as const

export function Eyebrow({ tone = 'ember', className, children, ...rest }: EyebrowProps) {
    return (
        <span
            className={cx('font-ui text-eyebrow font-semibold uppercase', TONE[tone], className)}
            {...rest}
        >
            {children}
        </span>
    )
}
