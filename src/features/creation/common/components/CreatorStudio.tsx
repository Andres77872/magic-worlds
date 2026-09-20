/**
 * CreatorStudio — the shared two-pane shell for every creator (character /
 * world / adventure). Supersedes CreatorLayout as the page wrapper.
 *
 * Layout: a header (eyebrow + title + Back + primary Save) over a responsive
 * grid — left = the editor column (a sticky section nav + the caller's <form>),
 * right = a sticky live preview. On mobile the preview moves to the top (as a
 * collapsible dock) and the nav scrolls horizontally.
 *
 * The studio does NOT own the <form>; the caller renders `<form id="…-form">`
 * as `children` and wires the header's Save button to it via `form="…-form"`.
 * This keeps the shell entity-agnostic while submit/keydown stay with the state.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
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
    eyebrow,
    title,
    icon,
    onBack,
    isLoading = false,
    headerActions,
    nav,
    preview,
    children,
}: CreatorStudioProps) {
    const { t } = useTranslation()
    const navStart = useRef<HTMLDivElement>(null)
    const navContainer = useRef<HTMLDivElement>(null)
    const [navPinned, setNavPinned] = useState(false)
    const hasNav = nav != null

    useEffect(() => {
        const marker = navStart.current
        const navigation = navContainer.current
        if (!marker || !navigation) return
        const updateClearance = () => {
            const inset = Number.parseFloat(getComputedStyle(navigation).top) || 0
            // The wrapped navigation can gain rows at intermediate widths or
            // with longer translated labels. Anchors must clear its real size.
            navigation.parentElement?.style.setProperty('--studio-nav-clearance', `${navigation.getBoundingClientRect().height + inset}px`)
            return inset
        }
        let observer: IntersectionObserver | undefined
        const observe = () => {
            observer?.disconnect()
            const root = marker.closest('[data-app-main]')
            const inset = updateClearance()
            observer = new IntersectionObserver(([entry]) => {
                // Compare with the same boundary that determines intersection.
                // A negative margin can be crossed while the marker is still
                // below viewport zero, especially during slow scrolling.
                setNavPinned(!entry.isIntersecting && entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? inset))
            }, { root, rootMargin: `-${inset}px 0px 0px` })
            observer.observe(marker)
        }
        observe()
        const sizeObserver = new ResizeObserver(updateClearance)
        sizeObserver.observe(navigation)
        window.addEventListener('resize', observe)
        return () => {
            observer?.disconnect()
            sizeObserver.disconnect()
            window.removeEventListener('resize', observe)
        }
    }, [hasNav])

    return (
        <div
            className={cx(
                'mx-auto my-6 w-full max-w-[1180px] px-4 text-parchment-50 sm:px-6',
                isLoading && 'pointer-events-none opacity-70',
            )}
        >
            <PageHeader
                className="mb-6"
                eyebrow={eyebrow ?? t('creation.common.creationEyebrow')}
                title={title}
                icon={icon ? <span className="text-[28px] leading-none max-sm:text-2xl">{icon}</span> : undefined}
                divider
                actions={
                    <>
                        <Button variant="ghost" onClick={onBack} iconLeft={<Icon icon={ArrowLeft} size={16} />}>
                            {t('creation.common.back')}
                        </Button>
                        {headerActions}
                    </>
                }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
                <div className="order-last min-w-0 lg:order-none">
                    {nav && (
                        <>
                            <div ref={navStart} aria-hidden="true" className="h-px" />
                            <div ref={navContainer} className={cx(
                                'sticky top-14 z-10 mb-6 min-w-0 border-b border-line-faint lg:top-4',
                                navPinned && 'bg-ink-900/95 backdrop-blur',
                            )}>
                                {nav}
                            </div>
                        </>
                    )}
                    {children}
                </div>
                <aside className="order-first self-start lg:order-none lg:sticky lg:top-4">{preview}</aside>
            </div>
        </div>
    )
}
