/**
 * Floating "Backend dependencies" status monitor — the popover opened from the
 * sidebar's API-status button. Anchored to the rail (not portaled, so it keeps
 * the existing outside-click + Escape dismissal, not the modal focus-trap), and
 * animates in with the app's overlay idiom (Drawer-style rise/scale). Extracted
 * from Sidebar.tsx and restyled to the Reverie design system.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Activity, Server } from 'lucide-react'
import type { ApiStatus } from '../../app/hooks'
import { useLanguage } from '../../app/hooks'
import type { ApiDependencyService } from '@/infrastructure/api'
import { formatApiTime } from '@/utils/time'
import { Badge, type BadgeTone, Icon, IconTile, Tooltip, cx } from '../primitives'

// Matches the Drawer transition so the popover enters/exits with the app's idiom.
const PANEL_TRANSITION_MS = 200

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

const STATUS_BADGE_TONE: Record<ApiStatus, BadgeTone> = {
    online: 'live',
    offline: 'danger',
    checking: 'neutral',
}

function serviceStatusLabel(status: string, t: TFunction) {
    return status === 'ok' ? t('sidebar.service.online') : t('sidebar.service.offline')
}

function serviceStatusTone(status: string): BadgeTone {
    return status === 'ok' ? 'live' : 'danger'
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

function HealthDependencyRow({
    service,
    checking,
    depth = 0,
    t,
}: {
    service: ApiDependencyService
    checking: boolean
    depth?: number
    t: TFunction
}) {
    const children = service.components ?? []
    const ok = service.status === 'ok'
    const latency = typeof service.latency_ms === 'number' ? `${service.latency_ms}ms` : null
    return (
        <div className={cx(depth > 0 && 'pl-3')}>
            <div className="flex items-start justify-between gap-3 rounded-md border border-parchment-50/[.06] bg-ink-700 px-2.5 py-2 transition-colors hover:bg-ink-600">
                <div className="flex min-w-0 items-start gap-2">
                    <span
                        aria-hidden="true"
                        className={cx(
                            'mt-1 h-2 w-2 shrink-0 rounded-full',
                            ok ? 'bg-verdant-500' : 'bg-blood-500',
                            checking && 'animate-pulse',
                        )}
                    />
                    <div className="min-w-0">
                        <p className="truncate font-ui text-xs font-semibold text-parchment-100">{service.label}</p>
                        {service.message && (
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-parchment-300">
                                {service.message}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    {latency && <span className="font-mono text-[10px] text-parchment-400">{latency}</span>}
                    <Badge tone={serviceStatusTone(service.status)} className="px-2 py-0.5 text-[10px]">
                        {serviceStatusLabel(service.status, t)}
                    </Badge>
                </div>
            </div>
            {children.length > 0 && (
                <div className="mt-1.5 space-y-1.5">
                    {children.map((child) => (
                        <HealthDependencyRow key={child.id} service={child} checking={checking} depth={depth + 1} t={t} />
                    ))}
                </div>
            )}
        </div>
    )
}

interface ApiStatusMonitorProps {
    status: ApiStatus
    services?: ApiDependencyService[]
    checkedAt?: string
    collapsed?: boolean
    /** Start with the dependencies popover open (stories / tests). */
    defaultOpen?: boolean
}

export function ApiStatusMonitor({ status, services = [], checkedAt, collapsed = false, defaultOpen = false }: ApiStatusMonitorProps) {
    const { t } = useTranslation()
    const { intlLocale } = useLanguage()
    const view = API_STATUS_VIEW[status]
    const viewLabel = t(view.labelKey)
    const [open, setOpen] = useState(defaultOpen)
    // Drawer-style mount/enter: keep mounted through the exit transition, then drop.
    const [mounted, setMounted] = useState(defaultOpen)
    const [entered, setEntered] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const offlineCount = countOfflineServices(services)
    const dependencySummary =
        services.length === 0
            ? t('sidebar.api.unavailable')
            : offlineCount > 0
              ? t('sidebar.api.offlineSummary', { count: offlineCount })
              : t('sidebar.api.allOnline')

    // Dismiss on outside pointer-down or Escape (anchored popover, not a modal).
    useEffect(() => {
        if (!open) return
        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
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
            <Tooltip label={viewLabel} disabled={!collapsed} wrapperClassName="w-full">
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
                        className={cx('absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-ink-900', view.dotClassName)}
                    />
                </button>
            </Tooltip>
            {mounted && (
                <div
                    id="api-health-dependencies"
                    role="dialog"
                    aria-label={t('sidebar.api.dependenciesTitle')}
                    className={cx(
                        'absolute bottom-0 left-full z-50 ml-3 flex max-h-[min(32rem,calc(100vh-2rem))] w-[min(20rem,calc(100vw-5rem))] origin-bottom-left flex-col overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800 text-left shadow-lg transition-[opacity,transform] duration-200 ease-out',
                        entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-1 scale-[.98] opacity-0',
                    )}
                >
                    <div className="flex items-start justify-between gap-3 border-b border-parchment-50/10 p-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <IconTile icon={Activity} tone="ember" size="sm" />
                            <div className="min-w-0">
                                <p className="truncate font-ui text-sm font-semibold text-parchment-50">
                                    {t('sidebar.api.dependenciesTitle')}
                                </p>
                                <p className="mt-0.5 font-mono text-[11px] text-parchment-400">
                                    {formatCheckedAt(checkedAt, t, intlLocale)}
                                </p>
                            </div>
                        </div>
                        <Badge tone={STATUS_BADGE_TONE[status]} className="shrink-0">
                            {status === 'checking'
                                ? t('sidebar.api.checkingShort')
                                : serviceStatusLabel(status === 'online' ? 'ok' : 'offline', t)}
                        </Badge>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                        <p className="mb-2 font-ui text-xs text-parchment-300">{dependencySummary}</p>
                        {services.length > 0 ? (
                            <div className="space-y-1.5">
                                {services.map((service) => (
                                    <HealthDependencyRow
                                        key={service.id}
                                        service={service}
                                        checking={status === 'checking'}
                                        t={t}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-md border border-parchment-50/[.08] bg-ink-700 px-3 py-2 font-ui text-xs text-parchment-300">
                                {t('sidebar.api.detailsUnavailable')}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
