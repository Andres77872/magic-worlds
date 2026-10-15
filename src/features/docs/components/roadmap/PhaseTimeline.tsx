/**
 * An initiative's phases as an ordered list (dependency order, not dates). The
 * active phase carries `aria-current="step"`; every phase states its status in
 * text next to a shape-coded marker, and names the earlier phases it builds on.
 */
import { CornerDownRight } from 'lucide-react'
import { Badge, Icon, cx } from '@/ui/primitives'
import { HighlightText } from '../HighlightText'
import type { RoadmapPhase } from '../roadmapContent'
import { PHASE_META } from './roadmapMeta'

export function PhaseTimeline({ phases, phaseLabel }: { phases: RoadmapPhase[]; phaseLabel: (number: number) => string }) {
    return (
        <ol className="m-0 flex list-none flex-col p-0">
            {phases.map((phase, index) => {
                const meta = PHASE_META[phase.status]
                const last = index === phases.length - 1
                return (
                    <li
                        key={phase.id}
                        aria-current={phase.status === 'current' ? 'step' : undefined}
                        data-phase-status={phase.status}
                        className={cx('relative flex min-w-0 gap-4', !last && 'pb-6')}
                    >
                        {!last && <span aria-hidden className="absolute bottom-0 left-4 top-9 w-px -translate-x-1/2 bg-line" />}
                        <span
                            aria-hidden
                            className={cx(
                                'relative z-[2] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-label font-semibold',
                                meta.marker,
                            )}
                        >
                            {phase.status === 'done' ? <Icon icon={meta.icon} size={16} /> : phase.number}
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-ui text-eyebrow font-semibold uppercase text-fg-subtle">{phaseLabel(phase.number)}</span>
                                <Badge tone={meta.tone} icon={<Icon icon={meta.icon} size={12} />} className="py-0.5">
                                    {phase.statusLabel}
                                </Badge>
                            </div>
                            <p className="m-0 mt-1.5 font-ui text-[15px] font-semibold leading-snug text-fg">
                                <HighlightText text={phase.title} />
                            </p>
                            <p className="m-0 mt-1 max-w-[65ch] font-ui text-body text-fg-muted">
                                <HighlightText text={phase.body} />
                            </p>
                            {phase.dependsLabel && (
                                <p className="m-0 mt-1.5 inline-flex items-center gap-1.5 font-ui text-caption text-fg-subtle">
                                    <Icon icon={CornerDownRight} size={13} />
                                    {phase.dependsLabel}
                                </p>
                            )}
                        </div>
                    </li>
                )
            })}
        </ol>
    )
}
