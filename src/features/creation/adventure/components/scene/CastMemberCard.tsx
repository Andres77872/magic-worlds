/**
 * CastMemberCard — a rich, selectable row for picking cast / persona / world in
 * the adventure scene-builder. A keyboard-accessible button (aria-pressed) with
 * the shared `.lift` candlelight hover, the app-wide selected ring, and a corner
 * check when selected. Also exports the shared row styling, a "None" option, and
 * a loading row used by the selectors.
 */

import type { ReactNode } from 'react'
import { Ban } from 'lucide-react'
import { Avatar, Icon, SelectionCheck, Tag, cx } from '@/ui/primitives'
import { SELECTED_CARD_CLASS } from '@/ui/components/lists/Card'

/** Shared visual for a selectable row (used by CastMemberCard and NoneOption). */
const selectableRowClass = (selected: boolean) =>
    cx(
        'lift flex w-full gap-3 rounded-xl border bg-ink-700 p-3 text-left',
        selected ? SELECTED_CARD_CLASS : 'border-parchment-50/[.08]',
    )

export interface CastMemberCardProps {
    name: string
    /** Character race or world type — shown as a Tag. */
    race?: string
    description?: string
    selected: boolean
    onToggle: () => void
    /** Optional trailing badge, e.g. a "You" marker for the persona. */
    badge?: ReactNode
}

export function CastMemberCard({ name, race, description, selected, onToggle, badge }: CastMemberCardProps) {
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
            <SelectionCheck selected={selected} className="mt-0.5" />
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
            <SelectionCheck selected={selected} />
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
