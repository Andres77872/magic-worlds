/**
 * How it works — a calm, three-step explainer of the roleplay loop
 * (choose → set the scene → play it out). A full-bleed void band with
 * arcane-tinted icon tiles, since these describe the AI's part.
 */

import { Eyebrow, IconTile } from '@/ui/primitives'
import { HOW_IT_WORKS_STEPS } from './landingContent'

export function HowItWorksSection() {
    return (
        <section className="w-full border-y border-parchment-50/[.06] bg-ink-900 px-5 py-14 sm:px-8 sm:py-16">
            <div className="mx-auto max-w-[1100px]">
                <div className="mb-10 text-center sm:mb-12">
                    <Eyebrow tone="arcane">How it works</Eyebrow>
                    <h2 className="mt-2.5 font-display text-h1 font-semibold leading-[1.05] text-parchment-50">
                        Three steps into the story.
                    </h2>
                </div>
                <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
                    {HOW_IT_WORKS_STEPS.map((step, i) => (
                        <div
                            key={step.title}
                            className="group relative rounded-xl border border-parchment-50/[.06] bg-ink-700 px-[26px] pb-7 pt-[30px] transition-colors hover:border-arcane-500/30"
                        >
                            <span className="absolute right-6 top-[22px] font-mono text-xs text-parchment-500">
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <IconTile icon={step.icon} tone="arcane" glow className="mb-5" />
                            <h3 className="mb-[9px] font-ui text-[19px] font-semibold tracking-[-0.01em] text-parchment-50">
                                {step.title}
                            </h3>
                            <p className="font-narrative text-[15.5px] leading-[1.55] text-parchment-400">
                                {step.body}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
