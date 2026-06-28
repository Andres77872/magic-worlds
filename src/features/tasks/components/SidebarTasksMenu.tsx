/**
 * Desktop host for the background-tasks UI — the anchored popover that rises from
 * the sidebar's tasks button. Mirrors the ApiStatusMonitor / SidebarAccountMenu
 * idiom: anchored to the rail (not portaled, so it keeps the simple outside
 * pointer-down + Escape dismissal), animates in with the app's overlay motion,
 * and wraps the shared `TasksPanel`. Mobile keeps the full-height `TasksDrawer`.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks } from 'lucide-react'
import { useBackgroundTasks } from '@/app/hooks'
import { Icon, IconTile, Tooltip, cx } from '@/ui/primitives'
import { TasksPanel } from './TasksPanel'

// Matches the Drawer transition so the popover enters/exits with the app's idiom.
const PANEL_TRANSITION_MS = 200

interface SidebarTasksMenuProps {
    /** Icon-only trigger (collapsed rail). */
    collapsed?: boolean
    /** Start with the popover open (stories / tests). */
    defaultOpen?: boolean
}

export function SidebarTasksMenu({ collapsed = false, defaultOpen = false }: SidebarTasksMenuProps) {
    const { t } = useTranslation()
    const { activeCount } = useBackgroundTasks()
    const [open, setOpen] = useState(defaultOpen)
    // Drawer-style mount/enter: keep mounted through the exit transition, then drop.
    const [mounted, setMounted] = useState(defaultOpen)
    const [entered, setEntered] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const label = activeCount > 0 ? t('sidebar.activeTasks', { count: activeCount }) : t('sidebar.tasks')
    const summary = activeCount > 0 ? t('tasksDrawer.summary', { count: activeCount }) : t('tasksDrawer.summaryIdle')

    // Dismiss on outside pointer-down or Escape (anchored popover, not a modal).
    // Ignore clicks inside a portaled overlay (the attached-card modal the panel
    // opens) so interacting with it doesn't unmount the popover beneath it.
    useEffect(() => {
        if (!open) return
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Element | null
            if (containerRef.current?.contains(target as Node)) return
            if (target?.closest?.('[role="dialog"], [role="alertdialog"]')) return
            setOpen(false)
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        window.addEventListener('pointerdown', handlePointerDown)
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown)
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [open])

    // Rise/scale entrance + exit, mirroring Drawer's mounted/entered rAF idiom.
    useEffect(() => {
        if (open) {
            setMounted(true)
            const id = requestAnimationFrame(() => setEntered(true))
            return () => cancelAnimationFrame(id)
        }
        setEntered(false)
        const timer = window.setTimeout(() => setMounted(false), PANEL_TRANSITION_MS)
        return () => window.clearTimeout(timer)
    }, [open])

    return (
        <div ref={containerRef} className="relative w-full">
            <Tooltip label={label} disabled={!collapsed} wrapperClassName="w-full">
                <button
                    type="button"
                    aria-label={label}
                    aria-expanded={open}
                    aria-controls="sidebar-tasks-panel"
                    title={label}
                    className={cx(
                        'relative inline-flex h-10 w-10 shrink-0 items-center justify-center gap-3 rounded-md px-0 font-ui text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 lg:w-full lg:justify-start lg:px-3',
                        collapsed && 'lg:w-10 lg:justify-center lg:px-0',
                        open
                            ? 'bg-ember-500/15 text-ember-400'
                            : 'text-parchment-200 hover:bg-parchment-50/[.05] hover:text-parchment-50',
                    )}
                    onClick={() => setOpen((current) => !current)}
                >
                    <Icon icon={ListChecks} size={18} />
                    <span className={cx('hidden min-w-0 truncate', !collapsed && 'lg:inline')}>{label}</span>
                    {activeCount > 0 && (
                        <span
                            aria-hidden="true"
                            className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-arcane-500 px-1 font-ui text-[10px] font-bold leading-none text-ink-900 ring-2 ring-ink-900"
                        >
                            {activeCount > 9 ? '9+' : activeCount}
                        </span>
                    )}
                </button>
            </Tooltip>
            {mounted && (
                <div
                    id="sidebar-tasks-panel"
                    role="dialog"
                    aria-label={t('tasksDrawer.title')}
                    className={cx(
                        'absolute bottom-0 left-full z-50 ml-3 flex max-h-[min(34rem,calc(100vh-2rem))] w-[min(24rem,calc(100vw-5rem))] origin-bottom-left flex-col overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800 text-left shadow-lg transition-[opacity,transform] duration-200 ease-out',
                        entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-1 scale-[.98] opacity-0',
                    )}
                >
                    <div className="flex items-center gap-2.5 border-b border-parchment-50/10 p-3">
                        <IconTile icon={ListChecks} tone="arcane" size="sm" />
                        <div className="min-w-0">
                            <p className="truncate font-ui text-sm font-semibold text-parchment-50">{t('tasksDrawer.title')}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-parchment-400">{summary}</p>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                        <TasksPanel dense />
                    </div>
                </div>
            )}
        </div>
    )
}
