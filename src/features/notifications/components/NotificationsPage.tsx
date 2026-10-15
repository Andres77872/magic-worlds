import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, CheckCheck, CircleAlert, CircleCheck, Info, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { useAuth, useBackgroundTasks, useNavigation } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { pageNeedsWorkspace } from '@/app/router/pageAccess'
import { pageFromHash } from '@/features/gallery/galleryLinks'
import { useOriginNavigation, type OriginTarget } from '@/features/workspaces/originNavigation'
import { ApiError, apiService } from '@/infrastructure/api'
import { isWorkspaceUuid } from '@/infrastructure/api/workspaceContract'
import type { BackgroundTaskPublic, NotificationSeverity, UserNotification } from '@/shared'
import { formatRelativeTime } from '@/utils/time'
import { EmptyState, LoadingSpinner } from '@/ui/components'
import { WorkspaceOriginLabel } from '@/ui/components/WorkspaceOriginLabel'
import { Badge, Button, Callout, Icon, IconButton, PageHeader } from '@/ui/primitives'
import { notificationActionAvailable } from '../notificationAvailability'

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

const NOTIFICATION_PAGE_SIZE = 20

function metadataString(item: UserNotification, key: string): string | null {
    const value = item.metadata?.[key]
    return typeof value === 'string' && value ? value : null
}

/** The `#/…` route of a notice's action, if it has one. */
function actionHash(item: UserNotification): string | null {
    return item.action_url?.includes('#/') ? item.action_url.slice(item.action_url.indexOf('#/')) : null
}

/**
 * Workspace R1: the inbox is account-wide. A content notice (a generation job,
 * or an action into workspace content) opens in the workspace it came from:
 * `metadata.workspace_id`, else the workspace of a job this client tracks. A
 * legacy notice without either never falls back to the selected workspace.
 */
function noticeOrigin(item: UserNotification, tasks: BackgroundTaskPublic[]): string | null {
    const stated = metadataString(item, 'workspace_id')
    if (stated) return isWorkspaceUuid(stated) ? stated : null
    const jobId = metadataString(item, 'job_id')
    if (!jobId) return null
    const owned = tasks.find((task) => task.task_id === jobId && task.organization?.workspace_id)
    return owned?.organization?.workspace_id ?? null
}

function isContentNotice(item: UserNotification, isAuthenticated: boolean): boolean {
    if (metadataString(item, 'workspace_id') || metadataString(item, 'job_kind') || metadataString(item, 'job_id')) return true
    const hash = actionHash(item)
    const page = hash ? pageFromHash(hash) : null
    return Boolean(page && pageNeedsWorkspace(page, isAuthenticated))
}

export function NotificationsPage() {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const { isAuthenticated } = useAuth()
    const { openDrawer: openTasks, tasks, trackTask } = useBackgroundTasks()
    const { selectedWorkspaceId } = useWorkspace()
    const { navigateToOrigin } = useOriginNavigation()
    /** Notices whose target is no longer available (missing, hidden or unknown workspace). */
    const [unavailableIds, setUnavailableIds] = useState<Set<number>>(() => new Set())
    const [items, setItems] = useState<UserNotification[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [unreadOnly, setUnreadOnly] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set())
    const [markingAll, setMarkingAll] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)

    // Only the newest load may commit. `load` runs from the unreadOnly effect AND
    // straight from the Refresh button, so toggling the filter while a request is
    // in flight could let the slower, earlier response repaint the list with the
    // wrong filter — and leave `hasMore` describing a page nobody is looking at.
    const loadSeqRef = useRef(0)

    const load = useCallback(async (quiet = false) => {
        const seq = ++loadSeqRef.current
        if (quiet) setRefreshing(true)
        else setLoading(true)
        setError(null)
        try {
            const [response, unread] = await Promise.all([
                apiService.listNotifications({ unreadOnly, limit: NOTIFICATION_PAGE_SIZE, offset: 0 }),
                apiService.getNotificationUnreadCount(),
            ])
            if (seq !== loadSeqRef.current) return
            setItems(response.items)
            setHasMore(response.items.length === response.limit)
            setUnreadCount(unread.unread_count)
        } catch (cause) {
            if (seq !== loadSeqRef.current) return
            setError(cause instanceof ApiError ? cause.message : t('sidebar.notifications.errors.load'))
        } finally {
            if (seq === loadSeqRef.current) {
                setLoading(false)
                setRefreshing(false)
            }
        }
    }, [t, unreadOnly])

    const loadMore = async () => {
        if (!hasMore || loadingMore) return
        // Take a ticket without incrementing: appending a page must not invalidate
        // an in-flight refresh, but a refresh started meanwhile must invalidate
        // this append — otherwise its rows land in a list filtered differently.
        const seq = loadSeqRef.current
        setLoadingMore(true)
        setError(null)
        try {
            const response = await apiService.listNotifications({
                unreadOnly,
                limit: NOTIFICATION_PAGE_SIZE,
                offset: items.length,
            })
            if (seq !== loadSeqRef.current) return
            setItems((current) => {
                const seen = new Set(current.map((item) => item.notification_id))
                return [...current, ...response.items.filter((item) => !seen.has(item.notification_id))]
            })
            setHasMore(response.items.length === response.limit)
        } catch (cause) {
            if (seq !== loadSeqRef.current) return
            setError(cause instanceof ApiError ? cause.message : t('sidebar.notifications.errors.load'))
        } finally {
            setLoadingMore(false)
        }
    }

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

    const markUnavailable = (notificationId: number) =>
        setUnavailableIds((current) => new Set(current).add(notificationId))

    const followAction = async (item: UserNotification) => {
        if (!notificationActionAvailable(item)) return
        if (!(await markRead(item))) return
        const hash = actionHash(item)
        const page = hash ? pageFromHash(hash) : null
        if (!isContentNotice(item, isAuthenticated)) {
            // Account notices (membership, credits, …) are not workspace content.
            if (page && hash) setPage(page, { hash })
            return
        }
        const origin = noticeOrigin(item, tasks)
        if (!origin) {
            markUnavailable(item.notification_id)
            return
        }
        const jobKind = metadataString(item, 'job_kind')
        const jobId = metadataString(item, 'job_id')
        if (!(page && hash) && jobKind === 'theme_song') {
            // The tasks drawer is account-wide; another workspace's task is read there and labeled.
            if (origin !== selectedWorkspaceId && jobId && trackTask) {
                try {
                    await trackTask('theme_song', jobId, origin)
                } catch {
                    markUnavailable(item.notification_id)
                    return
                }
            }
            openTasks()
            return
        }
        const target: Omit<OriginTarget, 'workspaceId'> | null = page && hash
            ? { page, hash }
            : jobKind === 'image' ? { page: 'gallery-media' } : null
        if (!target) return
        const outcome = await navigateToOrigin({ workspaceId: origin, ...target })
        if (outcome === 'unavailable') markUnavailable(item.notification_id)
    }

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
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
                        <Button variant="secondary" size="sm" aria-pressed={unreadOnly} onClick={() => setUnreadOnly((current) => !current)}>
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

            {loading ? (
                <div className="py-12"><LoadingSpinner /></div>
            ) : items.length === 0 && !error ? (
                <EmptyState
                    icon={<Icon icon={Bell} size={28} />}
                    message={unreadOnly ? t('sidebar.notifications.emptyUnread') : t('sidebar.notifications.empty')}
                    secondaryText={t('sidebar.notifications.emptyHint')}
                />
            ) : (
                <div className="flex flex-col" aria-busy={loading}>
                    {items.map((item) => {
                        const SeverityIcon = severityIcon[item.severity]
                        const actionable = notificationActionAvailable(item) && Boolean(item.action_url || item.metadata?.job_kind)
                        const pending = pendingIds.has(item.notification_id)
                        return (
                            <article key={item.notification_id} className="flex items-start gap-3 border-b border-line-faint py-5 last:border-b-0 sm:gap-4">
                                <div className="mt-1 hidden text-parchment-300 sm:block">
                                    <Icon icon={SeverityIcon} size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="font-ui text-body font-semibold text-parchment-50">{item.title}</h2>
                                        <Badge tone={severityTone[item.severity]}>{t(`sidebar.notifications.severity.${item.severity}`)}</Badge>
                                        {!item.read_at && <Badge tone="ember">{t('sidebar.notifications.new')}</Badge>}
                                        <WorkspaceOriginLabel workspaceId={noticeOrigin(item, tasks)} />
                                    </div>
                                    <p className="mt-1 break-words font-ui text-body text-parchment-200">{item.body}</p>
                                    <p className="mt-2 font-mono text-caption text-parchment-400">{formatRelativeTime(item.created_at)}</p>
                                    {unavailableIds.has(item.notification_id) && (
                                        <Callout tone="warning" role="status" className="mt-3">
                                            {t('workspaceActivity.notifications.unavailable')}
                                        </Callout>
                                    )}
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
                            </article>
                        )
                    })}
                    {hasMore && (
                        <Button variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>
                            {loadingMore ? t('sidebar.notifications.loadingMore') : t('sidebar.notifications.loadMore')}
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
