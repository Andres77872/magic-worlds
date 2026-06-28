/**
 * Two ways to play — the one band that spells out the app's two modes side by
 * side: Adventure (Game Master–led role-play, ember) vs Chat (1:1 conversation,
 * arcane). The tile tones deliberately teach the same color language the
 * ModeBadge uses across cards and shelves.
 */

import { useTranslation } from 'react-i18next'
import { MODE_META, type PlayMode } from '@/shared/modes'
import { Eyebrow, IconTile, cx } from '@/ui/primitives'
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
                <div className="grid gap-[22px] sm:grid-cols-2">
                    {MODE_EXPLAINER_MODES.map(({ mode, bodyKey }) => {
                        const meta = MODE_META[mode as PlayMode]
                        const isArcane = meta.tone === 'arcane'
                        const glint = isArcane ? 'via-arcane-500/40' : 'via-ember-500/40'
                        return (
                            <div
                                key={mode}
                                className={cx(
                                    'group lift relative overflow-hidden rounded-xl border border-line-faint bg-gradient-to-b from-ink-700 to-ink-800 px-[26px] pb-7 pt-[30px]',
                                    isArcane && 'lift-arcane',
                                )}
                            >
                                <span
                                    aria-hidden
                                    className={cx(
                                        'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent',
                                        glint,
                                    )}
                                />
                                <IconTile icon={meta.icon} tone={meta.tone} glow className="mb-5" />
                                <h3 className="mb-[9px] font-ui text-[19px] font-semibold tracking-[-0.01em] text-parchment-50">
                                    {meta.label}
                                </h3>
                                <p className="font-narrative text-[15.5px] leading-[1.55] text-parchment-400">
                                    {t(bodyKey)}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
