/**
 * Reverie static-image frame — a candlelit illustration in a rounded, optionally
 * tone-ringed frame with a legibility vignette. Use this for STATIC marketing art
 * imported through Vite (e.g. `@/assets/marketing/...`); it renders a plain <img>.
 *
 * It is deliberately NOT `Portrait`/`AuthenticatedImage` — those route `src`
 * through the authenticated-media hook for protected blobs. Static assets must
 * not go through that path.
 */
import type { ReactNode } from 'react'
import { cx } from './cx'

export type IllustrationTone = 'ember' | 'arcane' | 'none'

const RING: Record<IllustrationTone, string> = {
    ember: 'border border-ember-500/30 shadow-glow-ember',
    arcane: 'border border-arcane-500/30 shadow-glow-arcane',
    none: 'border border-parchment-50/[.08]',
}

interface IllustrationProps {
    src: string
    /** Real description for meaningful art; pass '' for purely decorative images. */
    alt: string
    /** Tailwind aspect class, e.g. 'aspect-[16/9]'. Omit to size via className/height. */
    aspect?: string
    /** Dark inner gradient so overlaid text/eyebrows stay legible. */
    vignette?: boolean
    /** Candlelight ring/glow around the frame. */
    ring?: IllustrationTone
    /** Load eagerly (above-the-fold hero). Defaults to lazy. */
    eager?: boolean
    className?: string
    imgClassName?: string
    /** Optional overlay content (badges, captions) stacked above the image. */
    children?: ReactNode
}

export function Illustration({
    src,
    alt,
    aspect,
    vignette = false,
    ring = 'none',
    eager = false,
    className,
    imgClassName,
    children,
}: IllustrationProps) {
    const decorative = alt === ''
    return (
        <div className={cx('relative overflow-hidden rounded-xl', RING[ring], aspect, className)}>
            <img
                src={src}
                alt={alt}
                aria-hidden={decorative || undefined}
                loading={eager ? 'eager' : 'lazy'}
                decoding="async"
                className={cx('absolute inset-0 h-full w-full object-cover', imgClassName)}
            />
            {vignette && (
                <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/35 to-transparent"
                    aria-hidden
                />
            )}
            {children}
        </div>
    )
}
