/**
 * Featured hero — the spotlight scene atop the gallery. A warm seeded gradient
 * with a giant faded monogram and a single primary action ("Begin a scene").
 */

import type { LucideIcon } from 'lucide-react'
import { Wand2 } from 'lucide-react'
import { Button, Eyebrow, Icon, gradientFor } from '@/ui/primitives'

export interface FeaturedSceneProps {
    eyebrow: string
    title: string
    description: string
    monogram: string
    /** Seed for the deterministic gradient (usually the title). */
    seed: string
    actionLabel: string
    onAction: () => void
    actionIcon?: LucideIcon
}

export function FeaturedScene({
    eyebrow,
    title,
    description,
    monogram,
    seed,
    actionLabel,
    onAction,
    actionIcon = Wand2,
}: FeaturedSceneProps) {
    return (
        <section className="relative overflow-hidden rounded-2xl border border-parchment-50/[.08] shadow-lg">
            <div className="absolute inset-0" style={{ background: gradientFor(seed) }} aria-hidden="true" />
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'linear-gradient(95deg, rgba(14,12,20,.88) 0%, rgba(14,12,20,.62) 42%, rgba(14,12,20,.12) 100%)',
                }}
                aria-hidden="true"
            />
            <span
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 select-none font-display font-semibold leading-none text-parchment-50/10 sm:right-10"
                style={{ fontSize: 'clamp(140px, 22vw, 260px)' }}
                aria-hidden="true"
            >
                {monogram}
            </span>

            <div className="relative z-[1] flex flex-col gap-4 p-7 sm:p-10 md:max-w-[64%]">
                <Eyebrow>{eyebrow}</Eyebrow>
                <h2 className="font-display text-[clamp(34px,4.5vw,54px)] font-semibold leading-[1.04] tracking-tight text-parchment-50">
                    {title}
                </h2>
                <p className="line-clamp-2 max-w-[54ch] font-narrative text-narrative leading-relaxed text-parchment-200">
                    {description}
                </p>
                <div className="pt-1">
                    <Button kind="primary" iconLeft={<Icon icon={actionIcon} size={16} />} onClick={onAction}>
                        {actionLabel}
                    </Button>
                </div>
            </div>
        </section>
    )
}
