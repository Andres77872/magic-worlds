/**
 * App sidebar — Reverie. A slim, full-height icon rail (replaces the top
 * header): brand at the top, primary nav in the middle, source + account at
 * the bottom. Each control is an icon button with a tooltip/aria-label.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
    BookOpen,
    BookOpenText,
    ChevronLeft,
    ChevronRight,
    Code2,
    Compass,
    Flame,
    Gem,
    Globe,
    Images,
    Info,
    ListChecks,
    LogIn,
    LogOut,
    Server,
    Swords,
    Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PageType } from '../../shared'
import { useNavigation, useAuth, useBackgroundTasks, useApiStatus } from '../../app/hooks'
import type { ApiStatus } from '../../app/hooks'
import type { ApiDependencyService } from '@/infrastructure/api'
import { formatApiTime } from '@/utils/time'
import { Avatar, Badge, Icon, cx } from '../primitives'
import { LogoutConfirmDialog } from './LogoutConfirmDialog'

interface RailItem {
    page: PageType
    label: string
    icon: LucideIcon
    /** create pages require auth before navigating */
    gated?: boolean
}

// The three library items open the full galleries; the creators stay reachable
// from the dashboard AccessMenu and each gallery's "New …" button.
const NAV_ITEMS: RailItem[] = [
    { page: 'landing', label: 'Explore', icon: Compass },
    { page: 'gallery-characters', label: 'Characters', icon: Users, gated: true },
    { page: 'gallery-worlds', label: 'Worlds', icon: Globe, gated: true },
    { page: 'gallery-items', label: 'Items', icon: Gem, gated: true },
    { page: 'gallery-adventures', label: 'Adventures', icon: Swords, gated: true },
    { page: 'gallery-lorebooks', label: 'Lorebooks', icon: BookOpen, gated: true },
    { page: 'gallery-stories', label: 'Novels', icon: BookOpenText, gated: true },
    { page: 'gallery-media', label: 'Media', icon: Images, gated: true },
]

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'magic-worlds-sidebar-collapsed'

const API_STATUS_VIEW: Record<ApiStatus, { label: string; className: string; dotClassName: string }> = {
    checking: {
        label: 'Checking API status',
        className: 'text-parchment-300 bg-parchment-50/[.04]',
        dotClassName: 'bg-parchment-300 animate-pulse',
    },
    online: {
        label: 'API online',
        className: 'text-verdant-500 bg-verdant-500/10',
        dotClassName: 'bg-verdant-500',
    },
    offline: {
        label: 'API offline',
        className: 'text-blood-500 bg-blood-500/10',
        dotClassName: 'bg-blood-500',
    },
}

function serviceStatusLabel(status: string) {
    return status === 'ok' ? 'Online' : 'Offline'
}

function serviceStatusTone(status: string) {
    return status === 'ok' ? 'live' : 'nsfw'
}

function formatCheckedAt(checkedAt?: string) {
    if (!checkedAt) return 'Dependency details'
    const time = formatApiTime(checkedAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    return time ? `Last checked ${time}` : 'Dependency details'
}

function countOfflineServices(services: ApiDependencyService[]): number {
    return services.reduce((total, service) => {
        const children = service.components ?? []
        return total + (service.status === 'ok' ? 0 : 1) + countOfflineServices(children)
    }, 0)
}

function scrollMainToTop() {
    document.querySelector<HTMLElement>('[data-app-main]')?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
}

function RailTooltip({
    label,
    children,
    showOnDesktop = false,
    className,
}: {
    label: string
    children: ReactNode
    showOnDesktop?: boolean
    className?: string
}) {
    return (
        <div className={cx('group relative flex h-10 w-full items-center justify-center', className)}>
            {children}
            <div
                role="tooltip"
                className={cx(
                    'pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md border border-parchment-50/[.08] bg-ink-900 px-2.5 py-1.5 font-ui text-xs text-parchment-100 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
                    showOnDesktop ? 'lg:block' : 'lg:hidden',
                )}
            >
                {label}
            </div>
        </div>
    )
}

function RailButton({
    label,
    active = false,
    current = false,
    collapsed = false,
    danger = false,
    onClick,
    children,
    className,
}: {
    label: string
    active?: boolean
    current?: boolean
    collapsed?: boolean
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
                'inline-flex h-10 w-10 shrink-0 items-center justify-center gap-3 rounded-md px-0 font-ui text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 lg:w-full lg:justify-start lg:px-3',
                collapsed && 'lg:w-10 lg:justify-center lg:px-0',
                active
                    ? 'bg-ember-500/15 text-ember-400 hover:bg-ember-500/20'
                    : danger
                      ? 'text-parchment-200 hover:bg-parchment-50/[.05] hover:text-blood-500'
                      : 'text-parchment-200 hover:bg-parchment-50/[.05] hover:text-parchment-50',
                className,
            )}
        >
            {children}
            <span className={cx('hidden min-w-0 truncate', !collapsed && 'lg:inline')}>{label}</span>
        </button>
    )
}

function HealthDependencyRow({ service, depth = 0 }: { service: ApiDependencyService; depth?: number }) {
    const children = service.components ?? []
    const latency = typeof service.latency_ms === 'number' ? `${service.latency_ms}ms` : null
    return (
        <div className={cx(depth > 0 && 'pl-3')}>
            <div className="rounded-md border border-parchment-50/[.08] bg-ink-800/80 px-2.5 py-2">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate font-ui text-xs font-semibold text-parchment-100">{service.label}</p>
                        {service.message && (
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-parchment-300">
                                {service.message}
                            </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {latency && <span className="font-ui text-[10px] text-parchment-400">{latency}</span>}
                        <Badge tone={serviceStatusTone(service.status)} className="px-2 py-0.5 text-[10px]">
                            {serviceStatusLabel(service.status)}
                        </Badge>
                    </div>
                </div>
            </div>
            {children.length > 0 && (
                <div className="mt-1.5 space-y-1.5">
                    {children.map((child) => (
                        <HealthDependencyRow key={child.id} service={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    )
}

function ApiStatusIndicator({
    status,
    services = [],
    checkedAt,
    collapsed = false,
}: {
    status: ApiStatus
    services?: ApiDependencyService[]
    checkedAt?: string
    collapsed?: boolean
}) {
    const view = API_STATUS_VIEW[status]
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const offlineCount = countOfflineServices(services)
    const dependencySummary = services.length === 0
        ? 'Dependency details unavailable'
        : offlineCount > 0
            ? `${offlineCount} dependenc${offlineCount === 1 ? 'y' : 'ies'} offline`
            : 'All dependencies online'

    useEffect(() => {
        if (!open) return

        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false)
            }
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

    return (
        <div ref={containerRef} className="group relative w-full">
            <button
                type="button"
                aria-label={view.label}
                aria-expanded={open}
                aria-controls="api-health-dependencies"
                title={view.label}
                className={cx(
                    'relative inline-flex h-10 w-10 shrink-0 items-center justify-center gap-3 rounded-md px-0 font-ui text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 lg:w-full lg:justify-start lg:px-3',
                    collapsed && 'lg:w-10 lg:justify-center lg:px-0',
                    view.className,
                )}
                onClick={() => setOpen((current) => !current)}
            >
                <span role="status" aria-label={view.label} className="sr-only">
                    {view.label}
                </span>
                <Icon icon={Server} size={18} />
                <span className={cx('hidden min-w-0 truncate', !collapsed && 'lg:inline')}>{view.label}</span>
                <span
                    aria-hidden="true"
                    className={cx(
                        'absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-ink-900',
                        view.dotClassName,
                    )}
                />
            </button>
            <div
                role="tooltip"
                className={cx(
                    'pointer-events-none absolute bottom-1 left-full z-50 ml-2 whitespace-nowrap rounded-md border border-parchment-50/[.08] bg-ink-900 px-2.5 py-1.5 font-ui text-xs text-parchment-100 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
                    collapsed ? 'lg:block' : 'lg:hidden',
                )}
            >
                {view.label}
            </div>
            {open && (
                <div
                    id="api-health-dependencies"
                    role="dialog"
                    aria-label="Backend dependencies"
                    className="absolute bottom-0 left-full z-50 ml-3 w-[min(20rem,calc(100vw-5rem))] max-h-[min(32rem,calc(100vh-2rem))] overflow-y-auto rounded-lg border border-parchment-50/[.1] bg-ink-900 p-3 text-left shadow-2xl"
                >
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="font-ui text-sm font-semibold text-parchment-50">Backend dependencies</p>
                            <p className="mt-0.5 font-ui text-[11px] text-parchment-400">{formatCheckedAt(checkedAt)}</p>
                        </div>
                        <Badge tone={status === 'online' ? 'live' : status === 'offline' ? 'nsfw' : 'neutral'} className="shrink-0">
                            {status === 'checking' ? 'Checking' : serviceStatusLabel(status === 'online' ? 'ok' : 'offline')}
                        </Badge>
                    </div>
                    <p className="mb-2 font-ui text-xs text-parchment-300">{dependencySummary}</p>
                    {services.length > 0 ? (
                        <div className="space-y-1.5">
                            {services.map((service) => (
                                <HealthDependencyRow key={service.id} service={service} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border border-parchment-50/[.08] bg-ink-800/80 px-3 py-2 font-ui text-xs text-parchment-300">
                            The backend is reachable, but detailed dependency data is not available yet.
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export function Sidebar() {
    const { currentPage, setPage } = useNavigation()
    const { isAuthenticated, user, logout, openLoginModal } = useAuth()
    const { activeCount, openDrawer } = useBackgroundTasks()
    const { status: apiStatus, services, checkedAt } = useApiStatus()
    const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false
        return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
    })
    const sidebarTooltipOnDesktop = sidebarCollapsed
    const sidebarControlClass = sidebarCollapsed
        ? 'lg:w-10 lg:justify-center lg:px-0'
        : 'lg:w-full lg:justify-start lg:px-3'
    const sidebarLabelClass = cx('hidden min-w-0 truncate', !sidebarCollapsed && 'lg:inline')

    useEffect(() => {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, sidebarCollapsed ? 'true' : 'false')
    }, [sidebarCollapsed])

    const go = (item: RailItem) => {
        if (item.gated && !isAuthenticated) {
            openLoginModal()
            return
        }
        setPage(item.page)
    }

    const confirmLogout = () => {
        setConfirmLogoutOpen(false)
        logout()
    }

    return (
        <aside
            className={cx(
                'sticky top-0 z-40 flex h-screen w-16 shrink-0 flex-col items-center gap-2 border-r border-parchment-50/[.08] bg-ink-900/80 px-3 py-4 backdrop-blur-md transition-[width]',
                sidebarCollapsed ? 'lg:w-16 lg:items-center' : 'lg:w-56 lg:items-stretch',
            )}
            data-sidebar-collapsed={sidebarCollapsed}
        >
            <RailTooltip label="Home" showOnDesktop={sidebarTooltipOnDesktop}>
                <button
                    onClick={() => {
                        setPage('landing')
                        window.requestAnimationFrame(scrollMainToTop)
                    }}
                    aria-label="Magic Worlds — home"
                    title="Magic Worlds"
                    className={cx(
                        'inline-flex h-10 w-10 items-center justify-center gap-3 rounded-lg bg-ember-500/15 px-0 font-ui text-sm font-semibold text-ember-400 transition-colors hover:text-ember-300',
                        sidebarControlClass,
                    )}
                >
                    <Icon icon={Flame} size={20} />
                    <span className={sidebarLabelClass}>Magic Worlds</span>
                </button>
            </RailTooltip>

            <RailTooltip
                label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                showOnDesktop={sidebarTooltipOnDesktop}
                className="hidden lg:flex"
            >
                <button
                    type="button"
                    aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    aria-expanded={!sidebarCollapsed}
                    title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    onClick={() => setSidebarCollapsed((current) => !current)}
                    className={cx(
                        'hidden h-10 w-10 shrink-0 items-center justify-center gap-3 rounded-md px-0 font-ui text-sm font-semibold text-parchment-300 transition-colors hover:bg-parchment-50/[.05] hover:text-parchment-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 lg:inline-flex',
                        sidebarControlClass,
                    )}
                >
                    <Icon icon={sidebarCollapsed ? ChevronRight : ChevronLeft} size={18} />
                    <span className={sidebarLabelClass}>Collapse sidebar</span>
                </button>
            </RailTooltip>

            <nav
                className={cx(
                    'mt-2 flex flex-col items-center gap-1.5',
                    sidebarCollapsed ? 'lg:items-center' : 'lg:items-stretch',
                )}
                aria-label="Primary"
            >
                {NAV_ITEMS.map((item) => {
                    const active = currentPage === item.page
                    return (
                        <RailTooltip key={item.page} label={item.label} showOnDesktop={sidebarTooltipOnDesktop}>
                            <RailButton
                                label={item.label}
                                active={active}
                                current={active}
                                collapsed={sidebarCollapsed}
                                onClick={() => go(item)}
                            >
                                <Icon icon={item.icon} size={20} />
                            </RailButton>
                        </RailTooltip>
                    )
                })}
            </nav>

            <div className={cx(
                'mt-auto flex flex-col items-center gap-2',
                sidebarCollapsed ? 'lg:items-center' : 'lg:items-stretch',
            )}>
                <ApiStatusIndicator
                    status={apiStatus}
                    services={services}
                    checkedAt={checkedAt}
                    collapsed={sidebarCollapsed}
                />

                <RailTooltip label="Docs" showOnDesktop={sidebarTooltipOnDesktop}>
                    <RailButton
                        label="Docs"
                        active={currentPage === 'docs'}
                        current={currentPage === 'docs'}
                        collapsed={sidebarCollapsed}
                        onClick={() => setPage('docs')}
                    >
                        <Icon icon={Info} size={18} />
                    </RailButton>
                </RailTooltip>

                {isAuthenticated && (
                    <RailTooltip
                        label={activeCount > 0 ? `${activeCount} active task${activeCount === 1 ? '' : 's'}` : 'Tasks'}
                        showOnDesktop={sidebarTooltipOnDesktop}
                    >
                        <div className="relative w-full">
                            <RailButton
                                label={activeCount > 0 ? `${activeCount} active task${activeCount === 1 ? '' : 's'}` : 'Tasks'}
                                collapsed={sidebarCollapsed}
                                onClick={openDrawer}
                            >
                                <Icon icon={ListChecks} size={19} />
                            </RailButton>
                            {activeCount > 0 && (
                                <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-arcane-500 px-1 font-ui text-[10px] font-bold leading-none text-ink-900 ring-2 ring-ink-900">
                                    {activeCount > 9 ? '9+' : activeCount}
                                </span>
                            )}
                        </div>
                    </RailTooltip>
                )}

                <RailTooltip label="View source" showOnDesktop={sidebarTooltipOnDesktop}>
                    <a
                        href="https://github.com/Andres77872/magic-worlds"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View source on GitHub"
                        title="View on GitHub"
                        className={cx(
                            'inline-flex h-10 w-10 items-center justify-center gap-3 rounded-md px-0 font-ui text-sm font-semibold text-parchment-200 transition-colors hover:bg-parchment-50/[.05] hover:text-parchment-50',
                            sidebarControlClass,
                        )}
                    >
                        <Icon icon={Code2} size={18} />
                        <span className={sidebarLabelClass}>View source</span>
                    </a>
                </RailTooltip>

                {isAuthenticated ? (
                    <>
                        <RailTooltip label={user?.username ?? 'Your profile'} showOnDesktop={sidebarTooltipOnDesktop}>
                            <button
                                onClick={() => setPage('profile')}
                                aria-label="Your profile"
                                aria-current={currentPage === 'profile' ? 'page' : undefined}
                                title={user?.username ?? 'Your profile'}
                                className={cx(
                                    'mt-0.5 inline-flex h-10 w-10 items-center justify-center gap-3 rounded-full px-0 font-ui text-sm font-semibold text-parchment-200 transition-colors hover:bg-parchment-50/[.05] hover:text-parchment-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 lg:w-full lg:justify-start lg:rounded-md lg:px-1',
                                    sidebarCollapsed && 'lg:w-10 lg:justify-center lg:px-0',
                                    currentPage === 'profile' &&
                                        'ring-2 ring-ember-400 ring-offset-2 ring-offset-ink-900',
                                )}
                            >
                                <Avatar name={user?.username || 'You'} size={36} ring="ember" />
                                <span className={sidebarLabelClass}>{user?.username ?? 'Profile'}</span>
                            </button>
                        </RailTooltip>
                        <RailTooltip
                            label={user?.username ? `Log out ${user.username}` : 'Log out'}
                            showOnDesktop={sidebarTooltipOnDesktop}
                        >
                            <RailButton
                                label={user?.username ? `Log out ${user.username}` : 'Log out'}
                                danger
                                collapsed={sidebarCollapsed}
                                onClick={() => setConfirmLogoutOpen(true)}
                            >
                                <Icon icon={LogOut} size={18} />
                            </RailButton>
                        </RailTooltip>
                    </>
                ) : (
                    <RailTooltip label="Log in" showOnDesktop={sidebarTooltipOnDesktop}>
                        <RailButton label="Log in" active collapsed={sidebarCollapsed} onClick={openLoginModal}>
                            <Icon icon={LogIn} size={18} />
                        </RailButton>
                    </RailTooltip>
                )}
            </div>

            <LogoutConfirmDialog
                open={confirmLogoutOpen}
                username={user?.username}
                onCancel={() => setConfirmLogoutOpen(false)}
                onConfirm={confirmLogout}
            />
        </aside>
    )
}
