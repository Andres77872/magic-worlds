/**
 * GalleryPage — full-page, server-searched library for one card type. A dense
 * image-forward grid (GalleryCard) with a masthead search bar (name + triggers,
 * debounced server query) and skip/limit infinite scroll. Actions reuse the
 * DataProvider flows (edit/begin/chat/delete) so the dashboard stays in sync.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpenText, CheckCircle2, Download, Globe2, Import, Link2, Loader2, Pencil, Phone, Play, Plus, MessageCircle, Search, Trash2, Users, X } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import type { PlaylistTrack } from '@/app/providers/audioPlaylistContext'
import type { Adventure, Character, Item, World } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { CardGrid, GalleryCard, GalleryCardSkeleton, PersonaPickerDialog, type CardOption } from '@/ui/components'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Button, Chip, controlClass, Icon, IconButton, PageHeader, Toast } from '@/ui/primitives'
import { defaultPersona } from '@/utils/characterRoles'
import { downloadBlob, safeFilename } from '@/utils/download'
import { useStartCall } from '@/features/call'
import { isFrontendVoiceModeEnabled } from '@/shared/voiceFeatureFlag'
import { GALLERY_CONFIG, publicConfigFor, publicItems, type GalleryItem, type GalleryType } from '../galleryConfig'
import { buildGalleryModeHash, buildGalleryViewHash, buildSharedCardUrl, galleryPageForType, parseGalleryHash } from '../galleryLinks'
import { useCardGallery } from '../hooks/useCardGallery'
import { useCardImport, useGalleryCardPreview } from '../hooks/useCardImport'
import { CardImportOverlays } from './CardImportOverlays'

export interface GalleryPageProps {
    type: GalleryType
}

interface ActionNotice {
    tone: 'success' | 'error'
    title: string
    message?: string
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

async function writeClipboardText(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) throw new Error('Clipboard copy failed')
}

function startErrorCopy(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.trim() ? error.message : fallback
}

export function GalleryPage({ type }: GalleryPageProps) {
    const { t } = useTranslation()
    const config = GALLERY_CONFIG[type]
    const [viewMode, setViewMode] = useState<'mine' | 'public'>(() => galleryViewFor(type))
    const publicConfig = useMemo(() => publicConfigFor(type), [type])
    const activeConfig = viewMode === 'public' ? publicConfig : config
    const isPublicView = viewMode === 'public'
    const gallery = useCardGallery(activeConfig)
    const { upsertItem } = gallery
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const {
        editCharacter,
        setEditingCharacter,
        deleteCharacter,
        characters,
        startCharacterChat,
        startCharacterGroupChat,
        editWorld,
        setEditingWorld,
        deleteWorld,
        editItem,
        setEditingItem,
        deleteItem,
        editTemplate,
        setEditingTemplate,
        startTemplate,
        deleteTemplateById,
        createStory,
    } = useData()

    const importHook = useCardImport()
    const preview = useGalleryCardPreview()
    const [pendingDelete, setPendingDelete] = useState<GalleryItem | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [exportingId, setExportingId] = useState<string | null>(null)
    const [sharingId, setSharingId] = useState<string | null>(null)
    const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null)
    const [linkedCardId, setLinkedCardId] = useState<string | null>(() => linkedCardIdFor(type))
    const [highlightedId, setHighlightedId] = useState<string | null>(() => linkedCardIdFor(type))
    const [groupSelectionMode, setGroupSelectionMode] = useState(() => groupModeFor(type))
    const [selectedGroupItems, setSelectedGroupItems] = useState<Record<string, GalleryItem>>({})
    const [startingChatId, setStartingChatId] = useState<string | null>(null)
    const fetchedLinkedRef = useRef<string | null>(null)
    const openLoginModalRef = useRef(openLoginModal)
    const [personaPick, setPersonaPick] = useState<
        | { kind: 'adventure'; item: GalleryItem }
        | { kind: 'chat'; item: GalleryItem }
        | { kind: 'group-chat'; items: GalleryItem[] }
        | null
    >(null)
    const [personaPickError, setPersonaPickError] = useState<string | null>(null)
    const [isPersonaPickConfirming, setIsPersonaPickConfirming] = useState(false)
    const voiceModeEnabled = isFrontendVoiceModeEnabled()
    const callControls = useStartCall()
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

    useEffect(() => {
        openLoginModalRef.current = openLoginModal
    }, [openLoginModal])

    useEffect(() => {
        if (isPublicView && !isAuthenticated) openLoginModal()
    }, [isAuthenticated, isPublicView, openLoginModal])

    useEffect(() => {
        const syncLinkedCard = () => {
            const next = linkedCardIdFor(type)
            const nextView = galleryViewFor(type)
            setViewMode(nextView)
            setLinkedCardId(next)
            if (next) setHighlightedId(next)
            const nextGroupMode = nextView === 'mine' && type === 'character' && groupModeFor(type)
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
    }, [type])

    useEffect(() => {
        if (!linkedCardId || !activeConfig.fetchItem || !activeConfig.toItem) return
        if (gallery.loading) return
        if (!isAuthenticated) {
            openLoginModalRef.current()
            return
        }
        const key = `${viewMode}:${type}:${linkedCardId}`
        if (fetchedLinkedRef.current === key) return
        fetchedLinkedRef.current = key
        let cancelled = false

        void activeConfig.fetchItem(linkedCardId)
            .then((raw) => {
                if (cancelled) return
                const item = activeConfig.toItem?.(raw)
                if (!item) throw new Error('Card not found')
                upsertItem(item)
                setHighlightedId(item.id)
            })
            .catch((error) => {
                if (cancelled) return
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
    }, [activeConfig, gallery.loading, isAuthenticated, linkedCardId, type, upsertItem, viewMode])

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
    }, [gallery.items, linkedCardId])

    const requireAuth = (action: () => void) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        action()
    }

    const switchViewMode = (mode: 'mine' | 'public') => {
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
        const items = Object.values(selectedGroupItems)
        if (items.length < 2) {
            setActionNotice({
                tone: 'error',
                title: t('gallery.groupMinTitle'),
                message: t('gallery.groupMinBody'),
            })
            return
        }
        setPersonaPickError(null)
        setPersonaPick({ kind: 'group-chat', items })
    }

    const openChatPersonaPicker = (item: GalleryItem) => {
        setPersonaPickError(null)
        setPersonaPick({ kind: 'chat', item })
    }

    const startCharacterChatFromCard = (item: GalleryItem) => {
        requireAuth(() => {
            const persona = defaultPersona(characters)
            if (!persona) {
                openChatPersonaPicker(item)
                return
            }
            if (startingChatId) return

            setActionNotice(null)
            setStartingChatId(item.id)
            void startCharacterChat(item.source as Character, persona)
                .then(() => setPage('character-chat'))
                .catch((error) => {
                    console.error('Failed to start character chat:', error)
                    setActionNotice({
                        tone: 'error',
                        title: t('gallery.action.startChatFailed'),
                        message: startErrorCopy(error, t('gallery.action.tryAgain')),
                    })
                })
                .finally(() => {
                    setStartingChatId((current) => (current === item.id ? null : current))
                })
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
        if (type === 'character' || type === 'persona') {
            requireAuth(() => {
                editCharacter(item.source as Character)
                setPage('character')
            })
        } else if (type === 'world') {
            requireAuth(() => {
                editWorld(item.source as World)
                setPage('world')
            })
        } else if (type === 'item') {
            requireAuth(() => {
                editItem(item.source as Item)
                setPage('item')
            })
        } else {
            requireAuth(() => {
                setPersonaPickError(null)
                setPersonaPick({ kind: 'adventure', item })
            })
        }
    }

    const exportCard = async (item: GalleryItem) => {
        if (exportingId) return
        setActionNotice(null)
        setExportingId(item.id)
        try {
            const exportType = type === 'adventure' ? 'adventure_template' : type === 'persona' ? 'character' : type
            const blob = await apiService.exportCardImage(exportType, item.id)
            downloadBlob(blob, `${safeFilename(item.title, 'card')}.png`)
        } catch (error) {
            console.error('Failed to export card image:', error)
            setActionNotice({
                tone: 'error',
                title: t('gallery.action.exportFailed'),
                message: t('gallery.action.exportBody', { title: item.title.slice(0, 80) }),
            })
        } finally {
            setExportingId(null)
        }
    }

    const copyShareLink = async (item: GalleryItem) => {
        if (sharingId) return
        setActionNotice(null)
        setSharingId(item.id)
        try {
            const share = await apiService.createCardShareLink(item.backendType, item.id)
            await writeClipboardText(buildSharedCardUrl(share.share_token))
            const updated = publicItems(share.resource, type)[0]
            if (updated) upsertItem(updated)
            setActionNotice({
                tone: 'success',
                title: t('gallery.action.linkCopied'),
                message: t('gallery.action.linkCopiedBody', { title: item.title.slice(0, 80) }),
            })
        } catch (error) {
            console.error('Failed to copy gallery card link:', error)
            setActionNotice({ tone: 'error', title: t('gallery.action.copyFailed'), message: t('gallery.action.tryAgain') })
        } finally {
            setSharingId(null)
        }
    }

    const togglePublicCard = async (item: GalleryItem) => {
        if (sharingId) return
        setActionNotice(null)
        setSharingId(item.id)
        const isPublic = Boolean(item.visibility?.public)
        try {
            const resource = isPublic
                ? await apiService.unpublishCard(item.backendType, item.id)
                : await apiService.publishCard(item.backendType, item.id)
            const updated = publicItems(resource, type)[0]
            if (updated) upsertItem(updated)
            setActionNotice({
                tone: 'success',
                title: isPublic ? t('gallery.action.publicRemoved') : t('gallery.action.publicShared'),
                message: isPublic
                    ? t('gallery.action.publicRemovedBody', { title: item.title.slice(0, 80) })
                    : t('gallery.action.publicSharedBody', { title: item.title.slice(0, 80) }),
            })
        } catch (error) {
            console.error('Failed to update public card visibility:', error)
            setActionNotice({
                tone: 'error',
                title: t('gallery.action.publicFailed'),
                message: startErrorCopy(error, t('gallery.action.tryAgain')),
            })
        } finally {
            setSharingId(null)
        }
    }

    const shareOptionsFor = (item: GalleryItem): CardOption[] => [
        {
            type: 'custom',
            icon: <Icon icon={Link2} size={15} />,
            label: sharingId === item.id ? t('gallery.copyingLink') : t('gallery.copyUnlistedLink'),
            onClick: () => requireAuth(() => void copyShareLink(item)),
            disabled: sharingId !== null,
        },
        {
            type: 'custom',
            icon: <Icon icon={Globe2} size={15} />,
            label: item.visibility?.public ? t('gallery.removeFromPublic') : t('gallery.shareAsPublic'),
            onClick: () => requireAuth(() => void togglePublicCard(item)),
            disabled: sharingId !== null,
        },
        {
            type: 'custom',
            icon: <Icon icon={Download} size={15} />,
            label: exportingId === item.id ? t('gallery.downloading') : t('gallery.downloadPng'),
            onClick: () => requireAuth(() => void exportCard(item)),
            disabled: exportingId !== null,
            separatorBefore: true,
        },
    ]

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
        const edit = () => primaryAction(item)
        const options: CardOption[] = []
        const writeFromCard = () =>
            requireAuth(() => {
                const source =
                    type === 'character' || type === 'persona'
                        ? { kind: 'character' as const, id: item.id, title: item.title }
                        : type === 'world'
                          ? { kind: 'world' as const, id: item.id, title: item.title }
                          : type === 'item'
                            ? { kind: 'item' as const, id: item.id, title: item.title }
                            : { kind: 'adventure_template' as const, id: item.id, title: item.title }
                const cardRefKind = type === 'adventure' ? 'adventure_template' : type === 'persona' ? 'character' : type
                void createStory({
                    title: t('gallery.novelTitle', { title: item.title }),
                    source,
                    chapters: [{ title: t('gallery.chapterOne'), body: '', status: 'draft', order: 0 }],
                    cardRefs: [{ kind: cardRefKind, cardId: item.id, source: 'source' }],
                }).then(() => setPage('story'))
            })
        options.push({
            type: 'custom',
            icon: <Icon icon={BookOpenText} size={15} />,
            label: t('gallery.write'),
            onClick: writeFromCard,
        })
        if (type === 'character') {
            options.push({
                type: 'custom',
                icon: <Icon icon={MessageCircle} size={15} />,
                label: t('gallery.chat'),
                onClick: () => startCharacterChatFromCard(item),
                disabled: Boolean(startingChatId),
            })
            if (voiceModeEnabled) {
                options.push({
                    type: 'custom',
                    icon: <Icon icon={Phone} size={15} />,
                    label: t('gallery.call'),
                    onClick: () => callControls.startCall(item.source as Character),
                    disabled: callControls.startingId === item.id,
                })
            }
        }
        if (type === 'adventure') {
            options.push({
                type: 'custom',
                icon: <Icon icon={Play} size={15} />,
                label: t('gallery.beginAdventure'),
                onClick: () => primaryAction(item),
            })
            options.push({
                type: 'custom',
                icon: <Icon icon={Pencil} size={15} />,
                label: t('gallery.edit'),
                onClick: () =>
                    requireAuth(() => {
                        editTemplate(item.source as Adventure)
                        setPage('adventure')
                    }),
            })
        } else {
            options.push({
            type: 'custom',
            icon: <Icon icon={Pencil} size={15} />,
                label: t('gallery.edit'),
                onClick: edit,
            })
        }
        options.push({
            type: 'custom',
            icon: <Icon icon={Trash2} size={15} />,
            label: t('gallery.delete'),
            onClick: () => requireAuth(() => setPendingDelete(item)),
            danger: true,
        })
        return options
    }

    const confirmDelete = async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target) return
        setDeletingId(target.id)
        try {
            if (type === 'character' || type === 'persona') await deleteCharacter(target.id)
            else if (type === 'world') await deleteWorld(target.id)
            else if (type === 'item') await deleteItem(target.id)
            else await deleteTemplateById(target.id)
            gallery.removeItem(target.id)
        } catch (error) {
            console.error('Failed to delete from gallery:', error)
        } finally {
            setDeletingId(null)
        }
    }

    const hasQuery = gallery.query.trim().length > 0

    const closePersonaPick = () => {
        if (isPersonaPickConfirming) return
        setPersonaPick(null)
        setPersonaPickError(null)
    }

    const confirmPersonaPick = async (persona: Character) => {
        const pending = personaPick
        if (!pending || isPersonaPickConfirming) return
        setPersonaPickError(null)
        setIsPersonaPickConfirming(true)
        try {
            if (pending.kind === 'adventure') {
                await startTemplate(pending.item.source as Adventure, persona)
                setPersonaPick(null)
                setPage('interaction')
            } else if (pending.kind === 'chat') {
                await startCharacterChat(pending.item.source as Character, persona)
                setPersonaPick(null)
                setPage('character-chat')
            } else {
                await startCharacterGroupChat(pending.items.map((item) => item.source as Character), persona)
                setSelectedGroupItems({})
                setGroupSelectionMode(false)
                setPersonaPick(null)
                setPage('character-chat')
            }
        } catch (error) {
            const fallback = pending.kind === 'adventure'
                ? t('gallery.action.beginAdventureFailedBody')
                : pending.kind === 'group-chat'
                  ? t('gallery.action.startGroupFailedBody')
                  : t('gallery.action.startChatFailedBody')
            setPersonaPickError(startErrorCopy(error, fallback))
        } finally {
            setIsPersonaPickConfirming(false)
        }
    }

    const emptyAction: ReactNode = hasQuery ? (
        <Button kind="secondary" size="sm" onClick={() => gallery.setQuery('')}>
            {t('gallery.clearSearch')}
        </Button>
    ) : isPublicView ? (
        <Button kind="secondary" size="sm" onClick={gallery.refresh}>
            {t('gallery.refresh')}
        </Button>
    ) : (
        <Button
            kind="primary"
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
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto md:justify-end">
                        <div className="flex w-full gap-2 sm:w-auto">
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
                        <div className="relative flex w-full items-center sm:w-[320px]">
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
                        {type === 'character' && !groupSelectionMode && !isPublicView && (
                            <Button
                                kind="primary"
                                iconLeft={<Icon icon={Users} size={16} />}
                                onClick={enterGroupSelection}
                                className="shrink-0"
                            >
                                {t('gallery.groupChat')}
                            </Button>
                        )}
                        {!groupSelectionMode && !isPublicView && (
                            <Button
                                kind={type === 'character' ? 'secondary' : 'primary'}
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

            {groupSelectionMode && type === 'character' && !isPublicView && (
                <div className="sticky top-3 z-[10] flex flex-col gap-3 rounded-lg border border-ember-500/25 bg-ink-700/95 px-4 py-3 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                        <p className="font-ui text-sm font-semibold text-parchment-50">
                            {t('gallery.selectedCount', { count: Object.keys(selectedGroupItems).length })}
                        </p>
                        <p className="mt-0.5 font-ui text-xs text-parchment-400">
                            {t('gallery.groupHint')}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button kind="ghost" size="sm" onClick={cancelGroupSelection}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            kind="primary"
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
                <div
                    className="flex items-center justify-between gap-4 rounded-lg border border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-sm text-parchment-200"
                    role="alert"
                >
                    <span>{gallery.error}</span>
                    <Button kind="secondary" size="sm" onClick={gallery.refresh}>
                        {t('gallery.retry')}
                    </Button>
                </div>
            )}

            <Toast
                open={Boolean(isPublicView ? importHook.actionNotice : actionNotice)}
                tone={(isPublicView ? importHook.actionNotice : actionNotice)?.tone ?? 'success'}
                title={(isPublicView ? importHook.actionNotice : actionNotice)?.title}
                message={(isPublicView ? importHook.actionNotice : actionNotice)?.message}
                autoCloseMs={(isPublicView ? importHook.actionNotice : actionNotice)?.tone === 'success' ? 3200 : false}
                onClose={() => (isPublicView ? importHook.setActionNotice(null) : setActionNotice(null))}
            />

            <CardGrid
                items={gallery.items}
                layout="grid"
                density="compact"
                getItemKey={(item) => item.id}
                loading={gallery.loading}
                renderSkeleton={() => <GalleryCardSkeleton />}
                hasMore={gallery.hasMore}
                loadingMore={gallery.loadingMore}
                onLoadMore={gallery.loadMore}
                emptyStateTitle={hasQuery ? activeDisplayConfig.noMatchTitle : activeDisplayConfig.emptyTitle}
                emptyStateDescription={hasQuery ? activeDisplayConfig.noMatchDescription : activeDisplayConfig.emptyDescription}
                emptyStateAction={emptyAction}
                data-testid={`gallery-grid-${type}`}
                renderCard={(item) => {
                    const selected = Boolean(selectedGroupItems[item.id])
                    const selectionMode = groupSelectionMode && type === 'character' && !isPublicView
                    const importing = importHook.importingKey === `${item.backendType}:${item.id}`
                    const alreadyImported = isPublicView && Boolean(item.resource?.already_imported)
                    return (
                        <GalleryCard
                            id={item.id}
                            title={item.title}
                            badge={alreadyImported ? t('gallery.alreadyImported') : item.badge}
                            tags={item.tags}
                            imageUrl={item.imageUrl}
                            themeSongUrl={item.themeSongUrl}
                            cardType={playlistCardType(item.galleryType)}
                            cardId={item.id}
                            shareOptions={selectionMode || isPublicView ? undefined : shareOptionsFor(item)}
                            deleting={deletingId === item.id}
                            onClick={() => primaryAction(item)}
                            actionLabel={
                                isPublicView
                                    ? t('gallery.preview.previewAction', { title: item.title })
                                    : selectionMode
                                    ? t(selected ? 'gallery.cardAction.removeFromGroup' : 'gallery.cardAction.addToGroup', { title: item.title })
                                    : type === 'adventure'
                                      ? t('gallery.cardAction.beginAdventure', { title: item.title })
                                      : t('gallery.cardAction.edit', { title: item.title })
                            }
                            onTagClick={selectionMode ? undefined : gallery.setQuery}
                            options={selectionMode ? undefined : optionsFor(item)}
                            highlighted={selectionMode ? selected : highlightedId === item.id}
                            footer={selectionMode ? (
                                <Button
                                    kind={selected ? 'primary' : 'secondary'}
                                    size="sm"
                                    full
                                    iconLeft={selected ? <Icon icon={CheckCircle2} size={15} /> : <Icon icon={Plus} size={15} />}
                                    onClick={() => toggleGroupSelection(item)}
                                >
                                    {selected ? t('gallery.selected') : t('gallery.select')}
                                </Button>
                            ) : isPublicView ? (
                                <Button
                                    kind={alreadyImported ? 'secondary' : 'primary'}
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
                            ) : type === 'character' ? (
                                <Button
                                    kind="arcane"
                                    size="sm"
                                    full
                                    iconLeft={
                                        startingChatId === item.id ? (
                                            <Icon icon={Loader2} size={15} className="animate-spin" />
                                        ) : (
                                            <Icon icon={MessageCircle} size={15} />
                                        )
                                    }
                                    disabled={Boolean(startingChatId)}
                                    onClick={() => startCharacterChatFromCard(item)}
                                >
                                    {startingChatId === item.id ? t('gallery.starting') : t('gallery.chat')}
                                </Button>
                            ) : undefined}
                        />
                    )
                }}
            />

            <ConfirmDialog
                visible={pendingDelete !== null}
                title={t('gallery.deleteTitle', { type: displayConfig.singular })}
                message={
                    pendingDelete
                        ? t('gallery.deleteMessage', { title: pendingDelete.title.slice(0, 80) })
                        : ''
                }
                confirmLabel={t('gallery.delete')}
                variant="danger"
                onConfirm={() => void confirmDelete()}
                onCancel={() => setPendingDelete(null)}
            />

            <CardImportOverlays
                importHook={importHook}
                previewItem={preview.previewItem}
                onClosePreview={preview.close}
            />

            <PersonaPickerDialog
                open={personaPick !== null}
                title={personaPick?.kind === 'chat' || personaPick?.kind === 'group-chat' ? t('gallery.choosePersona') : t('gallery.beginAs')}
                actionLabel={personaPick?.kind === 'group-chat' ? t('gallery.startGroupChat') : personaPick?.kind === 'chat' ? t('gallery.startChat') : t('gallery.beginAdventure')}
                description={
                    personaPick?.kind === 'group-chat'
                        ? t('gallery.personaGroupDescription')
                        : personaPick?.kind === 'chat'
                        ? t('gallery.personaChatDescription')
                        : t('gallery.personaAdventureDescription')
                }
                error={personaPickError}
                isConfirming={isPersonaPickConfirming}
                characters={characters}
                onConfirm={confirmPersonaPick}
                onClose={closePersonaPick}
                onCreateCharacter={() => {
                    if (isPersonaPickConfirming) return
                    setPersonaPick(null)
                    setPersonaPickError(null)
                    setEditingCharacter(null)
                    setPage('character')
                }}
            />

            <PersonaPickerDialog
                open={callControls.personaPickOpen}
                title={t('gallery.choosePersona')}
                actionLabel={t('gallery.startCall')}
                description={t('gallery.personaChatDescription')}
                error={callControls.personaPickError}
                isConfirming={callControls.personaPickConfirming}
                characters={characters}
                onConfirm={callControls.confirmPersonaPick}
                onClose={callControls.closePersonaPick}
            />
        </div>
    )
}
