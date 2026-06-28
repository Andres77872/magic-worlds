/**
 * HeroScene — the dashboard's cinematic opener. In `continue` mode it is the
 * resume CTA for the freshest session; in `begin` mode it spotlights the
 * featured adventure template. Real artwork bleeds across the band (blurred
 * wash + sharp right edge feathered into the ink); cards without art keep the
 * warm seeded gradient + giant monogram language from the old FeaturedScene.
 */

import type { LucideIcon } from 'lucide-react'
import { useAuthenticatedMediaUrl } from '@/infrastructure/api/useAuthenticatedMediaUrl'
import { Badge, Button, Eyebrow, Icon, cx, gradientFor } from '@/ui/primitives'

export interface HeroSceneCta {
    label: string
    icon?: LucideIcon
    onClick: () => void
}

export interface HeroSceneProps {
    mode: 'continue' | 'begin'
    eyebrow: string
    title: string
    /** Begin-mode blurb (scenario opening). */
    description?: string
    /** Continue-mode last-turn line — rendered as an italic narrative quote. */
    snippet?: string
    /** Raw media URL — resolved + auth-fetched internally. */
    imageUrl?: string | null
    /** Seed for the fallback gradient (usually the title). */
    seed: string
    monogram: string
    tags?: string[]
    /** Mono meta line, e.g. "14 turns · 2 hr. ago". */
    meta?: string
    primary: HeroSceneCta
    secondary?: HeroSceneCta
}

export function HeroScene({
    mode,
    eyebrow,
    title,
    description,
    snippet,
    imageUrl,
    seed,
    monogram,
    tags = [],
    meta,
    primary,
    secondary,
}: HeroSceneProps) {
    const media = useAuthenticatedMediaUrl(imageUrl ?? undefined, 'image/*')
    const imageSrc = media.error ? undefined : media.src
    const hasImage = Boolean(imageSrc)
    const blurb =
        mode === 'begin'
            ? description?.trim() || 'An untold scene, waiting for its first line. Step in and begin.'
            : undefined

    return (
        <section
            className="relative flex min-h-[340px] rounded-2xl border border-parchment-50/10 shadow-xl sm:min-h-[420px]"
            data-testid="hero-scene"
        >
            {/* Decorative layers self-clip to the rounded card, so the section
                itself stays overflow-visible and never cuts the button's glow. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
                {hasImage ? (
                    <>
                        {/* The artwork soaks the whole canvas… */}
                        <img
                            src={imageSrc}
                            alt=""
                            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
                        />
                        {/* …and stands sharp on the right, feathered into the ink. */}
                        <img
                            src={imageSrc}
                            alt=""
                            className="absolute inset-y-0 right-0 h-full w-[72%] object-cover [mask-image:linear-gradient(90deg,transparent,black_30%)] sm:w-[62%]"
                        />
                    </>
                ) : (
                    <div
                        className={cx('absolute inset-0', media.loading && 'image-shimmer')}
                        style={media.loading ? undefined : { background: gradientFor(seed) }}
                    />
                )}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(95deg, rgba(14,12,20,.92) 0%, rgba(14,12,20,.62) 46%, rgba(14,12,20,.10) 100%)',
                    }}
                />
                <div
                    className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-ink-900/50"
                />
                {!hasImage && !media.loading && (
                    <span
                        className="absolute right-2 top-1/2 -translate-y-1/2 select-none font-display font-semibold leading-none text-parchment-50/10 sm:right-10"
                        style={{ fontSize: 'clamp(160px, 24vw, 300px)' }}
                    >
                        {monogram}
                    </span>
                )}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-parchment-50/[.06]" />
            </div>

            <div className="relative z-[1] flex flex-col justify-center gap-4 p-7 max-md:max-w-full sm:p-12 md:max-w-[62%]">
                <Eyebrow tone="ember">{eyebrow}</Eyebrow>
                <h2 className="m-0 font-display text-[clamp(38px,5vw,62px)] font-semibold leading-[1.02] tracking-tight text-parchment-50">
                    {title}
                </h2>
                {snippet ? (
                    <p className="m-0 line-clamp-2 max-w-[52ch] font-narrative text-narrative italic leading-relaxed text-parchment-200">
                        {snippet}
                    </p>
                ) : (
                    blurb && (
                        <p className="m-0 line-clamp-2 max-w-[52ch] font-narrative text-narrative leading-relaxed text-parchment-200">
                            {blurb}
                        </p>
                    )
                )}
                {meta && <p className="m-0 font-mono text-[12px] tracking-wide text-parchment-300">{meta}</p>}
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {tags.slice(0, 4).map((tag) => (
                            <Badge key={tag} tone="glass">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button
                        variant="primary"
                        size="lg"
                        iconLeft={primary.icon ? <Icon icon={primary.icon} size={18} /> : undefined}
                        onClick={primary.onClick}
                    >
                        {primary.label}
                    </Button>
                    {secondary && (
                        <Button variant="secondary" onClick={secondary.onClick}>
                            {secondary.label}
                        </Button>
                    )}
                </div>
            </div>
        </section>
    )
}
