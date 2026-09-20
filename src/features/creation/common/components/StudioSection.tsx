/**
 * StudioSection — a titled, anchored editor block for the Creator Studio.
 *
 * Each section shares the editor canvas, using space and a single divider
 * with a display-serif header and an `id` anchor so the
 * StudioSectionNav can scroll-spy and jump to it. The `scroll-mt` clears the
 * sticky section nav on desktop.
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon, cx } from '@/ui/primitives'

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
 * Fields stay on one continuous editor surface. Reserve enclosed surfaces for
 * interactive cards and previews rather than nesting a card around every group.
 */
export function StudioSection({ id, icon, tone = 'ember', title, description, right, children }: StudioSectionProps) {
    return (
        <section
            id={id}
            aria-labelledby={`${id}-heading`}
            className="scroll-mt-[calc(var(--studio-nav-clearance,7rem)+var(--spacing)*4)] border-t border-parchment-50/10 pt-6 first:border-t-0 first:pt-0"
        >
            <div className="mb-5 flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                    <h2 id={`${id}-heading`} className="flex items-center gap-2 font-display text-h3 font-semibold leading-tight text-parchment-50">
                        {icon && <Icon icon={icon} size={18} className={cx('shrink-0', tone === 'arcane' ? 'text-arcane-300' : 'text-ember-400')} />}
                        {title}
                    </h2>
                    {description && (
                        <p className="mt-1 font-ui text-label leading-relaxed text-parchment-300">{description}</p>
                    )}
                </div>
                {right && <div className="shrink-0">{right}</div>}
            </div>
            <div className="flex flex-col gap-5">{children}</div>
        </section>
    )
}
