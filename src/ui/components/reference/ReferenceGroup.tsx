/**
 * ReferenceGroup — a borderless, labelled section inside a reference panel: a
 * slim subheader (eyebrow label + quiet count + icon-only add control) above
 * either its rows or a one-line inline empty state. The group draws no box of
 * its own, so several groups stack inside a single shell — separated by the
 * parent's `divide-y` hairline — and read as one consolidated panel instead of
 * a column of nested cards.
 *
 * Tone follows the Reverie ember/arcane split: `ember` for the player's curated
 * shelf (codex), `arcane` for AI memory (lorebooks).
 */
import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Eyebrow, Icon, IconButton, cx } from '@/ui/primitives'

interface ReferenceGroupProps {
    label: string
    tone?: 'ember' | 'arcane'
    count?: number
    /** Renders the icon-only add control when both `onAdd` and `addLabel` are set. */
    onAdd?: () => void
    addLabel?: string
    addDisabled?: boolean
    /** Extra header actions placed before the add control (e.g. a second add). */
    headerExtras?: ReactNode
    /** One-line copy shown in place of children when `isEmpty`. */
    emptyText?: string
    isEmpty?: boolean
    /**
     * Drop the vertical padding tuned for a `divide-y` shell. Use when the parent
     * already spaces groups (e.g. a `gap`-managed scroll list like the novel panel).
     */
    flush?: boolean
    children?: ReactNode
    'aria-label'?: string
}

export function ReferenceGroup({
    label,
    tone = 'arcane',
    count,
    onAdd,
    addLabel,
    addDisabled = false,
    headerExtras,
    emptyText,
    isEmpty = false,
    flush = false,
    children,
    'aria-label': ariaLabel,
}: ReferenceGroupProps) {
    return (
        <section
            className={cx('flex flex-col gap-2', !flush && 'py-3 first:pt-0 last:pb-0')}
            aria-label={ariaLabel ?? label}
        >
            <div className="flex items-center gap-2 px-0.5">
                <Eyebrow tone={tone}>{label}</Eyebrow>
                {count !== undefined && count > 0 && (
                    <span className="font-mono text-meta text-parchment-500">{count}</span>
                )}
                {(headerExtras || (onAdd && addLabel)) && (
                    <div className="ml-auto flex items-center gap-1">
                        {headerExtras}
                        {onAdd && addLabel && (
                            <IconButton label={addLabel} size="sm" onClick={onAdd} disabled={addDisabled}>
                                <Icon icon={Plus} size={15} />
                            </IconButton>
                        )}
                    </div>
                )}
            </div>
            {isEmpty && emptyText ? <ReferenceEmpty>{emptyText}</ReferenceEmpty> : children}
        </section>
    )
}

/** One-line inline empty/placeholder copy — shared so groups stay visually flat. */
export function ReferenceEmpty({ children }: { children: ReactNode }) {
    return <p className="m-0 px-0.5 py-1 font-ui text-xs leading-snug text-parchment-400">{children}</p>
}
