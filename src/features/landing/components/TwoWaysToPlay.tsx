/**
 * Two ways to play — the one band that spells out the app's two modes side by
 * side: Adventure (Game Master–led role-play, ember) vs Chat (1:1 conversation,
 * arcane). The tile tones deliberately teach the same color language the
 * ModeBadge uses across cards and shelves.
 */

import { MODE_META, type PlayMode } from '@/shared/modes'
import { Eyebrow, IconTile } from '@/ui/primitives'
import { MODE_EXPLAINER } from './landingContent'

export function TwoWaysToPlay() {
    return (
        <section className="w-full px-5 py-14 sm:px-8 sm:py-16">
            <div className="mx-auto max-w-[1100px]">
                <div className="mb-10 text-center sm:mb-12">
                    <Eyebrow tone="ember">{MODE_EXPLAINER.eyebrow}</Eyebrow>
                    <h2 className="mt-2.5 font-display text-h1 font-semibold leading-[1.05] text-parchment-50">
                        {MODE_EXPLAINER.title}
                    </h2>
                </div>
                <div className="grid gap-[22px] sm:grid-cols-2">
                    {MODE_EXPLAINER.modes.map(({ mode, body }) => {
                        const meta = MODE_META[mode as PlayMode]
                        const hover = meta.tone === 'ember' ? 'hover:border-ember-500/30' : 'hover:border-arcane-500/30'
                        return (
                            <div
                                key={mode}
                                className={`rounded-xl border border-parchment-50/[.06] bg-ink-700 px-[26px] pb-7 pt-[30px] transition-colors ${hover}`}
                            >
                                <IconTile icon={meta.icon} tone={meta.tone} glow className="mb-5" />
                                <h3 className="mb-[9px] font-ui text-[19px] font-semibold tracking-[-0.01em] text-parchment-50">
                                    {meta.label}
                                </h3>
                                <p className="font-narrative text-[15.5px] leading-[1.55] text-parchment-400">
                                    {body}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
