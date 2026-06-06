/**
 * StudioPreviewDock — responsive container for the Creator Studio's live preview.
 *
 * On large screens it renders the preview directly (the parent <aside> makes it
 * sticky). On small screens it collapses to a "Live preview" bar the user can
 * expand, so the preview never pushes the editor off-screen on mobile.
 */

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Eyebrow, Icon } from '@/ui/primitives'

export interface StudioPreviewDockProps {
    children: ReactNode
    label?: string
}

export function StudioPreviewDock({ children, label = 'Live preview' }: StudioPreviewDockProps) {
    const [open, setOpen] = useState(false)

    return (
        <>
            {/* Mobile: collapsible bar */}
            <div className="lg:hidden">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-parchment-50/10 bg-ink-800 px-4 py-3 text-left transition-colors hover:border-parchment-50/20"
                >
                    <Eyebrow tone="muted">{label}</Eyebrow>
                    <Icon icon={open ? ChevronUp : ChevronDown} size={16} className="text-parchment-400" />
                </button>
                {open && <div className="mt-3">{children}</div>}
            </div>

            {/* Desktop: sticky card (positioning handled by the parent <aside>) */}
            <div className="hidden lg:block">{children}</div>
        </>
    )
}
