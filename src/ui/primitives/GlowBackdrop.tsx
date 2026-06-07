/**
 * Reverie candlelight backdrop — soft, decorative radial glows that sit behind a
 * section. It clips *itself* (an absolute, inset-0, overflow-hidden layer), so
 * the parent only needs `position: relative` — it must NOT add `overflow-hidden`
 * of its own, or it would also clip the hover-glows / focus-rings of real
 * children. Place it as the first child and give later content `relative`.
 *
 * Extracted from the inline glow `<div>`s in LandingHero / ClosingCTA so the same
 * warmth can sit behind the dashboard greeting and the creation studio header.
 *
 *   hero   — dual ember + arcane wash (left/right), for tall two-column heroes
 *   center — one combined ember→arcane bloom centered, for closing CTAs
 *   header — a single, smaller ember glow for page-header mastheads
 */
import { cx } from './cx'

export type GlowVariant = 'hero' | 'center' | 'header'

const EMBER = 'rgba(232,162,74,.16)'
const ARCANE = 'rgba(143,111,227,.18)'

interface GlowBackdropProps {
    variant?: GlowVariant
    className?: string
}

export function GlowBackdrop({ variant = 'hero', className }: GlowBackdropProps) {
    return (
        <div aria-hidden className={cx('pointer-events-none absolute inset-0 overflow-hidden', className)}>
            {variant === 'hero' && (
                <>
                    <div
                        className="absolute -top-40 left-[6%] h-[520px] w-[620px] max-w-full"
                        style={{ background: `radial-gradient(circle, ${EMBER}, transparent 65%)` }}
                    />
                    <div
                        className="absolute top-10 right-[2%] h-[560px] w-[640px] max-w-full"
                        style={{ background: `radial-gradient(circle, ${ARCANE}, transparent 62%)` }}
                    />
                </>
            )}
            {variant === 'center' && (
                <div
                    className="absolute left-1/2 top-1/2 h-[520px] w-[760px] max-w-full -translate-x-1/2 -translate-y-1/2"
                    style={{
                        background:
                            'radial-gradient(circle, rgba(232,162,74,.18), rgba(143,111,227,.10) 45%, transparent 68%)',
                    }}
                />
            )}
            {variant === 'header' && (
                <div
                    className="absolute -top-28 left-[2%] h-[360px] w-[560px] max-w-full"
                    style={{ background: `radial-gradient(circle, ${EMBER}, transparent 66%)` }}
                />
            )}
        </div>
    )
}
