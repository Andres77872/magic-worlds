/**
 * Landing hero — the marketing front-door for guests and fresh accounts.
 * A candlelit two-column statement: eyebrow + display headline + narrative
 * subtitle + dual CTAs on the left, the tilted preview card on the right.
 * Renders the page's single <h1> in guest mode.
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Avatar, Button, Eyebrow, Icon } from '@/ui/primitives'
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
}

export function LandingHero({ eyebrow, title, subtitle, primary, secondary, stat }: LandingHeroProps) {
    return (
        <section className="relative flex w-full items-center px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:min-h-[600px]">
            {/* Candlelight comes from the app-shell ambience (AppRouter), whose
                ember/arcane pair already washes this top-of-page section. */}
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
                            kind="primary"
                            size="lg"
                            iconLeft={primary.icon ? <Icon icon={primary.icon} size={19} /> : undefined}
                            iconRight={primary.iconRight ? <Icon icon={primary.iconRight} size={18} /> : undefined}
                            onClick={primary.onClick}
                        >
                            {primary.label}
                        </Button>
                        {secondary && (
                            <Button
                                kind="secondary"
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

                {/* right column — the preview card */}
                <div className="flex flex-[0_1_auto] justify-center pt-2.5">
                    <HeroPreviewCard />
                </div>
            </div>
        </section>
    )
}
