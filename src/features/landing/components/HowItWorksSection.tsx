/**
 * How it works — a calm, three-step explainer of the roleplay loop
 * (choose → set the scene → play it out). A full-bleed void band with
 * arcane-tinted icon tiles, since these describe the AI's part.
 */

import { useTranslation } from 'react-i18next'
import { Eyebrow, IconTile } from '@/ui/primitives'
import { HOW_IT_WORKS_STEPS } from './landingContent'

export function HowItWorksSection() {
    const { t } = useTranslation()
    return (
        <section className="w-full border-y border-parchment-50/[.06] bg-ink-900 px-5 py-14 sm:px-8 sm:py-16">
            <div className="mx-auto max-w-[1100px]">
                <div className="mb-10 text-center sm:mb-12">
                    <Eyebrow tone="arcane">{t('landing.steps.eyebrow')}</Eyebrow>
                    <h2 className="mt-2.5 font-display text-h1 font-semibold leading-[1.05] text-parchment-50">
                        {t('landing.steps.title')}
                    </h2>
                </div>
                <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
                    {HOW_IT_WORKS_STEPS.map((step, i) => (
                        <div
                            key={step.titleKey}
                            className="group lift lift-arcane relative overflow-hidden rounded-xl border border-line-faint bg-gradient-to-b from-ink-700 to-ink-800 px-[26px] pb-7 pt-[30px]"
                        >
                            {/* top hairline glint — a faint candlelight catch on the upper edge */}
                            <span
                                aria-hidden
                                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-arcane-500/40 to-transparent"
                            />
                            <span className="absolute right-6 top-[22px] font-mono text-xs text-parchment-500">
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <IconTile icon={step.icon} tone="arcane" glow className="mb-5" />
                            <h3 className="mb-[9px] font-ui text-[19px] font-semibold tracking-[-0.01em] text-parchment-50">
                                {t(step.titleKey)}
                            </h3>
                            <p className="font-narrative text-[15.5px] leading-[1.55] text-parchment-400">
                                {t(step.bodyKey)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
