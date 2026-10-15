/**
 * The status legend doubles as the filter: each toggle shows the status shape,
 * label, count and a one-line definition. Toggle buttons (`aria-pressed`), so
 * the current filter is announced without a separate listbox.
 */
import type { ReactNode } from 'react'
import { LayoutGrid } from 'lucide-react'
import { Icon, cx } from '@/ui/primitives'
import type { DocsRoadmap, RoadmapStage } from '../roadmapContent'
import { ROADMAP_STAGES } from '../roadmapContent'
import { STAGE_META } from './roadmapMeta'

interface StageFilterProps {
    roadmap: DocsRoadmap
    counts: Record<RoadmapStage, number>
    total: number
    value: RoadmapStage | 'all'
    onChange: (value: RoadmapStage | 'all') => void
}

export function StageFilter({ roadmap, counts, total, value, onChange }: StageFilterProps) {
    return (
        <div role="group" aria-label={roadmap.labels.filter} className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <FilterToggle
                pressed={value === 'all'}
                onClick={() => onChange('all')}
                icon={<Icon icon={LayoutGrid} size={16} />}
                iconClass="text-fg-muted"
                label={roadmap.labels.all}
                description={roadmap.labels.allDescription}
                count={total}
            />
            {ROADMAP_STAGES.map((stage) => {
                const meta = STAGE_META[stage]
                return (
                    <FilterToggle
                        key={stage}
                        pressed={value === stage}
                        disabled={counts[stage] === 0 && value !== stage}
                        onClick={() => onChange(value === stage ? 'all' : stage)}
                        icon={<Icon icon={meta.icon} size={16} />}
                        iconClass={meta.text}
                        label={roadmap.stages[stage].label}
                        description={roadmap.stages[stage].description}
                        count={counts[stage]}
                    />
                )
            })}
        </div>
    )
}

function FilterToggle({
    pressed,
    disabled,
    onClick,
    icon,
    iconClass,
    label,
    description,
    count,
}: {
    pressed: boolean
    disabled?: boolean
    onClick: () => void
    icon: ReactNode
    iconClass: string
    label: string
    description?: string
    count: number
}) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={onClick}
            className={cx(
                'flex min-h-11 min-w-0 flex-col gap-1 rounded-lg border px-3 py-2.5 text-left font-ui transition-all disabled:cursor-not-allowed disabled:opacity-45',
                pressed
                    ? 'border-ember-500/50 bg-ember-500/10 shadow-[inset_0_0_0_1px_var(--color-ember-500)]'
                    : 'border-line-faint bg-surface-raised hover:border-line-strong hover:bg-ink-600/60',
            )}
        >
            <span className="flex w-full items-center gap-2">
                <span className={cx('shrink-0', iconClass)}>{icon}</span>
                <span className="min-w-0 flex-1 truncate text-label font-semibold text-fg">{label}</span>
                <span className="font-mono text-label font-semibold tabular-nums text-fg-muted">{count}</span>
            </span>
            {description && <span className="text-caption leading-snug text-fg-subtle">{description}</span>}
        </button>
    )
}
