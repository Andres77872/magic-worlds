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
 *   page   — viewport-scale ambient pair for the app shell; place inside a
 *            `fixed inset-0` wrapper (AppRouter) so the candlelight belongs to
 *            the app background instead of scrolling — and cropping — with a
 *            section container
 */
import { cx } from './cx'

export type GlowVariant = 'hero' | 'center' | 'header' | 'page'

/* candlelight fills are tokenized in theme.css (--glow-*); the dimmer page
   twins drive the always-on app-shell ambience. */
const EMBER = 'var(--glow-ember-hero)'
const ARCANE = 'var(--glow-arcane-hero)'
const PAGE_EMBER = 'var(--glow-ember-page)'
const PAGE_ARCANE = 'var(--glow-arcane-page)'

interface GlowBackdropProps {
    variant?: GlowVariant
    className?: string
    /** App-shell only: breathe the two `page` blobs on independent long periods
     *  for an organic candlelight. No effect on other variants. */
    animated?: boolean
}

export function GlowBackdrop({ variant = 'hero', className, animated = false }: GlowBackdropProps) {
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
                            'radial-gradient(circle, var(--glow-ember-hero), var(--glow-arcane-faint) 45%, transparent 68%)',
                    }}
                />
            )}
            {variant === 'header' && (
                <div
                    className="absolute -top-28 left-[2%] h-[360px] w-[560px] max-w-full"
                    style={{ background: `radial-gradient(circle, ${EMBER}, transparent 66%)` }}
                />
            )}
            {variant === 'page' && (
                <>
                    {/* Diagonal candlelight wrap: ember warms the top-left, arcane
                        cools the bottom-right, each a full-viewport radial fading
                        toward center. Brightness varies smoothly across the whole
                        viewport — no top-pinned pair, so there's no horizontal fade
                        line that reads as a "cut" while content scrolls under this
                        fixed layer. */}
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `radial-gradient(120% 110% at 0% 0%, ${PAGE_EMBER}, transparent 68%)`,
                            animation: animated ? 'var(--animate-candle-a)' : undefined,
                        }}
                    />
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `radial-gradient(120% 110% at 100% 100%, ${PAGE_ARCANE}, transparent 68%)`,
                            animation: animated ? 'var(--animate-candle-b)' : undefined,
                        }}
                    />
                </>
            )}
        </div>
    )
}
