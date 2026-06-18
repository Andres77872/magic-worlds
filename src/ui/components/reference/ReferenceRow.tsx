/**
 * ReferenceRow — one dense line in a reference list (codex cards, session
 * lorebook attachments, novel codex entries). It owns no border or fill: rows
 * read as lines in a list, lit only by a faint hover wash, so a stack of them
 * inside a ReferenceGroup looks like one consolidated surface rather than a
 * column of nested cards.
 *
 * Slots: a `leading` glyph (an IconTile), a title/description block (optionally
 * a button via `onTitleClick`), an always-visible `trailing` control cluster,
 * and an optional `hoverReveal` cluster that fades in on hover/focus.
 */
import type { ReactNode } from 'react'
import { cx } from '@/ui/primitives'

interface ReferenceRowProps {
    /** Leading glyph — typically an IconTile. */
    leading: ReactNode
    title: string
    description?: string
    /** When set, the title block becomes a button (e.g. open the entry). */
    onTitleClick?: () => void
    /** Accessible label for the title-button variant. */
    titleAriaLabel?: string
    /** Always-visible trailing controls (enable toggle, delete, status badge). */
    trailing?: ReactNode
    /** Controls that fade in on row hover / keyboard focus (e.g. edit, remove). */
    hoverReveal?: ReactNode
    /** Dim the row when the item is disabled. */
    dimmed?: boolean
    testId?: string
    className?: string
}

export function ReferenceRow({
    leading,
    title,
    description,
    onTitleClick,
    titleAriaLabel,
    trailing,
    hoverReveal,
    dimmed = false,
    testId,
    className,
}: ReferenceRowProps) {
    const body = (
        <>
            <span className="block truncate font-ui text-sm font-semibold text-parchment-100">{title}</span>
            {description && <span className="block truncate font-ui text-xs text-parchment-400">{description}</span>}
        </>
    )
    return (
        <div
            className={cx(
                'group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-parchment-50/[.04]',
                dimmed && 'opacity-50',
                className,
            )}
            data-testid={testId}
        >
            {leading}
            {onTitleClick ? (
                <button
                    type="button"
                    onClick={onTitleClick}
                    aria-label={titleAriaLabel}
                    className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
                >
                    {body}
                </button>
            ) : (
                <div className="min-w-0 flex-1">{body}</div>
            )}
            {(hoverReveal || trailing) && (
                <div className="flex shrink-0 items-center gap-1">
                    {hoverReveal && (
                        <span className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                            {hoverReveal}
                        </span>
                    )}
                    {trailing}
                </div>
            )}
        </div>
    )
}
