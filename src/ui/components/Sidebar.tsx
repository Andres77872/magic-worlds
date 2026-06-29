/**
 * App sidebar — Reverie. A slim, full-height rail (replaces the top header):
 * brand at the top (fixed), primary nav + collapsible groups in the middle (the
 * only scrolling zone), and status + account at the bottom (fixed). Each control
 * is an icon button with a tooltip/aria-label.
 *
 * The inner `SidebarShell` renders the three zones and is shared by two hosts:
 * the docked `<Sidebar/>` (responsive rail, `hidden lg:flex`) and the mobile
 * `SidebarNavDrawer` (`variant="panel"` — always labelled/expanded).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
    AudioLines,
    BookOpen,
    BookOpenText,
    CirclePlay,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Compass,
    FileText,
    Flame,
    Gem,
    Globe,
    Images,
    ListChecks,
    MessageCircle,
    Phone,
    Sparkles,
    Swords,
    Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PageType } from '../../shared'
import { isPageFeatureEnabled } from '../../shared/featureFlags'
import { useNavigation, useAuth, useBackgroundTasks, useApiStatus } from '../../app/hooks'
import { Eyebrow, Icon, Tooltip, cx } from '../primitives'
import { ApiStatusMonitor } from './ApiStatusMonitor'
import { SidebarAccountMenu } from './SidebarAccountMenu'

interface RailItem {
    page: PageType
    labelKey: string
    icon: LucideIcon
}

interface NavGroup {
    /** stable id — keys the collapse state in localStorage + the aria-controls target */
    id: string
    labelKey: string
    items: RailItem[]
}

// Always-visible top anchors: discovery entry points with no group header.
const NAV_PRIMARY: RailItem[] = [
    { page: 'landing', labelKey: 'sidebar.nav.landing', icon: Compass },
    { page: 'community', labelKey: 'sidebar.nav.community', icon: Sparkles },
]

// Collapsible sections. The library items open the full galleries; the creators
// stay reachable from the dashboard AccessMenu and each gallery's "New …" button.
const NAV_GROUPS: NavGroup[] = [
    {
        id: 'activity',
        labelKey: 'sidebar.group.activity',
        items: [
            { page: 'chatroom', labelKey: 'sidebar.nav.chatroom', icon: MessageCircle },
            { page: 'active-adventures', labelKey: 'sidebar.nav.activeAdventures', icon: CirclePlay },
            { page: 'gallery-stories', labelKey: 'sidebar.nav.stories', icon: BookOpenText },
            { page: 'calls', labelKey: 'sidebar.nav.calls', icon: Phone },
        ],
    },
    {
        id: 'library',
        labelKey: 'sidebar.group.library',
        items: [
            { page: 'gallery-characters', labelKey: 'sidebar.nav.characters', icon: Users },
            { page: 'gallery-worlds', labelKey: 'sidebar.nav.worlds', icon: Globe },
            { page: 'gallery-items', labelKey: 'sidebar.nav.items', icon: Gem },
            { page: 'gallery-adventures', labelKey: 'sidebar.nav.adventures', icon: Swords },
        ],
    },
    {
        id: 'assets',
        labelKey: 'sidebar.group.assets',
        items: [
            { page: 'gallery-lorebooks', labelKey: 'sidebar.nav.lorebooks', icon: BookOpen },
            { page: 'gallery-resources', labelKey: 'sidebar.nav.resources', icon: FileText },
            { page: 'gallery-media', labelKey: 'sidebar.nav.media', icon: Images },
            { page: 'voice-studio', labelKey: 'sidebar.nav.voices', icon: AudioLines },
        ],
    },
]

/** Items hidden behind a feature flag are filtered out before render. */
function isItemVisible(item: RailItem): boolean {
    return isPageFeatureEnabled(item.page)
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'magic-worlds-sidebar-collapsed'
const SIDEBAR_GROUPS_STORAGE_KEY = 'magic-worlds-sidebar-groups'

function scrollMainToTop() {
    document.querySelector<HTMLElement>('[data-app-main]')?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
}

/**
 * Layout for a rail control. `panel` (mobile drawer) is always the full labelled
 * row; otherwise it's the responsive rail (icon-only on mobile / collapsed, full
 * row on the desktop-expanded rail).
 */
function controlLayout(panel: boolean, collapsed: boolean): string {
    return panel
        ? 'w-full justify-start px-3'
        : cx('w-10 justify-center px-0 lg:w-full lg:justify-start lg:px-3', collapsed && 'lg:w-10 lg:justify-center lg:px-0')
}

/** Label visibility for a rail control — always shown in `panel`, lg-gated on the rail. */
function controlLabel(panel: boolean, collapsed: boolean): string {
    return cx('min-w-0 truncate', panel ? 'inline' : cx('hidden', !collapsed && 'lg:inline'))
}

/** Cross-axis alignment for a zone/group — stretched in `panel`, centered/stretched on the rail. */
function zoneAlign(panel: boolean, collapsed: boolean): string {
    return panel ? 'items-stretch' : cx('items-center', collapsed ? 'lg:items-center' : 'lg:items-stretch')
}

function RailButton({
    label,
    active = false,
    current = false,
    collapsed = false,
    panel = false,
    danger = false,
    onClick,
    children,
    className,
}: {
    label: string
    active?: boolean
    current?: boolean
    collapsed?: boolean
    panel?: boolean
    danger?: boolean
    onClick: () => void
    children: ReactNode
    className?: string
}) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-current={current ? 'page' : undefined}
            title={label}
            onClick={onClick}
            className={cx(
                'relative inline-flex h-10 shrink-0 items-center gap-3 rounded-md font-ui text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
                controlLayout(panel, collapsed),
                active
                    ? 'bg-ember-500/15 text-ember-400 hover:bg-ember-500/20'
                    : danger
                      ? 'text-parchment-200 hover:bg-parchment-50/[.05] hover:text-blood-500'
                      : 'text-parchment-200 hover:bg-parchment-50/[.05] hover:text-parchment-50',
                className,
            )}
        >
            {children}
            <span className={controlLabel(panel, collapsed)}>{label}</span>
        </button>
    )
}

function NavItemButton({
    item,
    active,
    collapsed,
    panel,
    tooltipOnDesktop,
    onClick,
}: {
    item: RailItem
    active: boolean
    collapsed: boolean
    panel: boolean
    tooltipOnDesktop: boolean
    onClick: () => void
}) {
    const { t } = useTranslation()
    const label = t(item.labelKey)
    return (
        <Tooltip
            label={label}
            disabled={!tooltipOnDesktop}
            wrapperClassName="flex h-10 w-full items-center justify-center"
        >
            <RailButton
                label={label}
                active={active}
                current={active}
                collapsed={collapsed}
                panel={panel}
                onClick={onClick}
            >
                {/* Active-location indicator bar — reads in both expanded and collapsed states. */}
                {active && (
                    <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-ember-400"
                    />
                )}
                <Icon icon={item.icon} size={20} />
            </RailButton>
        </Tooltip>
    )
}

export interface SidebarShellProps {
    /** Responsive rail (`rail`) or the always-expanded mobile drawer (`panel`). */
    variant?: 'rail' | 'panel'
    collapsed?: boolean
    onToggleCollapsed?: () => void
    /** Called after any navigation — lets an open mobile drawer close itself. */
    onNavigate?: () => void
    /**
     * Footer tasks control. When provided (desktop rail), it replaces the legacy
     * button → drawer entry with a host-supplied node (the anchored tasks popover).
     * Omitted on the mobile panel, which falls back to opening the full drawer.
     */
    renderTasks?: (ctx: { collapsed: boolean; panel: boolean }) => ReactNode
}

/** The three-zone shell (header / scrolling nav / footer). Shared by both hosts. */
export function SidebarShell({
    variant = 'rail',
    collapsed = false,
    onToggleCollapsed,
    onNavigate,
    renderTasks,
}: SidebarShellProps) {
    const { t } = useTranslation()
    const { currentPage, setPage } = useNavigation()
    const { isAuthenticated } = useAuth()
    const { activeCount, openDrawer } = useBackgroundTasks()
    const { status: apiStatus, services, checkedAt } = useApiStatus()

    const panel = variant === 'panel'
    // Tooltips only earn their keep on the collapsed rail (icon-only, no labels).
    const tooltipOnDesktop = !panel && collapsed
    const align = zoneAlign(panel, collapsed)
    const navRef = useRef<HTMLElement>(null)

    // Keep the active item in view when navigating (no-op when already visible).
    useEffect(() => {
        navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest' })
    }, [currentPage])

    // Per-group fold state (true = collapsed); empty default = every group expanded.
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
        if (typeof window === 'undefined') return {}
        try {
            const parsed = JSON.parse(window.localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY) ?? '{}')
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
        } catch {
            return {}
        }
    })

    useEffect(() => {
        window.localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(collapsedGroups))
    }, [collapsedGroups])

    const toggleGroup = (id: string) => {
        setCollapsedGroups((current) => ({ ...current, [id]: !current[id] }))
    }

    const go = (item: RailItem) => {
        setPage(item.page)
        onNavigate?.()
    }

    const goHome = () => {
        setPage('landing')
        window.requestAnimationFrame(scrollMainToTop)
        onNavigate?.()
    }

    const tasksLabel = activeCount > 0 ? t('sidebar.activeTasks', { count: activeCount }) : t('sidebar.tasks')

    return (
        <>
            {/* HEADER zone — fixed; brand + the desktop-only collapse toggle. */}
            <div className={cx('flex shrink-0 flex-col gap-2 px-3 pb-2 pt-4', align)}>
                <Tooltip
                    label={t('sidebar.home')}
                    disabled={!tooltipOnDesktop}
                    wrapperClassName="flex h-10 w-full items-center justify-center"
                >
                    <button
                        onClick={goHome}
                        aria-label={t('sidebar.homeButton')}
                        title="Magic Worlds"
                        className={cx(
                            'inline-flex h-10 items-center gap-3 rounded-lg bg-ember-500/15 font-ui text-sm font-semibold text-ember-400 transition-colors hover:text-ember-300',
                            controlLayout(panel, collapsed),
                        )}
                    >
                        <Icon icon={Flame} size={20} />
                        <span className={controlLabel(panel, collapsed)}>Magic Worlds</span>
                    </button>
                </Tooltip>

                {!panel && onToggleCollapsed && (
                    <Tooltip
                        label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                        disabled={!tooltipOnDesktop}
                        wrapperClassName="hidden h-10 w-full items-center justify-center lg:flex"
                    >
                        <button
                            type="button"
                            aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                            aria-expanded={!collapsed}
                            title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                            onClick={onToggleCollapsed}
                            className={cx(
                                'hidden h-10 items-center gap-3 rounded-md font-ui text-sm font-semibold text-parchment-300 transition-colors hover:bg-parchment-50/[.05] hover:text-parchment-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 lg:inline-flex',
                                controlLayout(panel, collapsed),
                            )}
                        >
                            <Icon icon={collapsed ? ChevronRight : ChevronLeft} size={18} />
                            <span className={controlLabel(panel, collapsed)}>{t('sidebar.collapse')}</span>
                        </button>
                    </Tooltip>
                )}
            </div>

            {/* NAV zone — the only scroller; header + footer stay pinned. */}
            <nav
                ref={navRef}
                className={cx(
                    'flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-1 [scrollbar-width:thin]',
                    align,
                )}
                aria-label={t('sidebar.primaryNav')}
            >
                {NAV_PRIMARY.filter(isItemVisible).map((item) => (
                    <NavItemButton
                        key={item.page}
                        item={item}
                        active={currentPage === item.page}
                        collapsed={collapsed}
                        panel={panel}
                        tooltipOnDesktop={tooltipOnDesktop}
                        onClick={() => go(item)}
                    />
                ))}

                {NAV_GROUPS.map((group) => {
                    const items = group.items.filter(isItemVisible)
                    if (items.length === 0) return null
                    const groupCollapsed = Boolean(collapsedGroups[group.id])
                    const groupLabel = t(group.labelKey)
                    const regionId = `sidebar-group-${group.id}`
                    const foldClass = panel
                        ? groupCollapsed
                            ? 'grid-rows-[0fr]'
                            : 'grid-rows-[1fr]'
                        : !collapsed && groupCollapsed
                          ? 'grid-rows-[1fr] lg:grid-rows-[0fr]'
                          : 'grid-rows-[1fr]'
                    return (
                        <div key={group.id} className={cx('flex w-full flex-col gap-1.5', align)}>
                            {/* Icon-rail separator — shown only where the header is hidden. */}
                            <div
                                aria-hidden="true"
                                className={cx(
                                    panel
                                        ? 'hidden'
                                        : cx(
                                              'mx-auto my-1 h-px w-6 rounded-full bg-parchment-50/[.08]',
                                              !collapsed && 'lg:hidden',
                                          ),
                                )}
                            />
                            {/* Group header — toggles the fold (always shown in the panel). */}
                            <button
                                type="button"
                                onClick={() => toggleGroup(group.id)}
                                aria-expanded={!groupCollapsed}
                                aria-controls={regionId}
                                className={cx(
                                    'items-center justify-between rounded-md px-3 pb-1 pt-2 text-left transition-colors hover:bg-parchment-50/[.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
                                    panel ? 'flex' : cx('hidden', !collapsed && 'lg:flex'),
                                )}
                            >
                                <Eyebrow tone="muted">{groupLabel}</Eyebrow>
                                <Icon
                                    icon={groupCollapsed ? ChevronRight : ChevronDown}
                                    size={14}
                                    className="text-parchment-500"
                                />
                            </button>
                            {/* Animated items region. */}
                            <div
                                id={regionId}
                                className={cx(
                                    'grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out',
                                    foldClass,
                                )}
                            >
                                <div className={cx('flex min-h-0 flex-col gap-1.5', align)}>
                                    {items.map((item) => (
                                        <NavItemButton
                                            key={item.page}
                                            item={item}
                                            active={currentPage === item.page}
                                            collapsed={collapsed}
                                            panel={panel}
                                            tooltipOnDesktop={tooltipOnDesktop}
                                            onClick={() => go(item)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </nav>

            {/* FOOTER zone — fixed; status + tasks + account, anchored by a hairline. */}
            <div className={cx('flex shrink-0 flex-col gap-2 border-t border-parchment-50/[.08] px-3 pb-4 pt-2', align)}>
                <ApiStatusMonitor status={apiStatus} services={services} checkedAt={checkedAt} collapsed={collapsed} />

                {isAuthenticated &&
                    (renderTasks ? (
                        renderTasks({ collapsed, panel })
                    ) : (
                        <Tooltip
                            label={tasksLabel}
                            disabled={!tooltipOnDesktop}
                            wrapperClassName="flex h-10 w-full items-center justify-center"
                        >
                            <div className="relative w-full">
                                <RailButton label={tasksLabel} collapsed={collapsed} panel={panel} onClick={openDrawer}>
                                    <Icon icon={ListChecks} size={19} />
                                </RailButton>
                                {activeCount > 0 && (
                                    <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-arcane-500 px-1 font-ui text-micro font-bold leading-none text-ink-900 ring-2 ring-ink-900">
                                        {activeCount > 9 ? '9+' : activeCount}
                                    </span>
                                )}
                            </div>
                        </Tooltip>
                    ))}

                {/* Account lives in the top bar on mobile, so the drawer footer omits it. */}
                {!panel && <SidebarAccountMenu collapsed={collapsed} placement="rise" onNavigate={onNavigate} />}
            </div>
        </>
    )
}

/** Docked, responsive rail. AppRouter passes `className="hidden lg:flex"`. */
export function Sidebar({
    className = 'flex',
    renderTasks,
}: {
    className?: string
    renderTasks?: SidebarShellProps['renderTasks']
}) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false
        return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
    })

    useEffect(() => {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, sidebarCollapsed ? 'true' : 'false')
    }, [sidebarCollapsed])

    return (
        <aside
            className={cx(
                'sticky top-0 z-40 h-screen w-16 shrink-0 flex-col border-r border-parchment-50/[.08] bg-ink-900/80 backdrop-blur-md transition-[width]',
                className,
                sidebarCollapsed ? 'lg:w-16' : 'lg:w-56',
            )}
            data-sidebar-collapsed={sidebarCollapsed}
        >
            <SidebarShell
                variant="rail"
                collapsed={sidebarCollapsed}
                onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
                renderTasks={renderTasks}
            />
        </aside>
    )
}
