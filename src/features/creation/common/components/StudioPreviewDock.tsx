/**
 * StudioPreviewDock — responsive container for the Creator Studio's live preview.
 *
 * On large screens it renders the preview directly (the parent <aside> makes it
 * sticky). On small screens it collapses to a "Live preview" bar the user can
 * expand, so the preview never pushes the editor off-screen on mobile.
 *
 * `busy` overlays a subtle, NON-BLOCKING shimmer while AI generation is in flight
 * (the overlay is pointer-events-none and scoped to the preview, so the rest of
 * the page stays fully interactive). `notice` renders an optional status line
 * (e.g. a "draft generated" badge) directly above the preview.
 */

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { cx, Eyebrow, Icon } from '@/ui/primitives'

export interface StudioPreviewDockProps {
    children: ReactNode
    label?: string
    /** Show a non-blocking shimmer overlay over the preview (AI generation in flight). */
    busy?: boolean
    /** Optional status line rendered above the preview (e.g. a success badge). */
    notice?: ReactNode
    /**
     * Optional content rendered directly BELOW the preview (e.g. portrait/theme
     * generators). Kept outside the `busy` overlay so its controls stay
     * interactive while a draft is generating.
     */
    footer?: ReactNode
}

function PreviewBody({ children, busy, notice }: Pick<StudioPreviewDockProps, 'children' | 'busy' | 'notice'>) {
    return (
        <div className="flex flex-col gap-3">
            {notice}
            <div className="relative" aria-busy={busy || undefined}>
                <div className={cx('transition-opacity duration-300', busy && 'opacity-50')}>{children}</div>
                {busy && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-ink-900/30 backdrop-blur-[1px]">
                        <span className="inline-flex items-center gap-2 rounded-full border border-arcane-500/40 bg-ink-800/90 px-3 py-1.5 text-xs font-semibold text-arcane-200 shadow-lg">
                            <Icon icon={Sparkles} size={14} className="animate-pulse text-arcane-300" />
                            Generating…
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

export function StudioPreviewDock({ children, label = 'Live preview', busy, notice, footer }: StudioPreviewDockProps) {
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
                    <span className="flex items-center gap-2">
                        <Eyebrow tone="muted">{label}</Eyebrow>
                        {busy && <Icon icon={Sparkles} size={14} className="animate-pulse text-arcane-300" />}
                    </span>
                    <Icon icon={open ? ChevronUp : ChevronDown} size={16} className="text-parchment-400" />
                </button>
                {open && (
                    <div className="mt-3 flex flex-col gap-4">
                        <PreviewBody busy={busy} notice={notice}>
                            {children}
                        </PreviewBody>
                        {footer}
                    </div>
                )}
            </div>

            {/* Desktop: sticky card (positioning handled by the parent <aside>). Caps
                its height to the viewport and scrolls internally so a tall preview +
                footer never gets clipped while pinned. */}
            <div className="hidden lg:flex lg:max-h-[calc(100vh-2rem)] lg:flex-col lg:gap-4 lg:overflow-y-auto lg:pr-1">
                <PreviewBody busy={busy} notice={notice}>
                    {children}
                </PreviewBody>
                {footer}
            </div>
        </>
    )
}
