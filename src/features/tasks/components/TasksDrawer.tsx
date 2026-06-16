import { useMemo, useState } from 'react'
import { AlertCircle, BookOpen, CalendarClock, CheckCircle2, Clock3, FileAudio, Loader2, Music2, RefreshCw, XCircle } from 'lucide-react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useBackgroundTasks, useData } from '@/app/hooks'
import { apiService, resolveMediaUrl } from '@/infrastructure/api'
import type { Adventure, BackgroundTaskBuckets, BackgroundTaskPublic, CardMediaTargetType, Character, Item, World } from '@/shared'
import { readWorldPlaceType, worldPlaceTypeLabel } from '@/shared'
import { transformCharacters, transformItems, transformTemplates, transformWorlds } from '@/utils/cardTransforms'
import { formatApiDateTime, formatRelativeTime } from '@/utils/time'
import { AudioWavePlayer } from '@/ui/components/audio'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'
import { Card as DomainCard } from '@/ui/components/lists/Card'
import { Badge, Button, Drawer, Eyebrow, Icon, Modal, Tag, cx } from '@/ui/primitives'

const ACTIVE = new Set(['pending', 'in_progress', 'synthesizing', 'mirroring'])
const TAB_ORDER = ['active', 'completed', 'failed'] as const

type TaskTab = (typeof TAB_ORDER)[number]

interface AttachedCardPreview {
    id: string
    type: CardMediaTargetType
    title: string
    badge?: string
    description?: string
    imageUrl?: string
    themeSongUrl?: string
    triggers: string[]
    categories?: Array<{ name: string; description?: string; attributes?: Array<Record<string, string>> }>
    createdAt?: string
    updatedAt?: string
}

const EMPTY_ICON: Record<TaskTab, typeof Music2> = {
    active: Music2,
    completed: CheckCircle2,
    failed: XCircle,
}

type StatusTone = 'live' | 'nsfw' | 'arcane'

const TILE_TONE: Record<StatusTone, string> = {
    live: 'bg-verdant-500/12 text-verdant-500',
    nsfw: 'bg-blood-500/12 text-blood-500',
    arcane: 'bg-arcane-500/12 text-arcane-300',
}

function statusCopy(status: BackgroundTaskPublic['status'], t: TFunction): string {
    return t(`tasksDrawer.status.${status}`)
}

function statusIcon(status: BackgroundTaskPublic['status']) {
    if (status === 'completed') return CheckCircle2
    if (status === 'failed' || status === 'canceled') return XCircle
    if (status === 'pending') return Clock3
    return Loader2
}

function formatDateTime(value?: string | null): string {
    return formatApiDateTime(value)
}

function formatDuration(ms?: number | null): string {
    if (!ms || ms <= 0) return ''
    const totalSeconds = Math.round(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function targetTypeLabel(type: CardMediaTargetType, t: TFunction): string {
    return t(`tasksDrawer.types.${type}`)
}

function attachedCardLabel(task: BackgroundTaskPublic, t: TFunction): string {
    const name = task.target.display_name || task.target.id
    return t('tasksDrawer.attached.label', { type: targetTypeLabel(task.target.type, t), name })
}

function taskTitle(task: BackgroundTaskPublic, t: TFunction): string {
    return task.result?.lyrics?.song_title || t('tasksDrawer.fallback.themeSong')
}

function tabTasks(buckets: BackgroundTaskBuckets, tab: TaskTab): BackgroundTaskPublic[] {
    return buckets[tab]
}

function toCharacterPreview(card: Character, targetId: string, t: TFunction): AttachedCardPreview {
    return {
        id: card.id || targetId,
        type: 'character',
        title: card.name || t('tasksDrawer.fallback.character'),
        badge: card.race || targetTypeLabel('character', t),
        description: card.description,
        imageUrl: card.image_url,
        themeSongUrl: card.theme_song_url,
        triggers: card.triggers ?? [],
        categories: card.category,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
    }
}

function toWorldPreview(card: World, targetId: string, t: TFunction): AttachedCardPreview {
    return {
        id: card.id || targetId,
        type: 'world',
        title: card.name || t('tasksDrawer.fallback.world'),
        badge: [worldPlaceTypeLabel(readWorldPlaceType(card)), card.type].filter(Boolean).join(' / ') || targetTypeLabel('world', t),
        description: card.description,
        imageUrl: card.image_url,
        themeSongUrl: card.theme_song_url,
        triggers: card.triggers ?? [],
        categories: card.category,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
    }
}

function toItemPreview(card: Item, targetId: string, t: TFunction): AttachedCardPreview {
    return {
        id: card.id || targetId,
        type: 'item',
        title: card.name || t('tasksDrawer.fallback.item'),
        badge: [card.type, card.rarity].filter(Boolean).join(' / ') || targetTypeLabel('item', t),
        description: card.description,
        imageUrl: card.image_url,
        themeSongUrl: card.theme_song_url,
        triggers: card.triggers ?? [],
        categories: card.category,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
    }
}

function toAdventurePreview(card: Adventure, targetId: string, t: TFunction): AttachedCardPreview {
    return {
        id: card.id || targetId,
        type: 'adventure_template',
        title: card.scenario || t('tasksDrawer.fallback.adventure'),
        badge: targetTypeLabel('adventure_template', t),
        description: card.scenario,
        imageUrl: card.image_url,
        themeSongUrl: card.theme_song_url,
        triggers: card.triggers ?? [],
        categories: card.category,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
    }
}

export function TasksDrawer() {
    const { t } = useTranslation()
    const { drawerOpen, closeDrawer, taskBuckets, refreshTasks, cancelTask } = useBackgroundTasks()
    const { characters, worlds, items, templateAdventures } = useData()
    const [activeTab, setActiveTab] = useState<TaskTab>('active')
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [selectedTask, setSelectedTask] = useState<BackgroundTaskPublic | null>(null)
    const [selectedCard, setSelectedCard] = useState<AttachedCardPreview | null>(null)
    const [cardLoading, setCardLoading] = useState(false)
    const [cardError, setCardError] = useState<string | null>(null)
    const visibleTasks = tabTasks(taskBuckets, activeTab)
    const counts = useMemo(
        () => ({
            active: taskBuckets.active.length,
            completed: taskBuckets.completed.length,
            failed: taskBuckets.failed.length,
        }),
        [taskBuckets],
    )

    const findLocalCard = (task: BackgroundTaskPublic): AttachedCardPreview | null => {
        if (task.target.type === 'character') {
            const card = characters.find((item) => item.id === task.target.id)
            return card ? toCharacterPreview(card, task.target.id, t) : null
        }
        if (task.target.type === 'world') {
            const card = worlds.find((item) => item.id === task.target.id)
            return card ? toWorldPreview(card, task.target.id, t) : null
        }
        if (task.target.type === 'item') {
            const card = items.find((item) => item.id === task.target.id)
            return card ? toItemPreview(card, task.target.id, t) : null
        }
        const card = templateAdventures.find((item) => item.id === task.target.id)
        return card ? toAdventurePreview(card, task.target.id, t) : null
    }

    const fetchAttachedCard = async (task: BackgroundTaskPublic): Promise<AttachedCardPreview | null> => {
        const local = findLocalCard(task)
        if (local) return local
        if (task.target.type === 'character') {
            const card = transformCharacters([await apiService.getCharacter(task.target.id)])[0]
            return card ? toCharacterPreview(card, task.target.id, t) : null
        }
        if (task.target.type === 'world') {
            const card = transformWorlds([await apiService.getWorld(task.target.id)])[0]
            return card ? toWorldPreview(card, task.target.id, t) : null
        }
        if (task.target.type === 'item') {
            const card = transformItems([await apiService.getItem(task.target.id)])[0]
            return card ? toItemPreview(card, task.target.id, t) : null
        }
        const card = transformTemplates([await apiService.getAdventureTemplate(task.target.id)])[0]
        return card ? toAdventurePreview(card, task.target.id, t) : null
    }

    const openAttachedCard = async (task: BackgroundTaskPublic) => {
        setSelectedTask(task)
        setSelectedCard(null)
        setCardError(null)
        setCardLoading(true)
        try {
            setSelectedCard(await fetchAttachedCard(task))
        } catch {
            setCardError(t('tasksDrawer.attached.loadFailed'))
        } finally {
            setCardLoading(false)
        }
    }

    const closeCardModal = () => {
        setSelectedTask(null)
        setSelectedCard(null)
        setCardError(null)
        setCardLoading(false)
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        try {
            await refreshTasks()
        } finally {
            setIsRefreshing(false)
        }
    }

    return (
        <>
            <Drawer
                open={drawerOpen}
                onClose={closeDrawer}
                size="md"
                icon={<Icon icon={Music2} size={18} className="text-arcane-300" />}
                eyebrow={<Eyebrow tone="arcane">{t('tasksDrawer.eyebrow')}</Eyebrow>}
                title={t('tasksDrawer.title')}
                footer={
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={isRefreshing}
                        onClick={() => void handleRefresh()}
                        iconLeft={<Icon icon={RefreshCw} size={14} className={isRefreshing ? 'animate-spin' : undefined} />}
                    >
                        {t('tasksDrawer.actions.refresh')}
                    </Button>
                }
            >
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-3 gap-1 rounded-lg border border-parchment-50/10 bg-ink-900/45 p-1" role="group" aria-label={t('tasksDrawer.filterAria')}>
                        {TAB_ORDER.map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                aria-pressed={activeTab === tab}
                                className={cx(
                                    'flex min-h-10 items-center justify-center gap-1.5 rounded-md px-2 font-ui text-xs font-semibold transition-colors',
                                    activeTab === tab
                                        ? 'bg-arcane-500/20 text-parchment-50 ring-1 ring-inset ring-arcane-500/40'
                                        : 'text-parchment-400 hover:bg-parchment-50/[.05] hover:text-parchment-100',
                                )}
                                onClick={() => setActiveTab(tab)}
                            >
                                <span>{t(`tasksDrawer.tabs.${tab}`)}</span>
                                <Badge tone={tab === 'failed' && counts[tab] > 0 ? 'nsfw' : tab === 'active' && counts[tab] > 0 ? 'arcane' : 'neutral'}>
                                    {counts[tab]}
                                </Badge>
                            </button>
                        ))}
                    </div>
                    <span role="status" className="sr-only">
                        {t('tasksDrawer.activeStatus', { count: counts.active })}
                    </span>

                    {visibleTasks.length === 0 ? (
                        <EmptyState
                            icon={<Icon icon={EMPTY_ICON[activeTab]} size={28} />}
                            message={t(`tasksDrawer.empty.${activeTab}Title`)}
                            secondaryText={t(`tasksDrawer.empty.${activeTab}Body`)}
                        />
                    ) : (
                        visibleTasks.map((task) => (
                            <TaskRow
                                key={`${task.operation}:${task.task_id}`}
                                task={task}
                                attachedCard={findLocalCard(task)}
                                onCancel={() => void cancelTask(task.operation, task.task_id)}
                                onOpenCard={() => void openAttachedCard(task)}
                            />
                        ))
                    )}
                </div>
            </Drawer>
            <AttachedCardModal
                task={selectedTask}
                card={selectedCard}
                loading={cardLoading}
                error={cardError}
                onClose={closeCardModal}
            />
        </>
    )
}

function TaskRow({
    task,
    attachedCard,
    onCancel,
    onOpenCard,
}: {
    task: BackgroundTaskPublic
    attachedCard?: AttachedCardPreview | null
    onCancel: () => void
    onOpenCard: () => void
}) {
    const { t } = useTranslation()
    const IconCmp = statusIcon(task.status)
    const assetUrl = task.result?.assets?.[0]?.url
    const resolvedAudio = resolveMediaUrl(assetUrl)
    const tone: StatusTone = task.status === 'completed' ? 'live' : task.status === 'failed' || task.status === 'canceled' ? 'nsfw' : 'arcane'
    const isWorking = ACTIVE.has(task.status) && task.status !== 'pending'
    const title = taskTitle(task, t)
    const createdTime = formatDateTime(task.created_at)
    const updatedTime = formatDateTime(task.updated_at)
    const createdRelative = formatRelativeTime(task.created_at)
    const updatedRelative = formatRelativeTime(task.updated_at)
    const duration = formatDuration(task.result?.assets?.[0]?.duration_ms)
    const format = task.result?.assets?.[0]?.output_format?.toUpperCase()
    const cardLabel = attachedCardLabel(task, t)

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-parchment-50/10 bg-ink-800/60 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className={cx('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md', TILE_TONE[tone])}>
                        <Icon icon={IconCmp} size={17} className={isWorking ? 'animate-spin' : undefined} />
                    </span>
                    <div className="min-w-0">
                        <div className="truncate font-ui text-sm font-semibold text-parchment-50">{title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge tone={tone}>{statusCopy(task.status, t)}</Badge>
                            <button
                                type="button"
                                title={t('tasksDrawer.attached.aria', { label: cardLabel })}
                                aria-label={t('tasksDrawer.attached.aria', { label: cardLabel })}
                                className="inline-flex max-w-full items-center gap-1 rounded-sm font-ui text-[11px] text-parchment-400 underline-offset-2 hover:text-parchment-50 hover:underline"
                                onClick={onOpenCard}
                            >
                                <Icon icon={BookOpen} size={12} />
                                <span className="truncate">{cardLabel}</span>
                            </button>
                        </div>
                    </div>
                </div>
                {task.status === 'pending' && task.cancel_url && (
                    <Button variant="secondary" size="sm" className="shrink-0" onClick={onCancel}>
                        {t('tasksDrawer.actions.cancel')}
                    </Button>
                )}
            </div>

            {isWorking && (
                <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-ink-900/60">
                    <div className="h-full w-full animate-shimmer bg-[linear-gradient(100deg,transparent_30%,rgba(143,111,227,0.45)_50%,transparent_70%)] bg-no-repeat [background-size:200%_100%]" />
                </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-parchment-400">
                {createdRelative && (
                    <span title={createdTime} className="inline-flex items-center gap-1">
                        <Icon icon={CalendarClock} size={12} />
                        {t('tasksDrawer.metadata.created', { time: createdRelative })}
                    </span>
                )}
                {updatedRelative && updatedRelative !== createdRelative && (
                    <span title={updatedTime}>{t('tasksDrawer.metadata.updated', { time: updatedRelative })}</span>
                )}
                {(duration || format) && (
                    <span className="inline-flex items-center gap-1">
                        <Icon icon={FileAudio} size={12} />
                        {[duration, format].filter(Boolean).join(' · ')}
                    </span>
                )}
            </div>

            {resolvedAudio && task.status === 'completed' && (
                <AudioWavePlayer
                    src={resolvedAudio}
                    title={t('tasksDrawer.metadata.theme', { title })}
                    trackMeta={{
                        cardName: attachedCard?.title || task.target.display_name || undefined,
                        cardType: task.target.type,
                        cardId: task.target.id,
                        artworkUrl: resolveMediaUrl(attachedCard?.imageUrl),
                    }}
                    className="rounded-lg border border-arcane-500/20 bg-ink-900/50 p-2.5"
                />
            )}
            {task.error?.detail && (
                <div className="flex items-start gap-2 rounded-md border border-blood-500/30 bg-blood-500/10 px-3 py-2">
                    <Icon icon={AlertCircle} size={14} className="mt-0.5 shrink-0 text-blood-500" />
                    <p className="font-ui text-xs leading-relaxed text-blood-500">{task.error.detail}</p>
                </div>
            )}
        </div>
    )
}

function AttachedCardModal({
    task,
    card,
    loading,
    error,
    onClose,
}: {
    task: BackgroundTaskPublic | null
    card: AttachedCardPreview | null
    loading: boolean
    error: string | null
    onClose: () => void
}) {
    const { t } = useTranslation()
    const isOpen = Boolean(task)
    const fallbackTitle = task ? attachedCardLabel(task, t) : t('tasksDrawer.attached.title')
    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="lg"
            title={t('tasksDrawer.attached.title')}
            icon={<Icon icon={BookOpen} size={18} className="text-arcane-300" />}
            closeLabel={t('common.close')}
        >
            {loading ? (
                <LoadingSpinner size="small" message={t('tasksDrawer.attached.loading')} />
            ) : card ? (
                <div className="flex flex-col gap-4">
                    <DomainCard
                        title={card.title}
                        imageUrl={resolveMediaUrl(card.imageUrl)}
                        themeSongUrl={resolveMediaUrl(card.themeSongUrl)}
                        subtitle={<Tag>{card.badge || targetTypeLabel(card.type, t)}</Tag>}
                    >
                        <div className="flex flex-col gap-3">
                            {card.description && (
                                <p className="font-narrative text-sm leading-relaxed text-parchment-400">
                                    {card.description}
                                </p>
                            )}
                            <CardMetadata card={card} />
                        </div>
                    </DomainCard>
                </div>
            ) : (
                <div className="rounded-lg border border-parchment-50/10 bg-ink-800/60 p-4">
                    <div className="font-ui text-sm font-semibold text-parchment-100">{fallbackTitle}</div>
                    <p className="mt-2 font-ui text-xs leading-relaxed text-parchment-400">
                        {error || t('tasksDrawer.attached.unavailable')}
                    </p>
                    {task && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Tag>{targetTypeLabel(task.target.type, t)}</Tag>
                            <span className="inline-flex items-center rounded-full bg-ink-600 px-2.5 py-[3px] font-mono text-[11px] text-parchment-200">
                                {task.target.id}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}

function CardMetadata({ card }: { card: AttachedCardPreview }) {
    const { t } = useTranslation()
    const createdAt = formatDateTime(card.createdAt)
    const updatedAt = formatDateTime(card.updatedAt)
    const attrs = (card.categories ?? [])
        .flatMap((category) => category.attributes ?? [])
        .flatMap((record) => Object.entries(record))
        .filter(([key, value]) => key && value)
        .slice(0, 5)

    return (
        <div className="flex flex-col gap-3">
            {(createdAt || updatedAt) && (
                <div className="flex flex-wrap gap-2">
                    {createdAt && <Tag>{t('tasksDrawer.metadata.created', { time: createdAt })}</Tag>}
                    {updatedAt && updatedAt !== createdAt && <Tag>{t('tasksDrawer.metadata.updated', { time: updatedAt })}</Tag>}
                </div>
            )}
            {attrs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {attrs.map(([key, value]) => (
                        <Tag key={`${key}:${value}`}>{key}: {value}</Tag>
                    ))}
                </div>
            )}
            {card.triggers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {card.triggers.slice(0, 8).map((trigger) => (
                        <Tag key={trigger}>{trigger}</Tag>
                    ))}
                    {card.triggers.length > 8 && <Tag>+{card.triggers.length - 8}</Tag>}
                </div>
            )}
        </div>
    )
}
