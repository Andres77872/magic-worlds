/**
 * CastMemberCard — a rich, selectable row for picking cast / persona / world in
 * the adventure scene-builder. A keyboard-accessible button (aria-pressed) with
 * a candlelight hover-lift and an ember ring when selected. Also exports the
 * shared row styling, a "None" option, and a loading row used by the selectors.
 */

import type { ReactNode } from 'react'
import { Ban, CheckCircle2, Circle, Square } from 'lucide-react'
import { Avatar, Icon, Tag, cx } from '@/ui/primitives'

/** Shared visual for a selectable row (used by CastMemberCard and NoneOption). */
const selectableRowClass = (selected: boolean) =>
    cx(
        'flex w-full gap-3 rounded-xl border bg-ink-700 p-3 text-left transition-all hover:-translate-y-[1px]',
        selected
            ? 'border-ember-500/60 ring-1 ring-ember-500/45'
            : 'border-parchment-50/[.08] hover:border-ember-500/45',
    )

export interface CastMemberCardProps {
    name: string
    /** Character race or world type — shown as a Tag. */
    race?: string
    description?: string
    selected: boolean
    mode: 'check' | 'radio'
    onToggle: () => void
    /** Optional trailing badge, e.g. a "You" marker for the persona. */
    badge?: ReactNode
}

export function CastMemberCard({ name, race, description, selected, mode, onToggle, badge }: CastMemberCardProps) {
    return (
        <button type="button" onClick={onToggle} aria-pressed={selected} className={cx(selectableRowClass(selected), 'items-start')}>
            <Avatar name={name} size={40} ring={selected ? 'ember' : 'none'} />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate font-display text-[15px] font-semibold text-parchment-50">{name}</span>
                    {race && <Tag className="capitalize">{race}</Tag>}
                    {badge}
                </div>
                {description && (
                    <p className="mt-0.5 line-clamp-2 font-narrative text-xs leading-snug text-parchment-400">{description}</p>
                )}
            </div>
            <Icon
                icon={selected ? CheckCircle2 : mode === 'radio' ? Circle : Square}
                size={18}
                className={cx('mt-0.5 shrink-0', selected ? 'text-ember-400' : 'text-parchment-400')}
            />
        </button>
    )
}

/** A "None" row for the single-select persona / world lists. */
export function NoneOption({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
    return (
        <button type="button" onClick={onSelect} aria-pressed={selected} className={cx(selectableRowClass(selected), 'items-center')}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-600 text-parchment-400">
                <Icon icon={Ban} size={18} />
            </span>
            <span className="flex-1 font-ui text-[14px] font-medium text-parchment-200">{label}</span>
            <Icon
                icon={selected ? CheckCircle2 : Circle}
                size={18}
                className={cx('shrink-0', selected ? 'text-ember-400' : 'text-parchment-400')}
            />
        </button>
    )
}

/** Lightweight loading row shown while the library is still loading. */
export function SelectorLoading({ text }: { text: string }) {
    return (
        <div className="rounded-xl border border-parchment-50/10 bg-ink-700 px-4 py-6 text-center font-narrative text-sm italic text-parchment-400">
            {text}
        </div>
    )
}
