/**
 * Two ways to play — the one band that spells out the app's two modes side by
 * side: Adventure (Game Master–led role-play, ember) vs Chat (1:1 conversation,
 * arcane). The tile tones deliberately teach the same color language the
 * ModeBadge uses across cards and shelves.
 */

import { useTranslation } from 'react-i18next'
import { MODE_META, type PlayMode } from '@/shared/modes'
import { Eyebrow, IconTile } from '@/ui/primitives'
import { MODE_EXPLAINER_MODES } from './landingContent'

export function TwoWaysToPlay() {
    const { t } = useTranslation()
    return (
        <section className="w-full px-5 py-14 sm:px-8 sm:py-16">
            <div className="mx-auto max-w-[1100px]">
                <div className="mb-10 text-center sm:mb-12">
                    <Eyebrow tone="ember">{t('landing.modes.eyebrow')}</Eyebrow>
                    <h2 className="mt-2.5 font-display text-h1 font-semibold leading-[1.05] text-parchment-50">
                        {t('landing.modes.title')}
                    </h2>
                </div>
                <div className="grid gap-8 sm:grid-cols-2 sm:gap-10">
                    {MODE_EXPLAINER_MODES.map(({ mode, bodyKey }) => {
                        const meta = MODE_META[mode as PlayMode]
                        return (
                            <article
                                key={mode}
                                className="border-t border-line-faint pt-6"
                            >
                                <IconTile icon={meta.icon} tone={meta.tone} glow className="mb-5" />
                                <h3 className="mb-2 font-ui text-h4 font-semibold text-parchment-50">
                                    {meta.label}
                                </h3>
                                <p className="font-narrative text-body leading-relaxed text-fg-subtle">
                                    {t(bodyKey)}
                                </p>
                            </article>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
