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
                <ol className="grid gap-8 lg:grid-cols-3 lg:gap-10">
                    {HOW_IT_WORKS_STEPS.map((step, i) => (
                        <li
                            key={step.titleKey}
                            className="relative border-t border-line-faint pt-6"
                        >
                            <span className="absolute right-0 top-6 font-mono text-xs text-parchment-500">
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <IconTile icon={step.icon} tone="arcane" className="mb-5" />
                            <h3 className="mb-2 font-display text-h3 font-semibold text-parchment-50">
                                {t(step.titleKey)}
                            </h3>
                            <p className="font-narrative text-body text-parchment-400">
                                {t(step.bodyKey)}
                            </p>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    )
}
