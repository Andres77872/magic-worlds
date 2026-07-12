import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, CheckCheck, CircleAlert, CircleCheck, Info, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { useBackgroundTasks, useNavigation } from '@/app/hooks'
import { pageFromHash } from '@/features/gallery/galleryLinks'
import { ApiError, apiService } from '@/infrastructure/api'
import type { NotificationSeverity, UserNotification } from '@/shared'
import { formatRelativeTime } from '@/utils/time'
import { EmptyState } from '@/ui/components'
import { Badge, Button, Card, Icon, IconButton, PageHeader } from '@/ui/primitives'

const severityIcon = {
    info: Info,
    success: CircleCheck,
    warning: TriangleAlert,
    error: CircleAlert,
} satisfies Record<NotificationSeverity, typeof Info>

const severityTone = {
    info: 'neutral',
    success: 'live',
    warning: 'ember',
    error: 'danger',
} as const satisfies Record<NotificationSeverity, 'neutral' | 'live' | 'ember' | 'danger'>

export function NotificationsPage() {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const { openDrawer: openTasks } = useBackgroundTasks()
    const [items, setItems] = useState<UserNotification[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [unreadOnly, setUnreadOnly] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set())
    const [markingAll, setMarkingAll] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async (quiet = false) => {
        if (quiet) setRefreshing(true)
        else setLoading(true)
        setError(null)
        try {
            const [response, unread] = await Promise.all([
                apiService.listNotifications({ unreadOnly, limit: 100 }),
                apiService.getNotificationUnreadCount(),
            ])
            setItems(response.items)
            setUnreadCount(unread.unread_count)
        } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : t('sidebar.notifications.errors.load'))
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [t, unreadOnly])

    useEffect(() => {
        void load()
    }, [load])

    const markRead = async (item: UserNotification): Promise<boolean> => {
        if (item.read_at) return true
        setPendingIds((current) => new Set(current).add(item.notification_id))
        setError(null)
        try {
            const updated = await apiService.markNotificationRead(item.notification_id)
            setItems((current) => unreadOnly
                ? current.filter((candidate) => candidate.notification_id !== updated.notification_id)
                : current.map((candidate) => candidate.notification_id === updated.notification_id ? updated : candidate))
            setUnreadCount((current) => Math.max(0, current - 1))
            return true
        } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : t('sidebar.notifications.errors.update'))
            return false
        } finally {
            setPendingIds((current) => {
                const next = new Set(current)
                next.delete(item.notification_id)
                return next
            })
        }
    }

    const markAllRead = async () => {
        setMarkingAll(true)
        setError(null)
        try {
            await apiService.markAllNotificationsRead()
            const now = new Date().toISOString()
            setItems((current) => unreadOnly ? [] : current.map((item) => item.read_at ? item : { ...item, read_at: now }))
            setUnreadCount(0)
        } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : t('sidebar.notifications.errors.update'))
        } finally {
            setMarkingAll(false)
        }
    }

    const dismiss = async (notificationId: number) => {
        const wasUnread = items.some((item) => item.notification_id === notificationId && !item.read_at)
        setPendingIds((current) => new Set(current).add(notificationId))
        setError(null)
        try {
            await apiService.dismissNotification(notificationId)
            setItems((current) => current.filter((item) => item.notification_id !== notificationId))
            if (wasUnread) setUnreadCount((current) => Math.max(0, current - 1))
        } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : t('sidebar.notifications.errors.update'))
        } finally {
            setPendingIds((current) => {
                const next = new Set(current)
                next.delete(notificationId)
                return next
            })
        }
    }

    const followAction = async (item: UserNotification) => {
        if (!(await markRead(item))) return
        const hash = item.action_url?.includes('#/') ? item.action_url.slice(item.action_url.indexOf('#/')) : null
        const page = hash ? pageFromHash(hash) : null
        if (page && hash) {
            setPage(page, { hash })
            return
        }
        if (item.metadata?.job_kind === 'theme_song') {
            openTasks()
            return
        }
        if (item.metadata?.job_kind === 'image') setPage('gallery-media')
    }

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            <PageHeader
                eyebrow={t('sidebar.notifications.eyebrow')}
                title={t('sidebar.notifications.title')}
                subtitle={t('sidebar.notifications.subtitle')}
                icon={<Icon icon={Bell} size={24} />}
                actions={(
                    <div className="flex flex-wrap gap-2">
                        <Badge tone={unreadCount > 0 ? 'ember' : 'neutral'} aria-live="polite">
                            {t('sidebar.notifications.unreadCount', { count: unreadCount })}
                        </Badge>
                        <Button variant="secondary" size="sm" onClick={() => setUnreadOnly((current) => !current)}>
                            {unreadOnly ? t('sidebar.notifications.showAll') : t('sidebar.notifications.unreadOnly')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={<Icon icon={CheckCheck} size={16} />}
                            disabled={unreadCount === 0 || markingAll}
                            onClick={() => void markAllRead()}
                        >
                            {t('sidebar.notifications.markAllRead')}
                        </Button>
                        <IconButton label={t('sidebar.notifications.refresh')} disabled={refreshing} onClick={() => void load(true)}>
                            <Icon icon={RefreshCw} size={17} className={refreshing ? 'animate-spin' : undefined} />
                        </IconButton>
                    </div>
                )}
                divider
            />

            {error && <p role="alert" className="rounded-lg border border-blood-500/30 bg-blood-500/10 p-4 font-ui text-sm text-parchment-100">{error}</p>}

            {!loading && items.length === 0 ? (
                <EmptyState
                    icon={<Icon icon={Bell} size={28} />}
                    message={unreadOnly ? t('sidebar.notifications.emptyUnread') : t('sidebar.notifications.empty')}
                    secondaryText={t('sidebar.notifications.emptyHint')}
                />
            ) : (
                <div className="flex flex-col gap-3" aria-busy={loading}>
                    {items.map((item) => {
                        const SeverityIcon = severityIcon[item.severity]
                        const actionable = Boolean(item.action_url || item.metadata?.job_kind)
                        const pending = pendingIds.has(item.notification_id)
                        return (
                            <Card key={item.notification_id} className={item.read_at ? 'opacity-80' : 'border-ember-500/25'}>
                                <div className="flex items-start gap-4 p-4">
                                    <div className="mt-0.5 rounded-md bg-ink-600 p-2 text-parchment-200">
                                        <Icon icon={SeverityIcon} size={18} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="font-display text-xl font-semibold text-parchment-50">{item.title}</h2>
                                            <Badge tone={severityTone[item.severity]}>{t(`sidebar.notifications.severity.${item.severity}`)}</Badge>
                                            {!item.read_at && <Badge tone="ember">{t('sidebar.notifications.new')}</Badge>}
                                        </div>
                                        <p className="mt-1 font-narrative text-base text-parchment-200">{item.body}</p>
                                        <p className="mt-2 font-mono text-caption text-parchment-400">{formatRelativeTime(item.created_at)}</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {actionable && (
                                                <Button variant="secondary" size="sm" disabled={pending} onClick={() => void followAction(item)}>
                                                    {item.action_label || t('sidebar.notifications.open')}
                                                </Button>
                                            )}
                                            {!item.read_at && (
                                                <Button variant="ghost" size="sm" disabled={pending} onClick={() => void markRead(item)}>
                                                    {t('sidebar.notifications.markRead')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <IconButton
                                        label={t('sidebar.notifications.dismiss')}
                                        size="sm"
                                        tone="danger"
                                        disabled={pending}
                                        onClick={() => void dismiss(item.notification_id)}
                                    >
                                        <Icon icon={Trash2} size={16} />
                                    </IconButton>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
