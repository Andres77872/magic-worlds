/**
 * Landing hero — the marketing front-door for guests and fresh accounts.
 * A candlelit two-column statement: eyebrow + display headline + narrative
 * subtitle + dual CTAs on the left, the tilted preview card on the right.
 * Renders the page's single <h1> in guest mode.
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Brain } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar, Badge, Button, Eyebrow, GlowBackdrop, Icon, Illustration } from '@/ui/primitives'
import { HeroPreviewCard } from './HeroPreviewCard'
import { SHOWCASE_WORLDS } from './landingContent'

export interface HeroCta {
    label: string
    icon?: LucideIcon
    iconRight?: LucideIcon
    onClick: () => void
}

export interface LandingHeroProps {
    eyebrow: string
    title: ReactNode
    subtitle: string
    primary: HeroCta
    secondary?: HeroCta
    /** Honest caption beside the sample-world avatar stack. */
    stat?: ReactNode
    /** Candlelit marketing art for the right column (guest front-door). */
    heroImage?: { src: string; alt: string }
}

export function LandingHero({ eyebrow, title, subtitle, primary, secondary, stat, heroImage }: LandingHeroProps) {
    const { t } = useTranslation()
    const lead = SHOWCASE_WORLDS[0]
    return (
        <section className="relative flex w-full items-center overflow-hidden px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:min-h-[640px]">
            {/* Candlelit ambience: the app-shell pair is faint by design, so the
                front-door hero owns a brighter ember+arcane bloom of its own. */}
            <GlowBackdrop variant="hero" />
            {/* A dim, blurred wash of the hero art deepens the canvas behind the
                copy without fighting it; the sharp framed art lives on the right. */}
            {heroImage && (
                <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden>
                    <img
                        src={heroImage.src}
                        alt=""
                        aria-hidden
                        className="h-full w-full scale-105 object-cover opacity-[.14] blur-[6px]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/80 to-ink-900/40" />
                    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink-900" />
                </div>
            )}
            <div className="relative mx-auto flex w-full max-w-[1160px] flex-wrap items-center gap-x-14 gap-y-12">
                {/* left column */}
                <div className="flex-[1_1_460px] [min-width:min(320px,100%)]">
                    <Eyebrow tone="ember">{eyebrow}</Eyebrow>
                    <h1 className="mt-4 font-display text-display font-semibold leading-[1.02] tracking-[-0.01em] text-parchment-50">
                        {title}
                    </h1>
                    <p className="mb-8 mt-[22px] max-w-[480px] font-narrative text-[19px] leading-[1.55] text-parchment-200">
                        {subtitle}
                    </p>

                    <div className="flex flex-wrap items-center gap-3.5">
                        <Button
                            variant="primary"
                            size="lg"
                            iconLeft={primary.icon ? <Icon icon={primary.icon} size={19} /> : undefined}
                            iconRight={primary.iconRight ? <Icon icon={primary.iconRight} size={18} /> : undefined}
                            onClick={primary.onClick}
                        >
                            {primary.label}
                        </Button>
                        {secondary && (
                            <Button
                                variant="secondary"
                                size="lg"
                                iconLeft={secondary.icon ? <Icon icon={secondary.icon} size={19} /> : undefined}
                                iconRight={
                                    secondary.iconRight ? <Icon icon={secondary.iconRight} size={18} /> : undefined
                                }
                                onClick={secondary.onClick}
                            >
                                {secondary.label}
                            </Button>
                        )}
                    </div>

                    {stat && (
                        <div className="mt-[34px] flex items-center gap-3.5">
                            <div className="flex">
                                {SHOWCASE_WORLDS.slice(0, 5).map((world, i) => (
                                    <Avatar
                                        key={world.id}
                                        name={world.name}
                                        initial={world.initial}
                                        gradient={world.portrait}
                                        size={36}
                                        className={i > 0 ? '-ml-[11px] border-2 border-ink-800' : 'border-2 border-ink-800'}
                                    />
                                ))}
                            </div>
                            <span className="max-w-[260px] font-ui text-[13.5px] leading-snug text-parchment-400">
                                {stat}
                            </span>
                        </div>
                    )}
                </div>

                {/* right column — candlelit hero art (guest), else the preview card */}
                <div className="flex flex-[1_1_440px] justify-center pt-2.5 lg:justify-end">
                    {heroImage ? (
                        <div className="relative -rotate-[1.4deg]">
                            {/* warm halo: an ember bloom radiates from behind the
                                frame so the art reads as the page's light source. */}
                            <div
                                aria-hidden
                                className="pointer-events-none absolute -inset-10 -z-10 rounded-[36px]"
                                style={{
                                    background:
                                        'radial-gradient(58% 58% at 52% 42%, var(--glow-ember-hero), var(--glow-arcane-faint) 60%, transparent 76%)',
                                }}
                            />
                            <Illustration
                                src={heroImage.src}
                                alt={heroImage.alt}
                                eager
                                ring="ember"
                                aspect="aspect-[4/3]"
                                className="w-[min(560px,92vw)] rounded-2xl shadow-glow-ember-strong"
                                imgClassName="scale-[1.02] brightness-[1.08] saturate-[1.06]"
                            >
                                {/* feather the lower edge so the floating chip stays legible */}
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-900/85 via-ink-900/20 to-transparent"
                                />
                                {/* floating memory chip — the product promise in one glance */}
                                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2.5 rounded-xl border border-parchment-50/10 bg-ink-900/70 px-3 py-2.5 backdrop-blur-md">
                                    <Avatar
                                        name={lead.name}
                                        initial={lead.initial}
                                        gradient={lead.portrait}
                                        size={34}
                                        ring="arcane"
                                        status="think"
                                    />
                                    <div className="min-w-0">
                                        <div className="truncate font-display text-[15px] font-semibold leading-tight text-parchment-50">
                                            {lead.name}
                                        </div>
                                        <div className="truncate font-ui text-[11px] leading-tight text-parchment-400">
                                            {lead.world}
                                        </div>
                                    </div>
                                    <Badge tone="arcane" className="ml-auto shrink-0" icon={<Icon icon={Brain} size={12} />}>
                                        {t('landing.preview.remembers')}
                                    </Badge>
                                </div>
                            </Illustration>
                        </div>
                    ) : (
                        <HeroPreviewCard />
                    )}
                </div>
            </div>
        </section>
    )
}
