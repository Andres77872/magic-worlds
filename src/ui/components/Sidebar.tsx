/**
 * App sidebar — Reverie. A slim, full-height icon rail (replaces the top
 * header): brand at the top, primary nav in the middle, source + account at
 * the bottom. Each control is an icon button with a tooltip/aria-label.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
    AudioLines,
    BookOpen,
    BookOpenText,
    Bot,
    CirclePlay,
    Crown,
    ChevronDown,
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
    MessageCircle,
    Phone,
    Server,
    Sparkles,
    Swords,
    Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PageType } from '../../shared'
import { isFrontendVoiceModeEnabled } from '../../shared/voiceFeatureFlag'
import { useNavigation, useAuth, useBackgroundTasks, useApiStatus, useLanguage } from '../../app/hooks'
import type { ApiStatus } from '../../app/hooks'
import type { ApiDependencyService } from '@/infrastructure/api'
import { formatApiTime } from '@/utils/time'
import { Avatar, Badge, Eyebrow, Icon, cx } from '../primitives'
import { LanguageSelectorDialog } from './LanguageSelectorDialog'
import { LogoutConfirmDialog } from './LogoutConfirmDialog'

interface RailItem {
    page: PageType
    labelKey: string
    icon: LucideIcon
    /** create pages require auth before navigating */
    gated?: boolean
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
    { page: 'community', labelKey: 'sidebar.nav.community', icon: Sparkles, gated: true },
    { page: 'gallery-stories', labelKey: 'sidebar.nav.stories', icon: BookOpenText, gated: true },
]

// Collapsible sections. The library items open the full galleries; the creators
// stay reachable from the dashboard AccessMenu and each gallery's "New …" button.
const NAV_GROUPS: NavGroup[] = [
    {
        id: 'activity',
        labelKey: 'sidebar.group.activity',
        items: [
            { page: 'chatroom', labelKey: 'sidebar.nav.chatroom', icon: MessageCircle, gated: true },
            { page: 'active-adventures', labelKey: 'sidebar.nav.activeAdventures', icon: CirclePlay, gated: true },
            { page: 'calls', labelKey: 'sidebar.nav.calls', icon: Phone, gated: true },
        ],
    },
    {
        id: 'library',
        labelKey: 'sidebar.group.library',
        items: [
            { page: 'gallery-characters', labelKey: 'sidebar.nav.characters', icon: Users, gated: true },
            { page: 'gallery-worlds', labelKey: 'sidebar.nav.worlds', icon: Globe, gated: true },
            { page: 'gallery-items', labelKey: 'sidebar.nav.items', icon: Gem, gated: true },
            { page: 'gallery-adventures', labelKey: 'sidebar.nav.adventures', icon: Swords, gated: true },
        ],
    },
    {
        id: 'assets',
        labelKey: 'sidebar.group.assets',
        items: [
            { page: 'gallery-lorebooks', labelKey: 'sidebar.nav.lorebooks', icon: BookOpen, gated: true },
            { page: 'gallery-media', labelKey: 'sidebar.nav.media', icon: Images, gated: true },
            { page: 'voice-studio', labelKey: 'sidebar.nav.voices', icon: AudioLines, gated: true },
        ],
    },
]

/** Items hidden behind a feature flag are filtered out before render. */
function isItemVisible(item: RailItem): boolean {
    if (item.page === 'calls') return isFrontendVoiceModeEnabled()
    return true
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'magic-worlds-sidebar-collapsed'
const SIDEBAR_GROUPS_STORAGE_KEY = 'magic-worlds-sidebar-groups'

const API_STATUS_VIEW: Record<ApiStatus, { labelKey: string; className: string; dotClassName: string }> = {
    checking: {
        labelKey: 'sidebar.api.checking',
        className: 'text-parchment-300 bg-parchment-50/[.04]',
        dotClassName: 'bg-parchment-300 animate-pulse',
    },
    online: {
        labelKey: 'sidebar.api.online',
        className: 'text-verdant-500 bg-verdant-500/10',
        dotClassName: 'bg-verdant-500',
    },
    offline: {
        labelKey: 'sidebar.api.offline',
        className: 'text-blood-500 bg-blood-500/10',
        dotClassName: 'bg-blood-500',
    },
}

function serviceStatusLabel(status: string, t: TFunction) {
    return status === 'ok' ? t('sidebar.service.online') : t('sidebar.service.offline')
}

function serviceStatusTone(status: string) {
    return status === 'ok' ? 'live' : 'nsfw'
}

function formatCheckedAt(checkedAt: string | undefined, t: TFunction, locale: string) {
    if (!checkedAt) return t('sidebar.api.dependencyDetails')
    const time = formatApiTime(checkedAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' }, locale)
    return time ? t('sidebar.api.lastChecked', { time }) : t('sidebar.api.dependencyDetails')
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

function NavItemButton({
    item,
    active,
    collapsed,
    tooltipOnDesktop,
    onClick,
}: {
    item: RailItem
    active: boolean
    collapsed: boolean
    tooltipOnDesktop: boolean
    onClick: () => void
}) {
    const { t } = useTranslation()
    const label = t(item.labelKey)
    return (
        <RailTooltip label={label} showOnDesktop={tooltipOnDesktop}>
            <RailButton label={label} active={active} current={active} collapsed={collapsed} onClick={onClick}>
                <Icon icon={item.icon} size={20} />
            </RailButton>
        </RailTooltip>
    )
}

function HealthDependencyRow({
    service,
    depth = 0,
    t,
}: {
    service: ApiDependencyService
    depth?: number
    t: TFunction
}) {
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
                            {serviceStatusLabel(service.status, t)}
                        </Badge>
                    </div>
                </div>
            </div>
            {children.length > 0 && (
                <div className="mt-1.5 space-y-1.5">
                    {children.map((child) => (
                        <HealthDependencyRow key={child.id} service={child} depth={depth + 1} t={t} />
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
    const { t } = useTranslation()
    const { intlLocale } = useLanguage()
    const view = API_STATUS_VIEW[status]
    const viewLabel = t(view.labelKey)
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const offlineCount = countOfflineServices(services)
    const dependencySummary = services.length === 0
        ? t('sidebar.api.unavailable')
        : offlineCount > 0
            ? t('sidebar.api.offlineSummary', { count: offlineCount })
            : t('sidebar.api.allOnline')

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
                aria-label={viewLabel}
                aria-expanded={open}
                aria-controls="api-health-dependencies"
                title={viewLabel}
                className={cx(
                    'relative inline-flex h-10 w-10 shrink-0 items-center justify-center gap-3 rounded-md px-0 font-ui text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 lg:w-full lg:justify-start lg:px-3',
                    collapsed && 'lg:w-10 lg:justify-center lg:px-0',
                    view.className,
                )}
                onClick={() => setOpen((current) => !current)}
            >
                <span role="status" aria-label={viewLabel} className="sr-only">
                    {viewLabel}
                </span>
                <Icon icon={Server} size={18} />
                <span className={cx('hidden min-w-0 truncate', !collapsed && 'lg:inline')}>{viewLabel}</span>
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
                {viewLabel}
            </div>
            {open && (
                <div
                    id="api-health-dependencies"
                    role="dialog"
                    aria-label={t('sidebar.api.dependenciesTitle')}
                    className="absolute bottom-0 left-full z-50 ml-3 w-[min(20rem,calc(100vw-5rem))] max-h-[min(32rem,calc(100vh-2rem))] overflow-y-auto rounded-lg border border-parchment-50/[.1] bg-ink-900 p-3 text-left shadow-2xl"
                >
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="font-ui text-sm font-semibold text-parchment-50">{t('sidebar.api.dependenciesTitle')}</p>
                            <p className="mt-0.5 font-ui text-[11px] text-parchment-400">{formatCheckedAt(checkedAt, t, intlLocale)}</p>
                        </div>
                        <Badge tone={status === 'online' ? 'live' : status === 'offline' ? 'nsfw' : 'neutral'} className="shrink-0">
                            {status === 'checking' ? t('sidebar.api.checkingShort') : serviceStatusLabel(status === 'online' ? 'ok' : 'offline', t)}
                        </Badge>
                    </div>
                    <p className="mb-2 font-ui text-xs text-parchment-300">{dependencySummary}</p>
                    {services.length > 0 ? (
                        <div className="space-y-1.5">
                            {services.map((service) => (
                                <HealthDependencyRow key={service.id} service={service} t={t} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border border-parchment-50/[.08] bg-ink-800/80 px-3 py-2 font-ui text-xs text-parchment-300">
                            {t('sidebar.api.detailsUnavailable')}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export function Sidebar() {
    const { t } = useTranslation()
    const { currentPage, setPage } = useNavigation()
    const { isAuthenticated, user, logout, openLoginModal } = useAuth()
    const { activeCount, openDrawer } = useBackgroundTasks()
    const { status: apiStatus, services, checkedAt } = useApiStatus()
    const { option: languageOption } = useLanguage()
    const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
    const [languageDialogOpen, setLanguageDialogOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false
        return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
    })
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
    const sidebarTooltipOnDesktop = sidebarCollapsed
    const isRoot = isAuthenticated && user?.user_type === 'root'
    const sidebarControlClass = sidebarCollapsed
        ? 'lg:w-10 lg:justify-center lg:px-0'
        : 'lg:w-full lg:justify-start lg:px-3'
    const sidebarLabelClass = cx('hidden min-w-0 truncate', !sidebarCollapsed && 'lg:inline')

    useEffect(() => {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, sidebarCollapsed ? 'true' : 'false')
    }, [sidebarCollapsed])

    useEffect(() => {
        window.localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(collapsedGroups))
    }, [collapsedGroups])

    const toggleGroup = (id: string) => {
        setCollapsedGroups((current) => ({ ...current, [id]: !current[id] }))
    }

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
            <RailTooltip label={t('sidebar.home')} showOnDesktop={sidebarTooltipOnDesktop}>
                <button
                    onClick={() => {
                        setPage('landing')
                        window.requestAnimationFrame(scrollMainToTop)
                    }}
                    aria-label={t('sidebar.homeButton')}
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
                label={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                showOnDesktop={sidebarTooltipOnDesktop}
                className="hidden lg:flex"
            >
                <button
                    type="button"
                    aria-label={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                    aria-expanded={!sidebarCollapsed}
                    title={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                    onClick={() => setSidebarCollapsed((current) => !current)}
                    className={cx(
                        'hidden h-10 w-10 shrink-0 items-center justify-center gap-3 rounded-md px-0 font-ui text-sm font-semibold text-parchment-300 transition-colors hover:bg-parchment-50/[.05] hover:text-parchment-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 lg:inline-flex',
                        sidebarControlClass,
                    )}
                >
                    <Icon icon={sidebarCollapsed ? ChevronRight : ChevronLeft} size={18} />
                    <span className={sidebarLabelClass}>{t('sidebar.collapse')}</span>
                </button>
            </RailTooltip>

            <nav
                className={cx(
                    'mt-2 flex flex-col items-center gap-1.5',
                    sidebarCollapsed ? 'lg:items-center' : 'lg:items-stretch',
                )}
                aria-label={t('sidebar.primaryNav')}
            >
                {NAV_PRIMARY.filter(isItemVisible).map((item) => (
                    <NavItemButton
                        key={item.page}
                        item={item}
                        active={currentPage === item.page}
                        collapsed={sidebarCollapsed}
                        tooltipOnDesktop={sidebarTooltipOnDesktop}
                        onClick={() => go(item)}
                    />
                ))}

                {NAV_GROUPS.map((group) => {
                    const items = group.items.filter(isItemVisible)
                    if (items.length === 0) return null
                    const groupCollapsed = Boolean(collapsedGroups[group.id])
                    const groupLabel = t(group.labelKey)
                    const regionId = `sidebar-group-${group.id}`
                    return (
                        <div
                            key={group.id}
                            className={cx(
                                'flex w-full flex-col gap-1.5',
                                sidebarCollapsed ? 'items-center' : 'items-center lg:items-stretch',
                            )}
                        >
                            {/* Icon-rail / mobile separator — shown only where the header is hidden. */}
                            <div
                                aria-hidden="true"
                                className={cx(
                                    'mx-auto my-1 h-px w-6 rounded-full bg-parchment-50/[.08]',
                                    !sidebarCollapsed && 'lg:hidden',
                                )}
                            />
                            {/* Group header — desktop-expanded only; toggles the fold. */}
                            <button
                                type="button"
                                onClick={() => toggleGroup(group.id)}
                                aria-expanded={!groupCollapsed}
                                aria-controls={regionId}
                                className={cx(
                                    'hidden items-center justify-between rounded-md px-3 pb-1 pt-2 text-left transition-colors hover:bg-parchment-50/[.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
                                    !sidebarCollapsed && 'lg:flex',
                                )}
                            >
                                <Eyebrow tone="muted">{groupLabel}</Eyebrow>
                                <Icon
                                    icon={groupCollapsed ? ChevronRight : ChevronDown}
                                    size={14}
                                    className="text-parchment-500"
                                />
                            </button>
                            {/* Animated items region — folds on the desktop-expanded rail only. */}
                            <div
                                id={regionId}
                                className={cx(
                                    'grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out',
                                    !sidebarCollapsed && groupCollapsed ? 'grid-rows-[1fr] lg:grid-rows-[0fr]' : 'grid-rows-[1fr]',
                                )}
                            >
                                <div
                                    className={cx(
                                        'flex min-h-0 flex-col gap-1.5',
                                        sidebarCollapsed ? 'items-center' : 'items-center lg:items-stretch',
                                    )}
                                >
                                    {items.map((item) => (
                                        <NavItemButton
                                            key={item.page}
                                            item={item}
                                            active={currentPage === item.page}
                                            collapsed={sidebarCollapsed}
                                            tooltipOnDesktop={sidebarTooltipOnDesktop}
                                            onClick={() => go(item)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
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

                <RailTooltip label={t('language.button', { language: languageOption.nativeLabel })} showOnDesktop={sidebarTooltipOnDesktop}>
                    <RailButton
                        label={t('language.button', { language: languageOption.nativeLabel })}
                        collapsed={sidebarCollapsed}
                        onClick={() => setLanguageDialogOpen(true)}
                    >
                        <Icon icon={Globe} size={18} />
                    </RailButton>
                </RailTooltip>

                <RailTooltip label={t('sidebar.docs')} showOnDesktop={sidebarTooltipOnDesktop}>
                    <RailButton
                        label={t('sidebar.docs')}
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
                        label={activeCount > 0 ? t('sidebar.activeTasks', { count: activeCount }) : t('sidebar.tasks')}
                        showOnDesktop={sidebarTooltipOnDesktop}
                    >
                        <div className="relative w-full">
                            <RailButton
                                label={activeCount > 0 ? t('sidebar.activeTasks', { count: activeCount }) : t('sidebar.tasks')}
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

                {isRoot && (
                    <RailTooltip label={t('sidebar.voiceAdmin')} showOnDesktop={sidebarTooltipOnDesktop}>
                        <RailButton
                            label={t('sidebar.voiceAdmin')}
                            active={currentPage === 'admin-voices'}
                            current={currentPage === 'admin-voices'}
                            collapsed={sidebarCollapsed}
                            onClick={() => setPage('admin-voices')}
                        >
                            <Icon icon={Crown} size={18} />
                        </RailButton>
                    </RailTooltip>
                )}

                {isRoot && (
                    <RailTooltip label={t('sidebar.agentAdmin')} showOnDesktop={sidebarTooltipOnDesktop}>
                        <RailButton
                            label={t('sidebar.agentAdmin')}
                            active={currentPage === 'admin-agents'}
                            current={currentPage === 'admin-agents'}
                            collapsed={sidebarCollapsed}
                            onClick={() => setPage('admin-agents')}
                        >
                            <Icon icon={Bot} size={18} />
                        </RailButton>
                    </RailTooltip>
                )}

                <RailTooltip label={t('sidebar.viewSource')} showOnDesktop={sidebarTooltipOnDesktop}>
                    <a
                        href="https://github.com/Andres77872/magic-worlds"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('sidebar.viewSourceAria')}
                        title={t('sidebar.viewSourceAria')}
                        className={cx(
                            'inline-flex h-10 w-10 items-center justify-center gap-3 rounded-md px-0 font-ui text-sm font-semibold text-parchment-200 transition-colors hover:bg-parchment-50/[.05] hover:text-parchment-50',
                            sidebarControlClass,
                        )}
                    >
                        <Icon icon={Code2} size={18} />
                        <span className={sidebarLabelClass}>{t('sidebar.viewSource')}</span>
                    </a>
                </RailTooltip>

                {isAuthenticated ? (
                    <>
                        <RailTooltip label={user?.username ?? t('sidebar.yourProfile')} showOnDesktop={sidebarTooltipOnDesktop}>
                            <button
                                onClick={() => setPage('profile')}
                                aria-label={t('sidebar.yourProfile')}
                                aria-current={currentPage === 'profile' ? 'page' : undefined}
                                title={user?.username ?? t('sidebar.yourProfile')}
                                className={cx(
                                    'mt-0.5 inline-flex h-10 w-10 items-center justify-center gap-3 rounded-full px-0 font-ui text-sm font-semibold text-parchment-200 transition-colors hover:bg-parchment-50/[.05] hover:text-parchment-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 lg:w-full lg:justify-start lg:rounded-md lg:px-1',
                                    sidebarCollapsed && 'lg:w-10 lg:justify-center lg:px-0',
                                    currentPage === 'profile' &&
                                        'ring-2 ring-ember-400 ring-offset-2 ring-offset-ink-900',
                                )}
                            >
                                <Avatar name={user?.username || 'You'} size={36} ring="ember" />
                                <span className={sidebarLabelClass}>{user?.username ?? t('sidebar.profile')}</span>
                            </button>
                        </RailTooltip>
                        <RailTooltip
                            label={user?.username ? t('sidebar.logoutUser', { username: user.username }) : t('sidebar.logout')}
                            showOnDesktop={sidebarTooltipOnDesktop}
                        >
                            <RailButton
                                label={user?.username ? t('sidebar.logoutUser', { username: user.username }) : t('sidebar.logout')}
                                danger
                                collapsed={sidebarCollapsed}
                                onClick={() => setConfirmLogoutOpen(true)}
                            >
                                <Icon icon={LogOut} size={18} />
                            </RailButton>
                        </RailTooltip>
                    </>
                ) : (
                    <RailTooltip label={t('sidebar.login')} showOnDesktop={sidebarTooltipOnDesktop}>
                        <RailButton label={t('sidebar.login')} active collapsed={sidebarCollapsed} onClick={openLoginModal}>
                            <Icon icon={LogIn} size={18} />
                        </RailButton>
                    </RailTooltip>
                )}
            </div>

            <LanguageSelectorDialog
                open={languageDialogOpen}
                onClose={() => setLanguageDialogOpen(false)}
            />

            <LogoutConfirmDialog
                open={confirmLogoutOpen}
                username={user?.username}
                onCancel={() => setConfirmLogoutOpen(false)}
                onConfirm={confirmLogout}
            />
        </aside>
    )
}
