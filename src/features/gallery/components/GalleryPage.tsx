/**
 * GalleryPage — full-page, server-searched library for one card type. A dense
 * image-forward grid (GalleryCard) with a masthead search bar (name + triggers,
 * debounced server query) and skip/limit infinite scroll. Actions reuse the
 * DataProvider flows (edit/begin/chat/delete) so the dashboard stays in sync.
 *
 * Workspace R1: owned cards load through the selected workspace's scoped
 * client and every async result is applied only while that workspace is still
 * the committed one. With the workspace UI enabled, owned type galleries are
 * compatibility inputs that open the Library; this page keeps the public view
 * and the six-character group-chat selection.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Globe2, Import, Loader2, Plus, Search, UserCircle, Users, X } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { PlaylistTrack } from '@/app/providers/audioPlaylistContext'
import { CardGrid, GalleryCard, GalleryCardSkeleton, type CardOption } from '@/ui/components'
import { Badge, Button, Callout, Chip, controlClass, Eyebrow, Icon, IconButton, IconTile, PageHeader, SectionHeader, Toast } from '@/ui/primitives'
import { isPersonaCard } from '@/utils/characterRoles'
import {
    isCommunityCardsFeatureEnabled,
    isGroupChatsFeatureEnabled,
} from '@/shared/featureFlags'
import { galleryConfigFor, personaGalleryItem, publicConfigFor, type GalleryItem, type GalleryType } from '../galleryConfig'
import { buildGalleryModeHash, buildGalleryViewHash, galleryPageForType, parseGalleryHash } from '../galleryLinks'
import { useCardGallery } from '../hooks/useCardGallery'
import { useGalleryView } from '../hooks/useGalleryView'
import { useGalleryCardActions, versionableCardTypeFor } from '../hooks/useGalleryCardActions'
import { cardGridDensity, cardGridLayout, galleryCardView } from '../galleryView'
import { GalleryViewToggle } from './GalleryViewToggle'
import { useCardImport, useGalleryCardPreview } from '../hooks/useCardImport'
import { CardImportOverlays } from './CardImportOverlays'

export interface GalleryPageProps {
    type: GalleryType
}

function linkedCardIdFor(type: GalleryType): string | null {
    const target = parseGalleryHash()
    return target?.type === type ? (target.cardId ?? null) : null
}

function groupModeFor(type: GalleryType): boolean {
    const target = parseGalleryHash()
    return target?.type === type && target.mode === 'group-chat'
}

function galleryViewFor(type: GalleryType): 'mine' | 'public' {
    if (!isCommunityCardsFeatureEnabled()) return 'mine'
    const target = parseGalleryHash()
    return target?.type === type && target.view === 'public' ? 'public' : 'mine'
}

function playlistCardType(type: GalleryType): PlaylistTrack['cardType'] {
    return type === 'adventure' ? 'adventure_template' : type
}

function scrollToGalleryCard(id: string): void {
    const card = Array.from(document.querySelectorAll<HTMLElement>('[data-gallery-card-id]')).find(
        (element) => element.dataset.galleryCardId === id,
    )
    card?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

export function GalleryPage({ type }: GalleryPageProps) {
    const { t } = useTranslation()
    const { api, capture, isCurrent, workspaceEpoch, selectedWorkspace } = useWorkspace()
    const readOnly = Boolean(selectedWorkspace?.archived_at)
    const config = useMemo(() => galleryConfigFor(type, api), [api, type])
    const [viewMode, setViewMode] = useState<'mine' | 'public'>(() => galleryViewFor(type))
    const [layoutView, setLayoutView] = useGalleryView()
    const publicConfig = useMemo(() => publicConfigFor(type), [type])
    const activeConfig = viewMode === 'public' ? publicConfig : config
    const communityCardsEnabled = isCommunityCardsFeatureEnabled()
    const groupChatsEnabled = isGroupChatsFeatureEnabled()
    const isPublicView = communityCardsEnabled && viewMode === 'public'
    const { setPage } = useNavigation()
    const { isAuthenticated } = useAuth()
    const gallery = useCardGallery(activeConfig, undefined, {
        enabled: isPublicView || (isAuthenticated && api !== null),
        resetKey: isPublicView ? 'public' : `${workspaceEpoch}`,
    })
    const { upsertItem, removeItem } = gallery
    const { characters, setEditingCharacter, setEditingWorld, setEditingItem, setEditingTemplate } = useData()
    const actions = useGalleryCardActions({
        api,
        readOnly,
        onItemChanged: (item) => {
            if (item.galleryType === type) upsertItem(item)
        },
        onItemRemoved: (item) => removeItem(item.id),
    })
    const { highlightedId, setHighlightedId, setNotice: setActionNotice, requireAuth } = actions
    const actionNotice = actions.notice

    const importHook = useCardImport()
    const preview = useGalleryCardPreview()
    const [linkedCardId, setLinkedCardId] = useState<string | null>(() => linkedCardIdFor(type))
    const [groupSelectionMode, setGroupSelectionMode] = useState(() => groupChatsEnabled && groupModeFor(type))
    const [selectedGroupItems, setSelectedGroupItems] = useState<Record<string, GalleryItem>>({})
    const fetchedLinkedRef = useRef<string | null>(null)
    const typeKey = `gallery.type.${type}`
    const displayConfig = {
        title: t(`${typeKey}.title`),
        singular: t(`${typeKey}.singular`),
        searchPlaceholder: t(`${typeKey}.search`),
        publicSearchPlaceholder: t(`${typeKey}.publicSearch`),
        emptyTitle: t(`${typeKey}.emptyTitle`),
        emptyDescription: t(`${typeKey}.emptyDescription`),
        publicEmptyTitle: t(`${typeKey}.publicEmptyTitle`),
        noMatchTitle: t(`${typeKey}.noMatchTitle`),
        publicNoMatchTitle: t(`${typeKey}.publicNoMatchTitle`),
        createLabel: t(`${typeKey}.create`),
    }
    const activeDisplayConfig = {
        eyebrow: isPublicView ? t('gallery.communityEyebrow') : t('gallery.libraryEyebrow'),
        title: displayConfig.title,
        searchPlaceholder: isPublicView ? displayConfig.publicSearchPlaceholder : displayConfig.searchPlaceholder,
        emptyTitle: isPublicView ? displayConfig.publicEmptyTitle : displayConfig.emptyTitle,
        emptyDescription: isPublicView ? t('gallery.publicEmptyDescription') : displayConfig.emptyDescription,
        noMatchTitle: isPublicView ? displayConfig.publicNoMatchTitle : displayConfig.noMatchTitle,
        noMatchDescription: t('gallery.noMatchDescription'),
    }
    const personaSectionItems = useMemo(() => {
        return characters
            .map((character, index) => ({ character, index }))
            .filter(({ character }) => isPersonaCard(character))
            .sort((a, b) =>
                Number(Boolean(b.character.is_default_persona)) - Number(Boolean(a.character.is_default_persona))
                || a.index - b.index,
            )
            .map(({ character }) => personaGalleryItem(character))
    }, [characters])
    const showPersonaSection = isAuthenticated && type === 'character' && !isPublicView && !groupSelectionMode

    // A committed workspace switch clears the group selection (document 08).
    const selectionEpochRef = useRef(workspaceEpoch)
    useEffect(() => {
        if (selectionEpochRef.current === workspaceEpoch) return
        selectionEpochRef.current = workspaceEpoch
        fetchedLinkedRef.current = null
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedGroupItems((current) => (Object.keys(current).length > 0 ? {} : current))
    }, [workspaceEpoch])

    useEffect(() => {
        const syncLinkedCard = () => {
            const next = linkedCardIdFor(type)
            const nextView = galleryViewFor(type)
            setViewMode(nextView)
            setLinkedCardId(next)
            if (next) setHighlightedId(next)
            const nextGroupMode = groupChatsEnabled && nextView === 'mine' && type === 'character' && groupModeFor(type)
            setGroupSelectionMode(nextGroupMode)
            if (!nextGroupMode) {
                setSelectedGroupItems((current) => (Object.keys(current).length > 0 ? {} : current))
            }
        }
        syncLinkedCard()
        window.addEventListener('hashchange', syncLinkedCard)
        window.addEventListener('popstate', syncLinkedCard)
        return () => {
            window.removeEventListener('hashchange', syncLinkedCard)
            window.removeEventListener('popstate', syncLinkedCard)
        }
    }, [groupChatsEnabled, setHighlightedId, type])

    useEffect(() => {
        if (!linkedCardId || !activeConfig.fetchItem || !activeConfig.toItem) return
        if (gallery.loading) return
        if (!isAuthenticated && !isPublicView) return
        if (!isPublicView && !api) return
        const key = `${viewMode}:${type}:${linkedCardId}:${isPublicView ? '' : workspaceEpoch}`
        if (fetchedLinkedRef.current === key) return
        let cancelled = false
        const scope = isPublicView ? null : capture()
        const stale = () => cancelled || (scope !== null && !isCurrent(scope))

        void activeConfig.fetchItem(linkedCardId)
            .then((raw) => {
                if (stale()) return
                const item = activeConfig.toItem?.(raw)
                if (!item) throw new Error('Card not found')
                // Only a completed request satisfies this link. Search/auth changes can
                // cancel a pending load, and its replacement must still be allowed to run.
                fetchedLinkedRef.current = key
                upsertItem(item)
                setHighlightedId(item.id)
            })
            .catch((error) => {
                if (stale()) return
                fetchedLinkedRef.current = key
                console.error('Failed to load shared gallery card:', error)
                setActionNotice({
                    tone: 'error',
                    title: t('gallery.action.sharedOpenFailed'),
                    message: t('gallery.action.sharedOpenBody'),
                })
            })

        return () => {
            cancelled = true
        }
    }, [activeConfig, api, capture, gallery.loading, isAuthenticated, isCurrent, isPublicView, linkedCardId, setActionNotice, setHighlightedId, t, type, upsertItem, viewMode, workspaceEpoch])

    useEffect(() => {
        if (!linkedCardId || !gallery.items.some((item) => item.id === linkedCardId)) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHighlightedId(linkedCardId)
        const scrollTimer = window.setTimeout(() => scrollToGalleryCard(linkedCardId), 40)
        const highlightTimer = window.setTimeout(() => {
            setHighlightedId((current) => (current === linkedCardId ? null : current))
        }, 3600)
        return () => {
            window.clearTimeout(scrollTimer)
            window.clearTimeout(highlightTimer)
        }
    }, [gallery.items, linkedCardId, setHighlightedId])

    const switchViewMode = (mode: 'mine' | 'public') => {
        if (mode === 'public' && !communityCardsEnabled) return
        setActionNotice(null)
        setViewMode(mode)
        setSelectedGroupItems({})
        setGroupSelectionMode(false)
        setPage(galleryPageForType(type), {
            hash: buildGalleryViewHash(type, mode === 'public' ? 'public' : undefined),
        })
    }

    const openCreatePage = () => {
        requireAuth(() => {
            if (type === 'character' || type === 'persona') setEditingCharacter(null)
            else if (type === 'world') setEditingWorld(null)
            else if (type === 'item') setEditingItem(null)
            else setEditingTemplate(null)
            setPage(config.createPage)
        })
    }

    const enterGroupSelection = () => {
        if (!groupChatsEnabled) return
        requireAuth(() => {
            setActionNotice(null)
            setSelectedGroupItems({})
            setGroupSelectionMode(true)
            setPage('gallery-characters', { hash: buildGalleryModeHash('character', 'group-chat') })
        })
    }

    const cancelGroupSelection = () => {
        setSelectedGroupItems({})
        setGroupSelectionMode(false)
        setPage('gallery-characters')
    }

    const toggleGroupSelection = (item: GalleryItem) => {
        setActionNotice(null)
        const isSelected = Boolean(selectedGroupItems[item.id])
        if (!isSelected && Object.keys(selectedGroupItems).length >= 6) {
            setActionNotice({
                tone: 'error',
                title: t('gallery.groupFullTitle'),
                message: t('gallery.groupFullBody'),
            })
            return
        }
        setSelectedGroupItems((current) => {
            if (!current[item.id]) return { ...current, [item.id]: item }
            const next = { ...current }
            delete next[item.id]
            return next
        })
    }

    const beginGroupChat = () => {
        if (!groupChatsEnabled) return
        const items = Object.values(selectedGroupItems)
        if (items.length < 2) {
            setActionNotice({
                tone: 'error',
                title: t('gallery.groupMinTitle'),
                message: t('gallery.groupMinBody'),
            })
            return
        }
        actions.openGroupChatPicker(items, () => {
            setSelectedGroupItems({})
            setGroupSelectionMode(false)
        })
    }

    const primaryAction = (item: GalleryItem) => {
        if (isPublicView) {
            preview.open(item)
            return
        }
        if (groupSelectionMode && type === 'character') {
            toggleGroupSelection(item)
            return
        }
        actions.primaryAction(item)
    }

    const optionsFor = (item: GalleryItem): CardOption[] => {
        if (isPublicView) {
            const importingThis = importHook.importingKey === `${item.backendType}:${item.id}`
            const alreadyImported = Boolean(item.resource?.already_imported)
            return [
                {
                    type: 'custom',
                    icon: importingThis ? (
                        <Icon icon={Loader2} size={15} className="animate-spin" />
                    ) : (
                        <Icon icon={Import} size={15} />
                    ),
                    label: importingThis
                        ? t('gallery.importing')
                        : alreadyImported
                          ? t('gallery.preview.importCopy')
                          : t('gallery.importCard'),
                    onClick: () => void importHook.requestImport({ kind: 'clone', item }),
                    disabled: importHook.importingKey !== null,
                },
            ]
        }
        return actions.optionsFor(item)
    }

    const hasQuery = gallery.query.trim().length > 0

    const badgeForItem = (item: GalleryItem, alreadyImported = false) => {
        if (alreadyImported) return t('gallery.alreadyImported')
        return item.badge
    }

    const emptyAction: ReactNode = hasQuery ? (
        <Button variant="secondary" size="sm" onClick={() => gallery.setQuery('')}>
            {t('gallery.clearSearch')}
        </Button>
    ) : isPublicView ? (
        <Button variant="secondary" size="sm" onClick={gallery.refresh}>
            {t('gallery.refresh')}
        </Button>
    ) : readOnly ? undefined : (
        <Button
            variant="primary"
            size="sm"
            iconLeft={<Icon icon={Plus} size={16} />}
            onClick={openCreatePage}
        >
            {displayConfig.createLabel}
        </Button>
    )

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={activeDisplayConfig.eyebrow}
                title={activeDisplayConfig.title}
                size="lg"
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        {groupChatsEnabled && type === 'character' && !groupSelectionMode && !isPublicView && !readOnly && (
                            <Button
                                variant="secondary"
                                iconLeft={<Icon icon={Users} size={16} />}
                                onClick={enterGroupSelection}
                                className="shrink-0"
                            >
                                {t('gallery.groupChat')}
                            </Button>
                        )}
                        {!groupSelectionMode && !isPublicView && !readOnly && (
                            <Button
                                variant="primary"
                                iconLeft={<Icon icon={Plus} size={16} />}
                                onClick={openCreatePage}
                                className="shrink-0"
                            >
                                {displayConfig.createLabel}
                            </Button>
                        )}
                    </div>
                }
            />

            <div className="flex flex-wrap items-center gap-3 border-b border-line-faint pb-5">
                {communityCardsEnabled && (
                    <div className="flex flex-wrap gap-2">
                        <Chip
                            active={!isPublicView}
                            onClick={() => switchViewMode('mine')}
                            aria-pressed={!isPublicView}
                        >
                            {t('gallery.myCards')}
                        </Chip>
                        <Chip
                            active={isPublicView}
                            icon={<Icon icon={Globe2} size={13} />}
                            onClick={() => switchViewMode('public')}
                            aria-pressed={isPublicView}
                        >
                            {t('gallery.publicCards')}
                        </Chip>
                    </div>
                )}
                <GalleryViewToggle value={layoutView} onChange={setLayoutView} className="shrink-0" />
                <div className="relative flex w-full items-center sm:ml-auto sm:w-80 sm:max-w-full">
                    <span className="pointer-events-none absolute left-3 flex items-center text-parchment-400">
                        <Icon icon={Search} size={16} />
                    </span>
                    <input
                        type="search"
                        value={gallery.query}
                        onChange={(e) => gallery.setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') gallery.setQuery('')
                        }}
                        placeholder={activeDisplayConfig.searchPlaceholder}
                        aria-label={activeDisplayConfig.searchPlaceholder}
                        className={`${controlClass} rounded-full pl-10 ${gallery.searching && hasQuery ? 'pr-16' : 'pr-12'}`}
                        data-testid="gallery-search-input"
                    />
                    {gallery.searching && (
                        <Loader2
                            className={`absolute ${hasQuery ? 'right-12' : 'right-4'} animate-spin text-ember-500`}
                            size={16}
                            aria-hidden="true"
                            data-testid="gallery-search-spinner"
                        />
                    )}
                    {hasQuery && (
                        <IconButton
                            size="sm"
                            onClick={() => gallery.setQuery('')}
                            label={t('gallery.clearSearch')}
                            className="absolute right-2"
                            data-testid="gallery-search-clear"
                        >
                            <Icon icon={X} size={16} />
                        </IconButton>
                    )}
                </div>
            </div>

            {groupSelectionMode && type === 'character' && !isPublicView && (
                <div className="sticky top-17 z-[10] flex flex-col gap-3 rounded-lg border border-ember-500/25 bg-ink-700/95 px-4 py-3 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between lg:top-3">
                    <div className="min-w-0">
                        <p className="font-ui text-sm font-semibold text-parchment-50">
                            {t('gallery.selectedCount', { count: Object.keys(selectedGroupItems).length })}
                        </p>
                        <p className="mt-0.5 font-ui text-xs text-parchment-400">
                            {t('gallery.groupHint')}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={cancelGroupSelection}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            iconLeft={<Icon icon={Users} size={15} />}
                            disabled={Object.keys(selectedGroupItems).length < 2}
                            onClick={beginGroupChat}
                        >
                            {t('gallery.startGroupChat')}
                        </Button>
                    </div>
                </div>
            )}

            {gallery.error && (
                <Callout
                    tone="danger"
                    role="alert"
                    action={
                        <Button variant="secondary" size="sm" onClick={gallery.refresh}>
                            {t('gallery.retry')}
                        </Button>
                    }
                >
                    {gallery.error}
                </Callout>
            )}

            <Toast
                open={Boolean(isPublicView ? importHook.actionNotice : actionNotice)}
                tone={(isPublicView ? importHook.actionNotice : actionNotice)?.tone ?? 'success'}
                title={(isPublicView ? importHook.actionNotice : actionNotice)?.title}
                message={(isPublicView ? importHook.actionNotice : actionNotice)?.message}
                autoCloseMs={(isPublicView ? importHook.actionNotice : actionNotice)?.tone === 'success' ? 3200 : false}
                onClose={() => (isPublicView ? importHook.setActionNotice(null) : setActionNotice(null))}
            />

            {showPersonaSection && (
                <section
                    className="flex flex-col gap-3"
                    aria-labelledby="character-personas-title"
                    data-testid="character-persona-section"
                >
                    <SectionHeader
                        icon={UserCircle}
                        tone="ember"
                        title={<span id="character-personas-title">{t('gallery.personas.sectionTitle')}</span>}
                        right={
                            <div className="flex items-center gap-2">
                                <Badge tone="ember">{t('gallery.personas.count', { count: personaSectionItems.length })}</Badge>
                                {personaSectionItems.length > 0 && !readOnly && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        iconLeft={<Icon icon={Plus} size={15} />}
                                        onClick={openCreatePage}
                                    >
                                        {t('gallery.personas.newPersona')}
                                    </Button>
                                )}
                            </div>
                        }
                    />
                    {personaSectionItems.length > 0 ? (
                        <CardGrid
                            items={personaSectionItems}
                            layout="rail"
                            railWidth="compact"
                            fadeEdges
                            getItemKey={(item) => item.id}
                            showEmptyState={false}
                            data-testid="character-persona-rail"
                            renderCard={(item) => (
                                <GalleryCard
                                    id={item.id}
                                    size="compact"
                                    title={item.title}
                                    badge={badgeForItem(item)}
                                    markerBadge={actions.markerFor(item)}
                                    eyebrow={item.eyebrow}
                                    description={item.description}
                                    tags={item.tags}
                                    imageUrl={item.imageUrl}
                                    themeSongUrl={item.themeSongUrl}
                                    cardType={playlistCardType(item.galleryType)}
                                    cardId={item.id}
                                    versionNumber={item.versionNumber}
                                    hasDraft={item.hasDraft}
                                    usageCardType="character"
                                    usageEnabled
                                    shareOptions={actions.shareOptionsFor(item)}
                                    deleting={actions.deletingId === item.id}
                                    onClick={() => primaryAction(item)}
                                    actionLabel={t('gallery.cardAction.edit', { title: item.title })}
                                    onTagClick={gallery.setQuery}
                                    options={optionsFor(item)}
                                    highlighted={highlightedId === item.id}
                                    data-testid="persona-gallery-card"
                                />
                            )}
                        />
                    ) : (
                        <div className="flex flex-col gap-4 rounded-lg border border-dashed border-line-strong bg-ink-700 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <IconTile icon={UserCircle} tone="ember" size="md" className="shrink-0" />
                                <div className="min-w-0">
                                    <Eyebrow tone="muted" className="mb-1">{t('gallery.personas.emptyEyebrow')}</Eyebrow>
                                    <p className="m-0 font-display text-body font-semibold text-parchment-50">
                                        {t('gallery.personas.emptyTitle')}
                                    </p>
                                    <p className="m-0 mt-1 font-narrative text-label leading-snug text-parchment-300">
                                        {t('gallery.personas.emptyDescription')}
                                    </p>
                                </div>
                            </div>
                            {!readOnly && (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    iconLeft={<Icon icon={Plus} size={15} />}
                                    onClick={openCreatePage}
                                    className="shrink-0"
                                >
                                    {t('gallery.type.persona.create')}
                                </Button>
                            )}
                        </div>
                    )}
                </section>
            )}

            <CardGrid
                items={gallery.items}
                layout={cardGridLayout(layoutView)}
                density={cardGridDensity(layoutView)}
                getItemKey={(item) => item.id}
                loading={gallery.loading}
                renderSkeleton={() => <GalleryCardSkeleton view={galleryCardView(layoutView)} />}
                hasMore={gallery.hasMore}
                loadingMore={gallery.loadingMore}
                onLoadMore={gallery.loadMore}
                emptyStateTitle={hasQuery ? activeDisplayConfig.noMatchTitle : activeDisplayConfig.emptyTitle}
                emptyStateDescription={hasQuery ? activeDisplayConfig.noMatchDescription : activeDisplayConfig.emptyDescription}
                emptyStateAction={emptyAction}
                showEmptyState={!gallery.error}
                data-testid={`gallery-grid-${type}`}
                renderCard={(item) => {
                    const selected = Boolean(selectedGroupItems[item.id])
                    const selectionMode = groupSelectionMode && type === 'character' && !isPublicView
                    const importing = importHook.importingKey === `${item.backendType}:${item.id}`
                    const alreadyImported = isPublicView && Boolean(item.resource?.already_imported)
                    // Usage is owner-scoped, so only fetch it for the user's own libraries.
                    const usageType = isPublicView ? null : versionableCardTypeFor(item.galleryType)
                    return (
                        <GalleryCard
                            id={item.id}
                            view={galleryCardView(layoutView)}
                            title={item.title}
                            badge={badgeForItem(item, alreadyImported)}
                            eyebrow={item.eyebrow}
                            description={item.description}
                            tags={item.tags}
                            imageUrl={item.imageUrl}
                            themeSongUrl={item.themeSongUrl}
                            cardType={playlistCardType(item.galleryType)}
                            cardId={item.id}
                            versionNumber={item.versionNumber}
                            hasDraft={item.hasDraft}
                            usageCardType={usageType ?? undefined}
                            usageEnabled={usageType !== null}
                            shareOptions={selectionMode || isPublicView ? undefined : actions.shareOptionsFor(item)}
                            deleting={actions.deletingId === item.id}
                            onClick={() => primaryAction(item)}
                            actionLabel={
                                isPublicView
                                    ? t('gallery.preview.previewAction', { title: item.title })
                                    : selectionMode
                                    ? t(selected ? 'gallery.cardAction.removeFromGroup' : 'gallery.cardAction.addToGroup', { title: item.title })
                                    : actions.actionLabelFor(item)
                            }
                            onTagClick={selectionMode ? undefined : gallery.setQuery}
                            options={selectionMode ? undefined : optionsFor(item)}
                            highlighted={selectionMode ? selected : highlightedId === item.id}
                            footer={selectionMode ? (
                                <Button
                                    variant={selected ? 'primary' : 'secondary'}
                                    size="sm"
                                    full
                                    iconLeft={selected ? <Icon icon={CheckCircle2} size={15} /> : <Icon icon={Plus} size={15} />}
                                    onClick={() => toggleGroupSelection(item)}
                                >
                                    {selected ? t('gallery.selected') : t('gallery.select')}
                                </Button>
                            ) : isPublicView ? (
                                <Button
                                    variant={alreadyImported ? 'secondary' : 'primary'}
                                    size="sm"
                                    full
                                    iconLeft={
                                        importing ? (
                                            <Icon icon={Loader2} size={15} className="animate-spin" />
                                        ) : (
                                            <Icon icon={Import} size={15} />
                                        )
                                    }
                                    disabled={importHook.importingKey !== null}
                                    onClick={() => void importHook.requestImport({ kind: 'clone', item })}
                                >
                                    {importing
                                        ? t('gallery.importing')
                                        : alreadyImported
                                          ? t('gallery.preview.importCopy')
                                          : t('gallery.import')}
                                </Button>
                            ) : type === 'character' ? actions.footerFor(item) : undefined}
                        />
                    )
                }}
            />

            {actions.overlays}

            <CardImportOverlays
                importHook={importHook}
                previewItem={preview.previewItem}
                onClosePreview={preview.close}
            />
        </div>
    )
}
