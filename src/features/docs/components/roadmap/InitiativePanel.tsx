/**
 * A featured initiative: what exists today, kept apart from the ordered phases
 * that come next, plus an explicit scope line. The panel is a size container,
 * so its inner layout responds to the room it actually has (two columns when
 * stacked full-width, one when two panels sit side by side).
 */
import { Check, Info } from 'lucide-react'
import { Icon, IconTile, cx } from '@/ui/primitives'
import { HighlightText } from '../HighlightText'
import type { RoadmapInitiative } from '../roadmapContent'
import { PhaseTimeline } from './PhaseTimeline'
import { StageBadge } from './StageBadge'
import { INITIATIVE_ANCHORS } from './roadmapMeta'

interface InitiativePanelProps {
    initiative: RoadmapInitiative
    stageLabel: string
    /** `builtSoFar` replaces `today` while this version keeps the initiative off. */
    labels: { today: string; builtSoFar: string; coming: string; scope: string }
    phaseLabel: (number: number) => string
    hidden?: boolean
}

export function InitiativePanel({ initiative, stageLabel, labels, phaseLabel, hidden }: InitiativePanelProps) {
    const anchor = INITIATIVE_ANCHORS[initiative.id]
    const headingId = `${anchor}-title`
    // Off in this version: what exists is built, not something readers can use today.
    const builtOnly = initiative.stage === 'off'
    return (
        <article
            id={anchor}
            aria-labelledby={headingId}
            hidden={hidden}
            data-initiative={initiative.id}
            className="@container relative min-w-0 scroll-mt-8 overflow-hidden rounded-2xl border border-line-faint bg-surface-raised shadow-sm"
        >
            <header className="relative overflow-hidden border-b border-line-faint p-5 sm:p-6">
                {initiative.art && (
                    <>
                        <img src={initiative.art} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-[.18]" />
                        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-700 via-ink-700/90 to-ink-700/55" />
                    </>
                )}
                <div className="relative flex min-w-0 flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <IconTile icon={initiative.icon} tone="arcane" size="md" />
                        <div className="min-w-0 flex-1">
                            <h3 id={headingId} tabIndex={-1} className="m-0 font-display text-h3 font-semibold leading-tight text-fg">
                                <HighlightText text={initiative.title} />
                            </h3>
                            <p className="m-0 mt-0.5 font-mono text-caption text-fg-subtle">{initiative.progress}</p>
                        </div>
                        <StageBadge stage={initiative.stage} label={stageLabel} />
                    </div>
                    <p className="m-0 max-w-[68ch] font-narrative text-[16px] leading-relaxed text-fg-muted">
                        <HighlightText text={initiative.tagline} />
                    </p>
                </div>
            </header>

            <div className="grid min-w-0 gap-6 p-5 sm:p-6 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @3xl:gap-8">
                <section aria-labelledby={`${anchor}-today`} className="min-w-0">
                    <h4
                        id={`${anchor}-today`}
                        className={cx('m-0 mb-3 font-ui text-eyebrow font-semibold uppercase', builtOnly ? 'text-amber-500' : 'text-verdant-500')}
                    >
                        {builtOnly ? labels.builtSoFar : labels.today}
                    </h4>
                    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                        {initiative.today.map((entry) => (
                            <li key={entry} className="flex gap-2.5 font-ui text-body text-fg-muted">
                                <span
                                    className={cx(
                                        'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                                        builtOnly ? 'bg-ink-600 text-fg-muted' : 'bg-verdant-500/15 text-verdant-500',
                                    )}
                                >
                                    <Icon icon={Check} size={12} />
                                </span>
                                <span className="min-w-0">
                                    <HighlightText text={entry} />
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="m-0 mt-5 flex gap-2.5 rounded-lg border border-line-faint bg-surface-sunken/60 p-3 font-ui text-caption leading-relaxed text-fg-subtle">
                        <Icon icon={Info} size={14} className="mt-px shrink-0 text-fg-subtle" />
                        <span>
                            <span className="font-semibold text-fg-muted">{labels.scope}: </span>
                            <HighlightText text={initiative.scope} />
                        </span>
                    </p>
                </section>

                <section aria-labelledby={`${anchor}-coming`} className="min-w-0 border-t border-line-faint pt-6 @3xl:border-l @3xl:border-t-0 @3xl:pl-8 @3xl:pt-0">
                    <h4 id={`${anchor}-coming`} className="m-0 mb-4 font-ui text-eyebrow font-semibold uppercase text-ember-300">
                        {labels.coming}
                    </h4>
                    <PhaseTimeline phases={initiative.phases} phaseLabel={phaseLabel} />
                </section>
            </div>
        </article>
    )
}
