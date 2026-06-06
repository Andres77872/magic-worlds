/**
 * StudioSection — a titled, anchored editor block for the Creator Studio.
 *
 * Each section is an outlined surface (raised against the ink-800 canvas via a
 * hairline border) with a display-serif header and an `id` anchor so the
 * StudioSectionNav can scroll-spy and jump to it. The `scroll-mt` clears the
 * sticky section nav on desktop.
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { SectionHeader } from '@/ui/primitives'

export interface StudioSectionProps {
    /** Anchor id — referenced by StudioSectionNav items. */
    id: string
    icon?: LucideIcon
    tone?: 'ember' | 'arcane'
    title: ReactNode
    description?: ReactNode
    /** Right-aligned slot in the header (count, action, etc.). */
    right?: ReactNode
    children: ReactNode
}

export function StudioSection({ id, icon, tone = 'ember', title, description, right, children }: StudioSectionProps) {
    return (
        <section
            id={id}
            className="scroll-mt-20 rounded-xl border border-parchment-50/10 bg-ink-800 p-6 shadow-sm max-sm:p-5"
        >
            <SectionHeader icon={icon} tone={tone} title={title} right={right} />
            {description && <p className="mt-1.5 font-narrative text-sm leading-snug text-parchment-400">{description}</p>}
            <div className="mt-5 flex flex-col gap-6">{children}</div>
        </section>
    )
}
