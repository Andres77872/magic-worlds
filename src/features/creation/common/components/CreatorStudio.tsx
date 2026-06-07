/**
 * CreatorStudio — the shared two-pane shell for every creator (character /
 * world / adventure). Supersedes CreatorLayout as the page wrapper.
 *
 * Layout: a header (eyebrow + title + Back + primary Save) over a responsive
 * grid — left = the editor column (a sticky section nav + the caller's <form>),
 * right = a sticky live preview. On mobile the preview moves to the top (as a
 * collapsible dock) and the nav is hidden.
 *
 * The studio does NOT own the <form>; the caller renders `<form id="…-form">`
 * as `children` and wires the header's Save button to it via `form="…-form"`.
 * This keeps the shell entity-agnostic while submit/keydown stay with the state.
 */

import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button, Icon, PageHeader, cx } from '@/ui/primitives'

export interface CreatorStudioProps {
    eyebrow?: string
    title: string
    /** Display icon — emoji string or an <Icon> element. */
    icon?: ReactNode
    onBack: () => void
    isLoading?: boolean
    /** The primary Save/Update button — rendered in the header (use form="…"). */
    headerActions?: ReactNode
    /** Optional StudioSectionNav, shown sticky atop the editor column on desktop. */
    nav?: ReactNode
    /** The sticky live-preview pane (typically a StudioPreviewDock). */
    preview: ReactNode
    /** The editor column — the caller's <form> with its StudioSections. */
    children: ReactNode
}

export function CreatorStudio({
    eyebrow = 'Creation',
    title,
    icon,
    onBack,
    isLoading = false,
    headerActions,
    nav,
    preview,
    children,
}: CreatorStudioProps) {
    return (
        <div
            className={cx(
                'mx-auto my-6 w-full max-w-[1180px] px-4 text-parchment-50 sm:px-6',
                isLoading && 'pointer-events-none opacity-70',
            )}
        >
            <PageHeader
                className="mb-6"
                eyebrow={eyebrow}
                title={title}
                icon={icon ? <span className="text-[28px] leading-none max-sm:text-2xl">{icon}</span> : undefined}
                divider
                actions={
                    <>
                        <Button kind="ghost" onClick={onBack} iconLeft={<Icon icon={ArrowLeft} size={16} />}>
                            Back
                        </Button>
                        {headerActions}
                    </>
                }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
                <div className="order-last min-w-0 lg:order-none">
                    {nav && (
                        <div className="sticky top-4 z-10 mb-6 hidden rounded-xl border border-parchment-50/10 bg-ink-800/90 px-3 py-2.5 backdrop-blur lg:block">
                            {nav}
                        </div>
                    )}
                    {children}
                </div>
                <aside className="order-first self-start lg:order-none lg:sticky lg:top-4">{preview}</aside>
            </div>
        </div>
    )
}
