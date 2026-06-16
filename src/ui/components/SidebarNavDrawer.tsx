/**
 * Mobile navigation drawer — the off-canvas form of the sidebar shown below the
 * `lg` breakpoint, where the permanent rail is hidden. Opened from the
 * MobileTopBar hamburger; slides in from the left over a dim+blur scrim and
 * renders the shared `SidebarShell` in its always-labelled `panel` form.
 *
 * Built on the same primitives as the Drawer (portal + scrim + useDismissableLayer
 * for Escape / scroll-lock / focus-trap / focus-restore), but left-anchored and
 * wearing the sidebar's own chrome. Auto-closes on navigate and force-closes when
 * the viewport crosses back to the docked breakpoint so no overlay is stranded.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigation } from '../../app/hooks'
import { cx, useIsDesktop } from '../primitives'
import { useDismissableLayer } from '../primitives/useDismissableLayer'
import { SidebarShell } from './Sidebar'

const TRANSITION_MS = 220

interface SidebarNavDrawerProps {
    open: boolean
    onClose: () => void
}

export function SidebarNavDrawer({ open, onClose }: SidebarNavDrawerProps) {
    const { currentPage } = useNavigation()
    const isDesktop = useIsDesktop()
    // Keep the panel mounted through the exit animation, then unmount.
    const [mounted, setMounted] = useState(open)
    const [entered, setEntered] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)
    const prevPage = useRef(currentPage)

    useEffect(() => {
        if (open) {
            setMounted(true)
            const id = requestAnimationFrame(() => setEntered(true))
            return () => cancelAnimationFrame(id)
        }
        setEntered(false)
        const timer = window.setTimeout(() => setMounted(false), TRANSITION_MS)
        return () => window.clearTimeout(timer)
    }, [open])

    // Close on any real navigation (covers browser back/forward); the nav clicks
    // themselves already call onClose through SidebarShell's onNavigate.
    useEffect(() => {
        if (prevPage.current !== currentPage) {
            prevPage.current = currentPage
            onClose()
        }
    }, [currentPage, onClose])

    // Never strand the overlay when the layout crosses to the docked breakpoint.
    useEffect(() => {
        if (isDesktop && open) onClose()
    }, [isDesktop, open, onClose])

    // Escape-to-close, body scroll-lock, focus-trap and focus restoration.
    useDismissableLayer({ open, onClose, panelRef })

    if (!mounted) return null

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-start lg:hidden">
            <div
                className={cx(
                    'absolute inset-0 bg-ink-900/60 backdrop-blur-sm transition-opacity duration-200',
                    entered ? 'opacity-100' : 'opacity-0',
                )}
                onClick={onClose}
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className={cx(
                    'relative flex h-full w-[300px] max-w-[85vw] flex-col border-r border-parchment-50/[.08] bg-ink-900 shadow-xl outline-none transition-transform duration-200 ease-out',
                    entered ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                <SidebarShell variant="panel" onNavigate={onClose} />
            </div>
        </div>,
        document.body,
    )
}
