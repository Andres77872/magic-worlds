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
import { IconTile } from '@/ui/primitives'

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

/**
 * A section reads as a distinct "chapter": a header band (tinted IconTile +
 * display title + description + optional action) separated by a hairline from
 * the body, rather than a flat box of fields. The faint top wash adds candlelit
 * depth so a stack of sections no longer looks like a plain monochrome form.
 */
export function StudioSection({ id, icon, tone = 'ember', title, description, right, children }: StudioSectionProps) {
    return (
        <section
            id={id}
            className="scroll-mt-20 overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800 shadow-sm"
        >
            <div className="flex items-start gap-4 border-b border-parchment-50/[.07] bg-gradient-to-b from-parchment-50/[.025] to-transparent p-6 max-sm:p-5">
                {icon && <IconTile icon={icon} tone={tone} size="sm" />}
                <div className="min-w-0 flex-1">
                    <h3 className="font-display text-[20px] font-semibold leading-tight text-parchment-50">{title}</h3>
                    {description && (
                        <p className="mt-1 font-narrative text-sm leading-snug text-parchment-400">{description}</p>
                    )}
                </div>
                {right && <div className="shrink-0">{right}</div>}
            </div>
            <div className="flex flex-col gap-6 p-6 max-sm:p-5">{children}</div>
        </section>
    )
}
