/**
 * Reverie character portrait frame — faint display initial on a warm gradient
 * (or image), with a bottom vignette so overlaid text/badges stay legible.
 * Mirrors ui_kits/app/components.jsx `Portrait`.
 */
import type { ReactNode } from 'react'
import { cx } from './cx'
import { gradientFor } from './gradient'

interface PortraitProps {
    name?: string
    src?: string | null
    /** Pixel height, or any CSS height (e.g. 'auto' with an aspect-ratio class). */
    height?: number | string
    gradient?: string
    className?: string
    children?: ReactNode
}

export function Portrait({ name = '', src, height = 160, gradient, className, children }: PortraitProps) {
    const initial = name.trim().charAt(0).toUpperCase() || '?'
    return (
        <div
            className={cx('relative flex items-center justify-center overflow-hidden', className)}
            style={{ height, background: src ? undefined : gradient || gradientFor(name || 'reverie') }}
        >
            {src && <img src={src} alt={name} className="absolute inset-0 h-full w-full object-cover" />}
            <span
                className="font-display font-semibold leading-none text-parchment-50/20"
                style={{ fontSize: typeof height === 'number' ? Math.round(height * 0.42) : 64 }}
            >
                {initial}
            </span>
            <div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'linear-gradient(180deg, transparent 38%, rgba(20,17,28,.82))' }}
            />
            {children}
        </div>
    )
}
