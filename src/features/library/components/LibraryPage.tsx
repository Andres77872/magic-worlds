import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * LibraryPage — the Workspace R1 unified card browser (document 08 "Selected
 * library browsing contract"): `#/library?workspace=<uuid>[&collection=…][&q=…]
 * [&card_type=…&character_role=…][&uncollected=true]`.
 *
 * One content surface: the workspace's flat collections as compact folder
 * entries, then (from a new row) every supported card, mixed types, in the
 * server's stable order with offset paging. Cards keep the unchanged
 * GalleryCard design; the type shows in its eyebrow slot. Search is always
 * visible: at the root it filters folders locally and cards on the server;
 * inside a folder it searches that collection. Organization (drag-and-drop to
 * folders, add/remove membership, copy to workspace, new collection) and
 * creation (the existing creators with a captured origin) start here. An
 * archived workspace is read-only: browsing and copying out stay available.
 */
import { isContentTypeFeatureEnabled } from '@/shared/featureFlags'
import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CheckSquare,
    Copy,
    Folder,
    FolderMinus,
    FolderPlus,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Sparkles,
    Trash2,
    Users,
    X,
} from 'lucide-react'
import { useData, useNavigation } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { apiService, isWorkspaceApiError } from '@/infrastructure/api'
import type { CardIdentity, Collection, CopyOutcome, Workspace } from '@/shared/types'
import {
    isAdventuresFeatureEnabled,
    isCommunityCardsFeatureEnabled,
    isGroupChatsFeatureEnabled,
} from '@/shared/featureFlags'
import { CardGrid, CardOptions, GalleryCard, GalleryCardSkeleton, type CardOption } from '@/ui/components'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Button, Callout, Chip, controlClass, Icon, IconButton, PageHeader, SectionHeader, Select, Toast, cx } from '@/ui/primitives'
import { galleryConfigFor, galleryItemFromCard, type GalleryItem } from '@/features/gallery/galleryConfig'
import { buildGalleryModeHash, buildPersonaCreatorHash, pageHash } from '@/features/gallery/galleryLinks'
import { cardGridDensity, cardGridLayout, galleryCardView } from '@/features/gallery/galleryView'
import { GalleryViewToggle } from '@/features/gallery/components/GalleryViewToggle'
import { CardImportOverlays } from '@/features/gallery/components/CardImportOverlays'
import { useGalleryView } from '@/features/gallery/hooks/useGalleryView'
import { useCardImport } from '@/features/gallery/hooks/useCardImport'
import { useGalleryCardActions, versionableCardTypeFor } from '@/features/gallery/hooks/useGalleryCardActions'
import { useNavigationCoordinator } from '@/features/workspaces/useNavigationCoordinator'
import { useCreationOrigin, type LibraryTypeFilter } from '../creationOrigin'
import {
    cardCollectionIds,
    clearLibraryDragData,
    hasLibraryDragData,
    readLibraryDragKeys,
    resolveDragItems,
    summarizeCardMemberships,
    withUpdatedCardMembership,
    writeLibraryDragData,
} from '../libraryDrag'
import {
    buildLibraryHash,
    EMPTY_LIBRARY_ROUTE,
    LIBRARY_TYPE_FILTERS,
    libraryLocationFor,
    libraryQueryKey,
    parseLibraryHash,
    type LibraryCardRef,
    type LibraryRoute,
} from '../libraryUrl'
import { takeLibraryReturn } from '../libraryReturn'
import { forgetLibraryCards, libraryItemKey, useLibraryCards } from '../hooks/useLibraryCards'
import { forgetLibraryCollections, useLibraryCollections } from '../hooks/useLibraryCollections'
import { BulkSelectionBar } from './BulkSelectionBar'
import { CollectionFolder, type FolderDropState } from './CollectionFolder'
import { CollectionFormDialog, type CollectionFormValues } from './CollectionFormDialog'
import { CollectionPickerDialog } from './CollectionPickerDialog'
import { CopyToWorkspaceDrawer, type CopyCardRef } from './CopyToWorkspaceDrawer'
import { ImportCardDialog } from './ImportCardDialog'
import { LibraryNewMenu, type LibraryNewKind } from './LibraryNewMenu'

const SEARCH_DEBOUNCE_MS = 300
const MEMBERSHIP_CHUNK = 200

/** Root scroll positions, restored when the user comes back from a folder. */
const rootScroll = new Map<string, number>()

function mainScroller(): HTMLElement | null {
    return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-app-main]')
}

/** After the router's own scroll-to-top for a page change (parent effects run last). */
function scrollMainTo(top: number) {
    window.requestAnimationFrame(() => mainScroller()?.scrollTo({ top, behavior: 'auto' }))
}

function identityOf(item: GalleryItem): CardIdentity {
    return { card_type: item.backendType, card_id: item.id }
}

function sameCard(item: GalleryItem, ref: LibraryCardRef): boolean {
    return item.backendType === ref.cardType && item.id === ref.cardId
}

function chunks<T>(values: readonly T[], size: number): T[][] {
    const result: T[][] = []
    for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
    return result
}

function playlistCardType(item: GalleryItem) {
    return item.galleryType === 'adventure' ? 'adventure_template' as const : item.galleryType
}

type CollectionForm = { mode: 'create'; thenAddTo?: GalleryItem[] } | { mode: 'edit'; collection: Collection }

export function LibraryPage() {
    const featureFlagGeneration = useFeatureFlags().generation
    const { t } = useTranslation()
    const { api, selectedWorkspaceId, selectedWorkspace, activeWorkspaces, capture, isCurrent, workspaceEpoch } = useWorkspace()
    const readOnly = Boolean(selectedWorkspace?.archived_at)
    const { currentHash, previousPage, setPage, goBack, replaceHash } = useNavigation()
    const { navigate } = useNavigationCoordinator()
    const creationOrigin = useCreationOrigin()
    const { setEditingCharacter, setEditingWorld, setEditingItem, setEditingTemplate } = useData()
    const [layoutView, setLayoutView] = useGalleryView()
    const adventuresEnabled = isAdventuresFeatureEnabled()

    const parsedRoute = parseLibraryHash(currentHash) ?? EMPTY_LIBRARY_ROUTE
    const route: LibraryRoute = useMemo(() => ({ ...parsedRoute, workspaceId: selectedWorkspaceId }),
        // The parsed route is derived from the hash string; its fields fully define it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [currentHash, selectedWorkspaceId])
    const inCollection = route.collectionId !== null
    const filtersActive = route.query.trim() !== '' || route.typeFilter !== 'all' || route.uncollected

    const collectionsState = useLibraryCollections(api, selectedWorkspaceId)
    const { collections } = collectionsState
    const currentCollection = inCollection ? collections.find((collection) => collection.id === route.collectionId) ?? null : null
    const collectionMissing = inCollection && !collectionsState.loading && !collectionsState.error && currentCollection === null
    const collectionNameById = useMemo(
        () => new Map(collections.map((collection) => [collection.id, collection.name])),
        [collections],
    )

    const cards = useLibraryCards(api, selectedWorkspaceId, route)
    const locationKey = selectedWorkspaceId ? libraryQueryKey(selectedWorkspaceId, route) : ''

    // --- URL updates ------------------------------------------------------------------
    const updateRoute = useCallback((patch: Partial<LibraryRoute>, mode: 'replace' | 'push' = 'replace') => {
        const next = { ...route, reveal: null, ...patch, workspaceId: selectedWorkspaceId }
        const hash = buildLibraryHash(next)
        if (mode === 'push') setPage('library', { hash })
        else replaceHash(hash)
    }, [replaceHash, route, selectedWorkspaceId, setPage])

    // --- Search (always visible; debounced into the URL) ---------------------------------
    const [searchInput, setSearchInput] = useState(route.query)
    const [syncedQuery, setSyncedQuery] = useState(route.query)
    if (syncedQuery !== route.query) {
        setSyncedQuery(route.query)
        setSearchInput(route.query)
    }
    useEffect(() => {
        if (searchInput.trim() === route.query.trim()) return
        const timer = window.setTimeout(() => updateRoute({ query: searchInput }), SEARCH_DEBOUNCE_MS)
        return () => window.clearTimeout(timer)
    }, [route.query, searchInput, updateRoute])
    const searching = searchInput.trim() !== route.query.trim() || (cards.loading && cards.items.length > 0)
    const searchPlaceholder = inCollection
        ? t('library.search.collection', { name: currentCollection?.name ?? t('library.folder.kind') })
        : t('library.search.root')

    // --- Folders (root only; local name/description filter) -----------------------------
    const folderQuery = searchInput.trim().toLocaleLowerCase()
    const visibleFolders = inCollection
        ? []
        : collections.filter((collection) => !folderQuery
            || collection.name.toLocaleLowerCase().includes(folderQuery)
            || (collection.description ?? '').toLocaleLowerCase().includes(folderQuery))

    // --- Selection & Drag state ---------------------------------------------------------
    const [selectionMode, setSelectionMode] = useState(false)
    const [selected, setSelected] = useState<ReadonlyMap<string, GalleryItem>>(new Map())
    const [draggingItems, setDraggingItems] = useState<GalleryItem[] | null>(null)
    const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null)
    const [droppingTargetId, setDroppingTargetId] = useState<string | null>(null)
    const selectionScope = `${workspaceEpoch}:${route.collectionId ?? ''}`
    const [appliedSelectionScope, setAppliedSelectionScope] = useState(selectionScope)
    if (appliedSelectionScope !== selectionScope) {
        setAppliedSelectionScope(selectionScope)
        setSelected(new Map())
        setDraggingItems(null)
        setDragOverTargetId(null)
        setDroppingTargetId(null)
    }
    const toggleSelected = (item: GalleryItem) => setSelected((current) => {
        const next = new Map(current)
        const key = libraryItemKey(item)
        if (next.has(key)) next.delete(key)
        else next.set(key, item)
        return next
    })

    // --- Card actions -------------------------------------------------------------------
    const createApi = useMemo(
        () => (selectedWorkspaceId && route.collectionId
            ? apiService.withWorkspace(selectedWorkspaceId, { initialCollectionIds: [route.collectionId] })
            : null),
        // A new client per committed workspace, like `api`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [route.collectionId, selectedWorkspaceId, workspaceEpoch],
    )
    const [pickerFor, setPickerFor] = useState<GalleryItem[] | null>(null)
    const [copyFor, setCopyFor] = useState<GalleryItem[] | null>(null)
    const [collectionForm, setCollectionForm] = useState<CollectionForm | null>(null)
    const [pendingDeleteCollection, setPendingDeleteCollection] = useState<Collection | null>(null)
    const [deletingCollection, setDeletingCollection] = useState(false)
    const [membershipBusy, setMembershipBusy] = useState(false)

    const pickerMemberships = useMemo(() => summarizeCardMemberships(pickerFor ?? []), [pickerFor])

    const actions = useGalleryCardActions({
        api,
        createApi: createApi ?? undefined,
        readOnly,
        onItemChanged: (item) => {
            cards.upsertItem(item)
            if (selectedWorkspaceId) forgetLibraryCards(selectedWorkspaceId)
        },
        onItemRemoved: (item) => {
            cards.removeItems([libraryItemKey(item)])
            setSelected((current) => {
                if (!current.has(libraryItemKey(item))) return current
                const next = new Map(current)
                next.delete(libraryItemKey(item))
                return next
            })
            void collectionsState.refresh()
        },
        extraOptions: (item) => [
            ...(!readOnly ? [{
                type: 'custom' as const,
                icon: <Icon icon={FolderPlus} size={15} />,
                label: t('library.cardMenu.addToCollection'),
                onClick: () => setPickerFor([item]),
                separatorBefore: true,
            }] : []),
            ...(!readOnly && inCollection ? [{
                type: 'custom' as const,
                icon: <Icon icon={FolderMinus} size={15} />,
                label: t('library.cardMenu.removeFromCollection'),
                onClick: () => void removeFromCollection([item]),
            }] : []),
            {
                type: 'custom' as const,
                icon: <Icon icon={Copy} size={15} />,
                label: t('library.cardMenu.copyToWorkspace'),
                onClick: () => setCopyFor([item]),
                separatorBefore: readOnly,
            },
        ],
    })
    const { setNotice, highlightedId, setHighlightedId } = actions

    // Per-workspace panels close on a committed switch (the page also remounts).
    const [panelEpoch, setPanelEpoch] = useState(workspaceEpoch)
    if (panelEpoch !== workspaceEpoch) {
        setPanelEpoch(workspaceEpoch)
        setPickerFor(null)
        setCopyFor(null)
        setCollectionForm(null)
        setPendingDeleteCollection(null)
        setSelectionMode(false)
        setDraggingItems(null)
        setDragOverTargetId(null)
        setDroppingTargetId(null)
    }

    // --- Reveal (View card) and the creator's return highlight ----------------------------
    const [revealed, setRevealed] = useState<{ key: string; item: GalleryItem } | null>(null)
    const revealKey = route.reveal && selectedWorkspaceId ? `${selectedWorkspaceId}:${workspaceEpoch}:${route.reveal.cardType}:${route.reveal.cardId}` : null
    useEffect(() => {
        if (!revealKey || !route.reveal || !api) return
        const ref = route.reveal
        if (!isContentTypeFeatureEnabled(ref.cardType)) return
        const scope = capture()
        let cancelled = false
        const galleryType = ref.cardType === 'adventure_template' ? 'adventure' : ref.cardType
        const fetchItem = galleryConfigFor(galleryType, api).fetchItem
        if (!fetchItem) return
        fetchItem(ref.cardId)
            .then((raw) => {
                if (cancelled || !isCurrent(scope)) return
                const item = galleryItemFromCard(ref.cardType, raw)
                if (!item) throw new Error('Card not found')
                setRevealed({ key: revealKey, item })
                setHighlightedId(item.id)
            })
            .catch(() => {
                if (cancelled || !isCurrent(scope)) return
                setNotice({ tone: 'error', title: t('library.reveal.missing') })
            })
        return () => {
            cancelled = true
        }
        // `route.reveal` is fully described by `revealKey`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api, capture, isCurrent, revealKey, setHighlightedId, setNotice, t, featureFlagGeneration])

    const revealedItem = revealed && revealed.key === revealKey ? revealed.item : null
    const displayItems = useMemo(() => {
        const visible = cards.items.filter((item) => isContentTypeFeatureEnabled(item.galleryType))
        if (!revealedItem || !isContentTypeFeatureEnabled(revealedItem.galleryType)) return visible
        return [revealedItem, ...visible.filter((item) => libraryItemKey(item) !== libraryItemKey(revealedItem))]
    }, [cards.items, revealedItem, featureFlagGeneration])

    const itemByKey = useMemo(
        () => new Map(displayItems.map((item) => [libraryItemKey(item), item])),
        [displayItems],
    )
    const draggingKeys = useMemo(
        () => new Set((draggingItems ?? []).map(libraryItemKey)),
        [draggingItems],
    )

    const [pendingReturn, setPendingReturn] = useState<ReturnType<typeof takeLibraryReturn>>(null)
    useEffect(() => {
        if (!selectedWorkspaceId) return
        const taken = takeLibraryReturn(selectedWorkspaceId)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (taken) setPendingReturn(taken)
    }, [selectedWorkspaceId])

    useEffect(() => {
        if (!pendingReturn || cards.loading || cards.key !== (selectedWorkspaceId ? libraryQueryKey(selectedWorkspaceId, route) : null)) return
        const { created, scrollY } = pendingReturn
        /* eslint-disable react-hooks/set-state-in-effect */
        setPendingReturn(null)
        if (scrollY !== null) scrollMainTo(scrollY)
        if (!created) return
        const match = cards.items.find((item) => sameCard(item, created))
        if (match) {
            setHighlightedId(match.id)
            window.setTimeout(() => {
                document.querySelector<HTMLElement>(`[data-gallery-card-id="${CSS.escape(match.id)}"]`)
                    ?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
            }, 40)
            return
        }
        // Saved, but the restored search/filters hide it: say so, never clear them silently.
        setNotice({
            tone: 'success',
            title: t('library.created.title'),
            message: t('library.created.hidden'),
            action: {
                label: t('library.created.view'),
                onClick: () => setPage('library', { hash: buildLibraryHash({ ...route, reveal: created }) }),
            },
        })
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [cards.items, cards.key, cards.loading, pendingReturn, route, selectedWorkspaceId, setHighlightedId, setNotice, setPage, t])

    // Clear the highlight after a moment.
    useEffect(() => {
        if (!highlightedId) return
        const timer = window.setTimeout(() => setHighlightedId((current) => (current === highlightedId ? null : current)), 3600)
        return () => window.clearTimeout(timer)
    }, [highlightedId, setHighlightedId])

    // Restore the root's scroll position when coming back from a folder.
    useEffect(() => {
        if (inCollection || cards.loading || cards.key !== locationKey) return
        const saved = rootScroll.get(locationKey)
        if (saved === undefined) return
        rootScroll.delete(locationKey)
        scrollMainTo(saved)
    }, [cards.key, cards.loading, inCollection, locationKey])

    // --- Navigation between root and folders ----------------------------------------------
    const openFolder = (collection: Collection) => {
        if (!inCollection) rootScroll.set(locationKey, mainScroller()?.scrollTop ?? 0)
        // A folder starts unfiltered at All types; the root keeps its search for the return.
        setPage('library', { hash: buildLibraryHash({ workspaceId: selectedWorkspaceId, collectionId: collection.id }) })
    }

    const backToRoot = () => {
        if (previousPage === 'library') goBack('library')
        else setPage('library', { hash: buildLibraryHash({ workspaceId: selectedWorkspaceId }) })
    }

    const clearFilters = () => {
        setSearchInput('')
        updateRoute({ query: '', typeFilter: 'all', uncollected: false })
    }

    const searchEverywhere = () => {
        setPage('library', { hash: buildLibraryHash({ workspaceId: selectedWorkspaceId, query: route.query }) })
    }

    // --- Membership ---------------------------------------------------------------------
    const membershipError = (error: unknown) =>
        isWorkspaceApiError(error, 'COLLECTION_NOT_FOUND') || isWorkspaceApiError(error, 'CONTENT_NOT_FOUND')
            ? t('library.membership.missing')
            : isWorkspaceApiError(error, 'WORKSPACE_ARCHIVED') ? t('workspaceUi.errors.archived') : t('library.membership.failed')

    const addToCollections = async (items: GalleryItem[], collectionIds: string[]): Promise<string | null> => {
        if (!api || !selectedWorkspaceId) return t('library.membership.failed')
        const scope = capture()
        const identities = items.map(identityOf)
        try {
            for (const collectionId of collectionIds) {
                for (const add of chunks(identities, MEMBERSHIP_CHUNK)) {
                    await api.setCollectionMembers(selectedWorkspaceId, collectionId, { add, remove: [] })
                }
            }
        } catch (error) {
            if (isCurrent(scope)) void collectionsState.refresh()
            return membershipError(error)
        }
        if (!isCurrent(scope)) return null
        if (!route.uncollected) {
            for (const item of items) {
                let nextItem = item
                for (const collectionId of collectionIds) {
                    nextItem = withUpdatedCardMembership(nextItem, collectionId, 'add', selectedWorkspaceId)
                }
                if (nextItem !== item) cards.upsertItem(nextItem)
            }
        }
        forgetLibraryCards(selectedWorkspaceId)
        void collectionsState.refresh()
        if (route.uncollected) cards.refresh()
        setPickerFor(null)
        setSelected(new Map())
        setNotice({
            tone: 'success',
            title: t('library.membership.addedTitle', { count: collectionIds.length }),
            message: t('library.membership.addedBody', { count: items.length }),
        })
        return null
    }

    const removeFromCollection = async (items: GalleryItem[]) => {
        if (!api || !selectedWorkspaceId || !route.collectionId || membershipBusy) return
        const collectionId = route.collectionId
        const scope = capture()
        setMembershipBusy(true)
        try {
            for (const remove of chunks(items.map(identityOf), MEMBERSHIP_CHUNK)) {
                await api.setCollectionMembers(selectedWorkspaceId, collectionId, { add: [], remove })
            }
            if (!isCurrent(scope)) return
            cards.removeItems(items.map(libraryItemKey))
            forgetLibraryCards(selectedWorkspaceId)
            void collectionsState.refresh()
            setSelected(new Map())
            setNotice({
                tone: 'success',
                title: t('library.membership.removedTitle', { name: currentCollection?.name ?? t('library.folder.kind') }),
                message: t('library.membership.removedBody'),
            })
        } catch (error) {
            if (isCurrent(scope)) setNotice({ tone: 'error', title: membershipError(error) })
        } finally {
            setMembershipBusy(false)
        }
    }

    // --- Drag-and-drop handlers ---------------------------------------------------------
    const resolveActiveDragItems = (event?: DragEvent<HTMLElement>): GalleryItem[] => {
        if (draggingItems && draggingItems.length > 0) return draggingItems
        const keys = readLibraryDragKeys(event)
        return keys
            .map((key) => itemByKey.get(key) ?? selected.get(key))
            .filter((item): item is GalleryItem => Boolean(item))
    }

    const startCardDrag = (event: DragEvent<HTMLDivElement>, item: GalleryItem) => {
        if (readOnly) {
            event.preventDefault()
            return
        }
        const items = resolveDragItems(item, selected)
        const badgeLabel = items.length === 1 ? items[0].title : t('library.drag.dragCount', { count: items.length })
        writeLibraryDragData(event, items, badgeLabel)
        setDraggingItems(items)
    }

    const endCardDrag = () => {
        clearLibraryDragData()
        setDraggingItems(null)
        setDragOverTargetId(null)
    }

    const folderDropState = (collection: Collection): FolderDropState => {
        if (readOnly || collection.id === route.collectionId) return 'idle'
        if (droppingTargetId === collection.id) return 'dropping'
        if (!draggingItems || draggingItems.length === 0) return 'idle'
        const allAlreadyIn = draggingItems.every((item) => cardCollectionIds(item).includes(collection.id))
        if (allAlreadyIn) return 'member'
        return dragOverTargetId === collection.id ? 'over' : 'ready'
    }

    const folderDropLabel = (): string => {
        const count = draggingItems?.length ?? 1
        return count > 1 ? t('library.drag.addMany', { count }) : t('library.drag.addOne')
    }

    const handleFolderDragOver = (event: DragEvent<HTMLDivElement>, collection: Collection) => {
        if (readOnly || collection.id === route.collectionId || !hasLibraryDragData(event)) return
        event.preventDefault()
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
        if (dragOverTargetId !== collection.id) setDragOverTargetId(collection.id)
    }

    const handleFolderDragLeave = (event: DragEvent<HTMLDivElement>, collection: Collection) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        if (dragOverTargetId === collection.id) setDragOverTargetId(null)
    }

    const handleFolderDrop = (event: DragEvent<HTMLDivElement>, collection: Collection) => {
        event.preventDefault()
        const items = resolveActiveDragItems(event)
        endCardDrag()
        if (readOnly || collection.id === route.collectionId || items.length === 0) return
        const allAlreadyIn = items.every((item) => cardCollectionIds(item).includes(collection.id))
        if (allAlreadyIn) {
            setNotice({
                tone: 'success',
                title: t('library.drag.alreadyInNotice', { name: collection.name }),
            })
            return
        }
        setDroppingTargetId(collection.id)
        void addToCollections(items, [collection.id])
            .then((message) => {
                if (message) setNotice({ tone: 'error', title: message })
            })
            .finally(() => {
                setDroppingTargetId((current) => (current === collection.id ? null : current))
            })
    }

    const handleRemoveDragOver = (event: DragEvent<HTMLDivElement>) => {
        if (readOnly || !inCollection || !hasLibraryDragData(event)) return
        event.preventDefault()
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
        if (dragOverTargetId !== 'remove') setDragOverTargetId('remove')
    }

    const handleRemoveDragLeave = (event: DragEvent<HTMLDivElement>) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        if (dragOverTargetId === 'remove') setDragOverTargetId(null)
    }

    const handleRemoveDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        const items = resolveActiveDragItems(event)
        endCardDrag()
        if (readOnly || !inCollection || items.length === 0) return
        void removeFromCollection(items)
    }

    // --- Collections CRUD (versions via If-Match) -----------------------------------------
    const submitCollection = async (values: CollectionFormValues): Promise<string | null> => {
        if (!api || !selectedWorkspaceId || !collectionForm) return t('library.collectionForm.failed')
        const scope = capture()
        try {
            if (collectionForm.mode === 'create') {
                const created = await api.createCollection(selectedWorkspaceId, values)
                if (!isCurrent(scope)) return null
                collectionsState.upsert(created)
                const addTo = collectionForm.thenAddTo
                setCollectionForm(null)
                if (addTo && addTo.length > 0) {
                    const message = await addToCollections(addTo, [created.id])
                    if (message) setNotice({ tone: 'error', title: message })
                }
                return null
            }
            const latest = collections.find((collection) => collection.id === collectionForm.collection.id) ?? collectionForm.collection
            const updated = await api.updateCollection(selectedWorkspaceId, latest.id, latest.row_version, values)
            if (isCurrent(scope)) collectionsState.upsert(updated)
            return null
        } catch (error) {
            if (isWorkspaceApiError(error, 'COLLECTION_VERSION_CONFLICT') || isWorkspaceApiError(error, 'COLLECTION_VERSION_REQUIRED')) {
                await collectionsState.refresh()
                return t('library.collectionForm.conflict')
            }
            if (isWorkspaceApiError(error, 'COLLECTION_NOT_FOUND')) {
                await collectionsState.refresh()
                return t('library.error.collectionMissing')
            }
            if (isWorkspaceApiError(error, 'WORKSPACE_ARCHIVED')) return t('workspaceUi.errors.archived')
            return t('library.collectionForm.failed')
        }
    }

    const confirmDeleteCollection = async () => {
        const target = pendingDeleteCollection
        if (!target || !api || !selectedWorkspaceId) return
        const scope = capture()
        setDeletingCollection(true)
        try {
            const latest = collections.find((collection) => collection.id === target.id) ?? target
            await api.deleteCollection(selectedWorkspaceId, latest.id, latest.row_version)
            if (!isCurrent(scope)) return
            collectionsState.remove(target.id)
            forgetLibraryCards(selectedWorkspaceId)
            setPendingDeleteCollection(null)
            setNotice({ tone: 'success', title: t('library.deleteCollection.deleted') })
            if (route.collectionId === target.id) setPage('library', { hash: buildLibraryHash({ workspaceId: selectedWorkspaceId }), replace: true })
        } catch (error) {
            if (!isCurrent(scope)) return
            setPendingDeleteCollection(null)
            if (isWorkspaceApiError(error, 'COLLECTION_VERSION_CONFLICT')) {
                void collectionsState.refresh()
                setNotice({ tone: 'error', title: t('library.collectionForm.conflict') })
            } else {
                setNotice({ tone: 'error', title: t('library.deleteCollection.failed') })
            }
        } finally {
            setDeletingCollection(false)
        }
    }

    const folderOptions = (collection: Collection): CardOption[] => readOnly ? [] : [
        { type: 'custom', icon: <Icon icon={Pencil} size={15} />, label: t('library.folder.rename'), onClick: () => setCollectionForm({ mode: 'edit', collection }) },
        { type: 'custom', icon: <Icon icon={Trash2} size={15} />, label: t('library.folder.delete'), onClick: () => setPendingDeleteCollection(collection), danger: true },
    ]

    // --- Creation and import --------------------------------------------------------------
    const destinationLabel = currentCollection && selectedWorkspace
        ? t('library.newMenu.destinationCollection', { workspace: selectedWorkspace.name, collection: currentCollection.name })
        : t('library.newMenu.destinationRoot', { workspace: selectedWorkspace?.name ?? '' })

    const importClient = useMemo(
        () => (selectedWorkspaceId
            ? apiService.withWorkspace(selectedWorkspaceId, { initialCollectionIds: route.collectionId ? [route.collectionId] : [] })
            : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [route.collectionId, selectedWorkspaceId, workspaceEpoch],
    )
    const [importOpen, setImportOpen] = useState(false)
    const [importPreview, setImportPreview] = useState<{ token: string; item: GalleryItem } | null>(null)
    const refreshCards = cards.refresh
    const refreshCollections = collectionsState.refresh
    const onImported = useCallback(() => {
        setImportPreview(null)
        if (selectedWorkspaceId) forgetLibraryCards(selectedWorkspaceId)
        refreshCards()
        void refreshCollections()
    }, [refreshCards, refreshCollections, selectedWorkspaceId, setImportPreview])
    const importHook = useCardImport({ client: importClient, onImported })

    const startCreation = (kind: LibraryNewKind) => {
        if (kind === 'collection') {
            setCollectionForm({ mode: 'create' })
            return
        }
        if (kind === 'import') {
            setImportOpen(true)
            return
        }
        if (!selectedWorkspaceId) return
        // Where the card will be saved, and where Back to Library returns.
        creationOrigin.capture({
            workspaceId: selectedWorkspaceId,
            collectionId: route.collectionId,
            returnTo: libraryLocationFor(route, mainScroller()?.scrollTop ?? null),
        })
        if (kind === 'character' || kind === 'persona') {
            setEditingCharacter(null)
            setPage('character', { hash: kind === 'persona' ? buildPersonaCreatorHash() : pageHash('character') })
        } else if (kind === 'world') {
            setEditingWorld(null)
            setPage('world', { hash: pageHash('world') })
        } else if (kind === 'item') {
            setEditingItem(null)
            setPage('item', { hash: pageHash('item') })
        } else {
            setEditingTemplate(null)
            setPage('adventure', { hash: pageHash('adventure') })
        }
    }

    // --- Copy -----------------------------------------------------------------------------
    const copyCards: CopyCardRef[] = (copyFor ?? []).map((item) => ({ cardType: item.backendType, cardId: item.id, title: item.title }))
    const destinations = activeWorkspaces.filter((workspace) => workspace.id !== selectedWorkspaceId)
    const viewCopies = (destination: Workspace, outcome: CopyOutcome) => {
        setCopyFor(null)
        setSelected(new Map())
        const only = outcome.result.cards.length === 1 ? outcome.result.cards[0].destination : null
        // The destination's folders and lists changed: never show its stale cache.
        forgetLibraryCards(destination.id)
        forgetLibraryCollections(destination.id)
        // Guarded like any switch: unsaved work asks first, a cancel keeps this workspace.
        void navigate({
            page: 'library',
            hash: buildLibraryHash({ workspaceId: destination.id, reveal: only ? { cardType: only.card_type, cardId: only.card_id } : null }),
            workspace: destination,
        })
    }

    // --- Rendering ------------------------------------------------------------------------
    const typeOptions = LIBRARY_TYPE_FILTERS
        .filter((filter) => filter !== 'adventure' || adventuresEnabled)
        .map((filter) => ({ value: filter, label: t(`library.type.${filter}`) }))

    const typeLabel = (item: GalleryItem) => {
        const base = t(`library.type.${item.galleryType}`)
        return item.galleryType === 'adventure' && item.eyebrow ? `${base} · ${item.eyebrow}` : base
    }

    const cardCollectionNames = useCallback(
        (item: GalleryItem): string[] =>
            cardCollectionIds(item)
                .map((id) => collectionNameById.get(id))
                .filter((name): name is string => Boolean(name)),
        [collectionNameById],
    )

    const primaryAction = (item: GalleryItem) => {
        if (selectionMode) toggleSelected(item)
        else actions.primaryAction(item)
    }

    const emptyTitle = filtersActive
        ? (inCollection ? t('library.empty.noMatchCollectionTitle', { name: currentCollection?.name ?? '' }) : t('library.empty.noMatchTitle'))
        : inCollection ? t('library.empty.collectionTitle') : t('library.empty.libraryTitle')
    const emptyDescription = filtersActive
        ? t('library.empty.noMatchBody')
        : inCollection ? t('library.empty.collectionBody') : t('library.empty.libraryBody')
    const emptyAction = filtersActive ? (
        <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={clearFilters}>{t('library.empty.clearFilters')}</Button>
            {inCollection && route.query.trim() && (
                <Button variant="primary" size="sm" iconLeft={<Icon icon={Search} size={15} />} onClick={searchEverywhere}>
                    {t('library.search.everywhere')}
                </Button>
            )}
        </div>
    ) : inCollection ? (
        <Button variant="secondary" size="sm" onClick={backToRoot}>{t('library.empty.browse')}</Button>
    ) : undefined

    const notice = actions.notice ?? importHook.actionNotice
    const closeNotice = () => (actions.notice ? setNotice(null) : importHook.setActionNotice(null))
    const showCounts = !cards.loading && !cards.error
    const showEmptyCollectionsPrompt =
        !inCollection &&
        !readOnly &&
        !filtersActive &&
        !collectionsState.loading &&
        !collectionsState.error &&
        collections.length === 0

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={selectedWorkspace?.name ?? t('library.eyebrow')}
                title={currentCollection?.name ?? t('library.title')}
                subtitle={currentCollection?.description ?? undefined}
                size="lg"
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        {isGroupChatsFeatureEnabled() && !readOnly && !inCollection && (
                            <Button
                                variant="secondary"
                                iconLeft={<Icon icon={Users} size={16} />}
                                onClick={() => setPage('gallery-characters', { hash: buildGalleryModeHash('character', 'group-chat') })}
                                className="shrink-0"
                            >
                                {t('library.groupChat')}
                            </Button>
                        )}
                        {inCollection && currentCollection && !readOnly && (
                            <CardOptions
                                options={folderOptions(currentCollection)}
                                forceMenu
                                aria-label={t('library.folder.menu', { name: currentCollection.name })}
                                className="shrink-0"
                                triggerTestId="collection-header-options-button"
                            />
                        )}
                        {!readOnly && (
                            <LibraryNewMenu
                                inCollection={inCollection}
                                adventuresEnabled={adventuresEnabled}
                                importEnabled={isCommunityCardsFeatureEnabled()}
                                destinationLabel={destinationLabel}
                                onSelect={startCreation}
                            />
                        )}
                    </div>
                }
            />

            <nav aria-label={t('library.location.label')} className="-mt-3 flex min-w-0 items-center gap-2 font-ui text-sm">
                {inCollection ? (
                    <>
                        <Button variant="ghost" size="sm" iconLeft={<Icon icon={ChevronLeft} size={15} />} onClick={backToRoot} className="sm:hidden">
                            {t('library.location.back')}
                        </Button>
                        <ol className="hidden min-w-0 items-center gap-1.5 sm:flex">
                            <li>
                                <button type="button" onClick={backToRoot}
                                    className="rounded-sm text-fg-muted transition-colors hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500">
                                    {t('library.location.root')}
                                </button>
                            </li>
                            <li aria-hidden="true"><Icon icon={ChevronRight} size={14} className="text-fg-faint" /></li>
                            <li aria-current="location" className="min-w-0 truncate font-semibold text-fg">{currentCollection?.name ?? t('library.folder.kind')}</li>
                        </ol>
                    </>
                ) : (
                    <span aria-current="location" className="font-semibold text-fg">{t('library.location.root')}</span>
                )}
            </nav>

            {inCollection && collections.length > 0 && (
                <div
                    role="region"
                    aria-label={t('library.sections.shelfLabel')}
                    data-testid="library-collection-shelf"
                    className="-mt-2 flex items-center gap-2 overflow-x-auto pb-1"
                >
                    {!readOnly && currentCollection && (
                        <div
                            data-testid="library-drop-remove"
                            data-drop-state={dragOverTargetId === 'remove' ? 'over' : draggingItems ? 'ready' : 'idle'}
                            onDragOver={handleRemoveDragOver}
                            onDragEnter={handleRemoveDragOver}
                            onDragLeave={handleRemoveDragLeave}
                            onDrop={handleRemoveDrop}
                            className={cx(
                                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-ui text-xs font-semibold transition-all',
                                dragOverTargetId === 'remove'
                                    ? 'border-blood-500 bg-blood-500/15 text-blood-300 shadow-glow-blood scale-[1.01]'
                                    : draggingItems
                                      ? 'border-dashed border-ember-500/50 bg-surface-raised/90 text-ember-300'
                                      : 'border-line-faint bg-surface-raised/40 text-fg-muted',
                            )}
                        >
                            <Icon icon={FolderMinus} size={14} className="shrink-0" />
                            <span>
                                {dragOverTargetId === 'remove'
                                    ? t('library.drag.dropRemoveHint', { name: currentCollection.name })
                                    : t('library.drag.removeFrom', { name: currentCollection.name })}
                            </span>
                        </div>
                    )}
                    {collections.map((collection) => (
                        <CollectionFolder
                            key={collection.id}
                            collection={collection}
                            view="pill"
                            active={collection.id === route.collectionId}
                            dropState={folderDropState(collection)}
                            dropLabel={folderDropLabel()}
                            onOpen={() => openFolder(collection)}
                            onDragOver={(event) => handleFolderDragOver(event, collection)}
                            onDragEnter={(event) => handleFolderDragOver(event, collection)}
                            onDragLeave={(event) => handleFolderDragLeave(event, collection)}
                            onDrop={(event) => handleFolderDrop(event, collection)}
                        />
                    ))}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-b border-line-faint pb-5">
                <div className="relative flex w-full items-center sm:w-80 sm:max-w-full">
                    <span className="pointer-events-none absolute left-3 flex items-center text-parchment-400">
                        <Icon icon={Search} size={16} />
                    </span>
                    <input
                        type="search"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') setSearchInput('')
                        }}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        maxLength={200}
                        className={cx(controlClass, 'rounded-full pl-10', searchInput ? 'pr-12' : 'pr-4')}
                        data-testid="library-search-input"
                    />
                    {searchInput && (
                        <IconButton size="sm" onClick={() => { setSearchInput(''); updateRoute({ query: '' }) }} label={t('library.search.clear')} className="absolute right-2">
                            <Icon icon={X} size={16} />
                        </IconButton>
                    )}
                </div>
                <Select
                    options={typeOptions}
                    value={route.typeFilter}
                    onChange={(value) => updateRoute({ typeFilter: value as LibraryTypeFilter })}
                    aria-label={t('library.type.label')}
                    size="sm"
                    className="w-44"
                />
                {!inCollection && (
                    <Chip
                        active={route.uncollected}
                        aria-pressed={route.uncollected}
                        icon={route.uncollected ? <Icon icon={CheckCircle2} size={13} /> : undefined}
                        onClick={() => updateRoute({ uncollected: !route.uncollected })}
                    >
                        {t('library.uncollected')}
                    </Chip>
                )}
                <div className="flex items-center gap-2 sm:ml-auto">
                    <GalleryViewToggle value={layoutView} onChange={setLayoutView} className="shrink-0" />
                    <Button
                        variant={selectionMode ? 'primary' : 'secondary'}
                        size="sm"
                        iconLeft={<Icon icon={CheckSquare} size={15} />}
                        aria-pressed={selectionMode}
                        onClick={() => {
                            setSelectionMode((current) => !current)
                            setSelected(new Map())
                        }}
                    >
                        {selectionMode ? t('library.selection.done') : t('library.selection.enter')}
                    </Button>
                </div>
            </div>

            {showCounts && (
                <p className="-mt-3 font-ui text-caption text-fg-muted" aria-live="polite" data-testid="library-counts">
                    {inCollection
                        ? t('library.counts.cards', { count: cards.total })
                        : `${t('library.counts.collections', { count: visibleFolders.length })} · ${t('library.counts.cards', { count: cards.total })}`}
                    {searching && <span className="sr-only">{t('common.loading')}</span>}
                </p>
            )}

            {selectionMode && (
                <BulkSelectionBar
                    count={selected.size}
                    pageCount={displayItems.length}
                    inCollection={inCollection}
                    readOnly={readOnly}
                    busy={membershipBusy}
                    onSelectPage={() => setSelected(new Map(displayItems.map((item) => [libraryItemKey(item), item])))}
                    onClear={() => setSelected(new Map())}
                    onDone={() => {
                        setSelectionMode(false)
                        setSelected(new Map())
                    }}
                    onAddToCollection={() => setPickerFor([...selected.values()])}
                    onRemoveFromCollection={() => void removeFromCollection([...selected.values()])}
                    onCopyToWorkspace={() => setCopyFor([...selected.values()])}
                />
            )}

            {collectionMissing && (
                <Callout tone="warning" role="alert" action={<Button variant="secondary" size="sm" onClick={backToRoot}>{t('library.location.back')}</Button>}>
                    {t('library.error.collectionMissing')}
                </Callout>
            )}
            {collectionsState.error && (
                <Callout tone="danger" role="alert" action={
                    <Button variant="secondary" size="sm" iconLeft={<RefreshCw size={14} />} onClick={() => void collectionsState.refresh()}>{t('library.error.retry')}</Button>
                }>
                    {t('library.error.collections')}
                </Callout>
            )}
            {cards.error && !collectionMissing && (
                <Callout tone="danger" role="alert" action={
                    <Button variant="secondary" size="sm" iconLeft={<RefreshCw size={14} />} onClick={cards.refresh}>{t('library.error.retry')}</Button>
                }>
                    {t('library.error.cards')}
                </Callout>
            )}

            <Toast
                open={Boolean(notice)}
                tone={notice?.tone ?? 'success'}
                title={notice?.title}
                message={notice?.message}
                action={actions.notice?.action}
                autoCloseMs={notice?.tone === 'success' && !actions.notice?.action ? 3200 : false}
                onClose={closeNotice}
            />

            <div className="flex flex-col gap-5" data-testid="library-browser">
                {!inCollection && (visibleFolders.length > 0 || showEmptyCollectionsPrompt) && (
                    <section className="flex flex-col gap-3" aria-label={t('library.sections.collections')}>
                        <SectionHeader
                            icon={Folder}
                            title={t('library.sections.collections')}
                            right={
                                !readOnly ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        iconLeft={<Icon icon={FolderPlus} size={15} />}
                                        onClick={() => setCollectionForm({ mode: 'create' })}
                                        data-testid="library-quick-new-collection"
                                    >
                                        {t('library.newMenu.collection')}
                                    </Button>
                                ) : undefined
                            }
                        />
                        {visibleFolders.length > 0 ? (
                            <ul
                                className={cx('grid gap-3', layoutView === 'list' ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]')}
                                aria-label={t('library.counts.collections', { count: visibleFolders.length })}
                                data-testid="library-folders"
                            >
                                {visibleFolders.map((collection) => (
                                    <li key={collection.id}>
                                        <CollectionFolder
                                            collection={collection}
                                            view={layoutView === 'list' ? 'row' : 'card'}
                                            dropState={folderDropState(collection)}
                                            dropLabel={folderDropLabel()}
                                            onOpen={() => openFolder(collection)}
                                            options={folderOptions(collection)}
                                            onDragOver={(event) => handleFolderDragOver(event, collection)}
                                            onDragEnter={(event) => handleFolderDragOver(event, collection)}
                                            onDragLeave={(event) => handleFolderDragLeave(event, collection)}
                                            onDrop={(event) => handleFolderDrop(event, collection)}
                                        />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line bg-surface-raised/30 px-4 py-3">
                                <p className="font-ui text-sm text-fg-muted">{t('library.sections.emptyCollectionsHint')}</p>
                            </div>
                        )}
                    </section>
                )}

                {!inCollection && (visibleFolders.length > 0 || showEmptyCollectionsPrompt) && (
                    <SectionHeader icon={Sparkles} title={t('library.sections.cards')} />
                )}

                <CardGrid
                    items={displayItems}
                    layout={cardGridLayout(layoutView)}
                    density={cardGridDensity(layoutView)}
                    getItemKey={libraryItemKey}
                    loading={cards.loading && displayItems.length === 0}
                    renderSkeleton={() => <GalleryCardSkeleton view={galleryCardView(layoutView)} />}
                    hasMore={cards.hasMore}
                    loadingMore={cards.loadingMore}
                    onLoadMore={cards.loadMore}
                    emptyStateTitle={emptyTitle}
                    emptyStateDescription={emptyDescription}
                    emptyStateAction={emptyAction}
                    showEmptyState={!cards.error && !collectionMissing}
                    data-testid="library-cards"
                    renderCard={(item) => {
                        const key = libraryItemKey(item)
                        const isSelected = selected.has(key)
                        const isDragging = draggingKeys.has(key)
                        const usageType = versionableCardTypeFor(item.galleryType)
                        const itemCollections = !inCollection ? cardCollectionNames(item) : undefined
                        return (
                            <GalleryCard
                                id={item.id}
                                view={galleryCardView(layoutView)}
                                title={item.title}
                                badge={item.badge}
                                markerBadge={actions.markerFor(item)}
                                eyebrow={typeLabel(item)}
                                description={item.description}
                                tags={item.tags}
                                imageUrl={item.imageUrl}
                                themeSongUrl={item.themeSongUrl}
                                cardType={playlistCardType(item)}
                                cardId={item.id}
                                versionNumber={item.versionNumber}
                                hasDraft={item.hasDraft}
                                usageCardType={usageType ?? undefined}
                                usageEnabled={usageType !== null}
                                collectionNames={itemCollections}
                                draggable={!readOnly}
                                isDragging={isDragging}
                                onDragStart={(event) => startCardDrag(event, item)}
                                onDragEnd={endCardDrag}
                                shareOptions={selectionMode ? undefined : actions.shareOptionsFor(item)}
                                deleting={actions.deletingId === item.id}
                                onClick={() => primaryAction(item)}
                                actionLabel={selectionMode
                                    ? t(isSelected ? 'library.selection.deselect' : 'library.selection.select', { title: item.title })
                                    : actions.actionLabelFor(item)}
                                onTagClick={selectionMode ? undefined : setSearchInput}
                                options={selectionMode ? undefined : actions.optionsFor(item)}
                                highlighted={selectionMode ? isSelected : highlightedId === item.id}
                                footer={selectionMode ? (
                                    <Button
                                        variant={isSelected ? 'primary' : 'secondary'}
                                        size="sm"
                                        full
                                        aria-pressed={isSelected}
                                        aria-label={t(isSelected ? 'library.selection.deselect' : 'library.selection.select', { title: item.title })}
                                        iconLeft={<Icon icon={isSelected ? CheckCircle2 : Plus} size={15} />}
                                        onClick={() => toggleSelected(item)}
                                    >
                                        {isSelected ? t('gallery.selected') : t('gallery.select')}
                                    </Button>
                                ) : actions.footerFor(item)}
                            />
                        )
                    }}
                />
                {/* Explicit paging next to the scroll trigger (keyboard and screen-reader users). */}
                {cards.hasMore && displayItems.length > 0 && (
                    <div className="flex justify-center">
                        <Button variant="secondary" onClick={cards.loadMore} disabled={cards.loadingMore} data-testid="library-load-more">
                            {cards.loadingMore ? t('library.loadingMore') : t('library.loadMore')}
                        </Button>
                    </div>
                )}
            </div>

            {actions.overlays}

            <CollectionPickerDialog
                open={pickerFor !== null && collectionForm === null}
                collections={collections}
                loading={collectionsState.loading}
                cardCount={pickerFor?.length ?? 0}
                excludeId={route.collectionId}
                memberCollectionIds={pickerMemberships.allIn}
                partialCollectionIds={pickerMemberships.someIn}
                onClose={() => setPickerFor(null)}
                onCreateCollection={() => setCollectionForm({ mode: 'create', thenAddTo: pickerFor ?? undefined })}
                onConfirm={(ids) => addToCollections(pickerFor ?? [], ids)}
            />

            <CollectionFormDialog
                open={collectionForm !== null}
                collection={collectionForm?.mode === 'edit' ? collectionForm.collection : null}
                onClose={() => setCollectionForm(null)}
                onSubmit={submitCollection}
            />

            <ConfirmDialog
                visible={pendingDeleteCollection !== null}
                title={t('library.deleteCollection.title', { name: pendingDeleteCollection?.name ?? '' })}
                message={t('library.deleteCollection.body')}
                confirmLabel={t('library.deleteCollection.confirm')}
                variant="danger"
                isProcessing={deletingCollection}
                onConfirm={() => void confirmDeleteCollection()}
                onCancel={() => setPendingDeleteCollection(null)}
            />

            {selectedWorkspace && (
                <CopyToWorkspaceDrawer
                    open={copyFor !== null}
                    onClose={() => setCopyFor(null)}
                    source={selectedWorkspace}
                    cards={copyCards}
                    destinations={destinations}
                    onViewCopies={viewCopies}
                />
            )}

            <ImportCardDialog
                open={importOpen}
                destination={currentCollection && selectedWorkspace ? `${selectedWorkspace.name} / ${currentCollection.name}` : selectedWorkspace?.name ?? ''}
                onClose={() => setImportOpen(false)}
                onResolved={(token, item) => {
                    setImportOpen(false)
                    setImportPreview({ token, item })
                }}
            />
            <CardImportOverlays
                importHook={importHook}
                previewItem={importPreview?.item ?? null}
                onClosePreview={() => setImportPreview(null)}
                toSource={(item) => ({ kind: 'shared', token: importPreview?.token ?? '', item })}
            />
        </div>
    )
}
