/**
 * ZoneHeader — the dashboard's zone register: Eyebrow over a display h2, with
 * an optional right-aligned affordance row. One component so ResumeBand,
 * BeginZone, and LibraryShelf align at exactly the same visual register.
 * Carries no outer margin; zones space their content below it (`mt-4` for
 * chip/tab rows, `mt-5` for grids and rails).
 */

import type { ReactNode } from 'react'
import { Eyebrow } from '@/ui/primitives'

export interface ZoneHeaderProps {
    eyebrow: ReactNode
    /** Ember for play/create zones; muted for the library archive. */
    tone?: 'ember' | 'muted'
    title: ReactNode
    /** Right-aligned affordances (View all, New …). */
    right?: ReactNode
}

export function ZoneHeader({ eyebrow, tone = 'ember', title, right }: ZoneHeaderProps) {
    return (
        <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
                <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
                <h2 className="m-0 font-display text-h3 font-semibold text-parchment-50">{title}</h2>
            </div>
            {right && <div className="flex items-center gap-3">{right}</div>}
        </header>
    )
}
