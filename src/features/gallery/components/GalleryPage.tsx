/**
 * GalleryPage — full-page, server-searched library for one card type. A dense
 * image-forward grid (GalleryCard) with a masthead search bar (name + triggers,
 * debounced server query) and skip/limit infinite scroll. Actions reuse the
 * DataProvider flows (edit/begin/chat/delete) so the dashboard stays in sync.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BookOpenText, Download, Link2, Loader2, Pencil, Play, Plus, MessageCircle, Search, Trash2, X } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import type { Adventure, Character, Item, World } from '@/shared'
import { MODE_META } from '@/shared/modes'
import { apiService } from '@/infrastructure/api'
import { CardGrid, GalleryCard, PersonaPickerDialog, type CardOption } from '@/ui/components'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Button, controlClass, Icon, IconButton, PageHeader, Toast } from '@/ui/primitives'
import { downloadBlob, safeFilename } from '@/utils/download'
import { GALLERY_CONFIG, type GalleryItem, type GalleryType } from '../galleryConfig'
import { buildGalleryCardUrl, parseGalleryHash } from '../galleryLinks'
import { useCardGallery } from '../hooks/useCardGallery'

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
    const config = GALLERY_CONFIG[type]
    const gallery = useCardGallery(config)
    const { upsertItem } = gallery
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const {
        editCharacter,
        setEditingCharacter,
        deleteCharacter,
        characters,
        startCharacterChat,
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

    const [pendingDelete, setPendingDelete] = useState<GalleryItem | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [exportingId, setExportingId] = useState<string | null>(null)
    const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null)
    const [linkedCardId, setLinkedCardId] = useState<string | null>(() => linkedCardIdFor(type))
    const [highlightedId, setHighlightedId] = useState<string | null>(() => linkedCardIdFor(type))
    const fetchedLinkedRef = useRef<string | null>(null)
    const [personaPick, setPersonaPick] = useState<
        | { kind: 'adventure'; item: GalleryItem }
        | { kind: 'chat'; item: GalleryItem }
        | null
    >(null)
    const [personaPickError, setPersonaPickError] = useState<string | null>(null)
    const [isPersonaPickConfirming, setIsPersonaPickConfirming] = useState(false)

    useEffect(() => {
        const syncLinkedCard = () => {
            const next = linkedCardIdFor(type)
            setLinkedCardId(next)
            if (next) setHighlightedId(next)
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
        if (!linkedCardId || !config.fetchItem || !config.toItem) return
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        const key = `${type}:${linkedCardId}`
        if (fetchedLinkedRef.current === key) return
        fetchedLinkedRef.current = key
        let cancelled = false

        void config.fetchItem(linkedCardId)
            .then((raw) => {
                if (cancelled) return
                const item = config.toItem?.(raw)
                if (!item) throw new Error('Card not found')
                upsertItem(item)
                setHighlightedId(item.id)
            })
            .catch((error) => {
                if (cancelled) return
                console.error('Failed to load shared gallery card:', error)
                setActionNotice({
                    tone: 'error',
                    title: 'Could not open shared card',
                    message: 'It may have been deleted or you may not have access.',
                })
            })

        return () => {
            cancelled = true
        }
    }, [config, isAuthenticated, linkedCardId, openLoginModal, type, upsertItem])

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

    const openCreatePage = () => {
        requireAuth(() => {
            if (type === 'character' || type === 'persona') setEditingCharacter(null)
            else if (type === 'world') setEditingWorld(null)
            else if (type === 'item') setEditingItem(null)
            else setEditingTemplate(null)
            setPage(config.createPage)
        })
    }

    const primaryAction = (item: GalleryItem) => {
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
                title: 'Could not export card',
                message: `"${item.title.slice(0, 80)}" did not download. Try again.`,
            })
        } finally {
            setExportingId(null)
        }
    }

    const copyShareLink = async (item: GalleryItem) => {
        setActionNotice(null)
        try {
            await writeClipboardText(buildGalleryCardUrl(type, item.id))
            setActionNotice({ tone: 'success', title: 'Share link copied', message: item.title.slice(0, 80) })
        } catch (error) {
            console.error('Failed to copy gallery card link:', error)
            setActionNotice({ tone: 'error', title: 'Could not copy link', message: 'Try again.' })
        }
    }

    const shareOptionsFor = (item: GalleryItem): CardOption[] => [
        {
            type: 'custom',
            icon: <Icon icon={Link2} size={15} />,
            label: 'Share',
            onClick: () => requireAuth(() => void copyShareLink(item)),
        },
        {
            type: 'custom',
            icon: <Icon icon={Download} size={15} />,
            label: exportingId === item.id ? 'Downloading…' : 'Download PNG',
            onClick: () => requireAuth(() => void exportCard(item)),
            disabled: exportingId !== null,
        },
    ]

    const optionsFor = (item: GalleryItem): CardOption[] => {
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
                    title: `${item.title} Novel`,
                    source,
                    chapters: [{ title: 'Chapter 1', body: '', status: 'draft', order: 0 }],
                    cardRefs: [{ kind: cardRefKind, cardId: item.id, source: 'source' }],
                }).then(() => setPage('story'))
            })
        options.push({
            type: 'custom',
            icon: <Icon icon={BookOpenText} size={15} />,
            label: 'Write',
            onClick: writeFromCard,
        })
        if (type === 'character') {
            options.push({
                type: 'custom',
                icon: <Icon icon={MessageCircle} size={15} />,
                label: 'Chat',
                onClick: () =>
                    requireAuth(() => {
                        setPersonaPickError(null)
                        setPersonaPick({ kind: 'chat', item })
                    }),
            })
        }
        if (type === 'adventure') {
            options.push({
                type: 'custom',
                icon: <Icon icon={Play} size={15} />,
                label: MODE_META.adventure.beginLabel,
                onClick: () => primaryAction(item),
            })
            options.push({
                type: 'custom',
                icon: <Icon icon={Pencil} size={15} />,
                label: 'Edit',
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
                label: 'Edit',
                onClick: edit,
            })
        }
        options.push({
            type: 'custom',
            icon: <Icon icon={Trash2} size={15} />,
            label: 'Delete',
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
            } else {
                await startCharacterChat(pending.item.source as Character, persona)
                setPersonaPick(null)
                setPage('character-chat')
            }
        } catch (error) {
            const fallback = pending.kind === 'adventure'
                ? 'Could not begin this adventure. Please try again.'
                : 'Could not start this chat. Please try again.'
            setPersonaPickError(startErrorCopy(error, fallback))
        } finally {
            setIsPersonaPickConfirming(false)
        }
    }

    const emptyAction: ReactNode = hasQuery ? (
        <Button kind="secondary" size="sm" onClick={() => gallery.setQuery('')}>
            Clear search
        </Button>
    ) : (
        <Button
            kind="primary"
            size="sm"
            iconLeft={<Icon icon={Plus} size={16} />}
            onClick={openCreatePage}
        >
            {config.createLabel}
        </Button>
    )

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={config.eyebrow}
                title={config.title}
                size="lg"
                actions={
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto md:justify-end">
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
                                placeholder={config.searchPlaceholder}
                                aria-label={config.searchPlaceholder}
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
                                    label="Clear search"
                                    className="absolute right-2"
                                    data-testid="gallery-search-clear"
                                >
                                    <Icon icon={X} size={16} />
                                </IconButton>
                            )}
                        </div>
                        <Button
                            kind="primary"
                            iconLeft={<Icon icon={Plus} size={16} />}
                            onClick={openCreatePage}
                            className="shrink-0"
                        >
                            {config.createLabel}
                        </Button>
                    </div>
                }
            />

            {gallery.error && (
                <div
                    className="flex items-center justify-between gap-4 rounded-lg border border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-sm text-parchment-200"
                    role="alert"
                >
                    <span>{gallery.error}</span>
                    <Button kind="secondary" size="sm" onClick={gallery.refresh}>
                        Retry
                    </Button>
                </div>
            )}

            <Toast
                open={Boolean(actionNotice)}
                tone={actionNotice?.tone ?? 'success'}
                title={actionNotice?.title}
                message={actionNotice?.message}
                autoCloseMs={actionNotice?.tone === 'success' ? 3200 : false}
                onClose={() => setActionNotice(null)}
            />

            <CardGrid
                items={gallery.items}
                layout="grid"
                density="compact"
                getItemKey={(item) => item.id}
                loading={gallery.loading}
                hasMore={gallery.hasMore}
                loadingMore={gallery.loadingMore}
                onLoadMore={gallery.loadMore}
                emptyStateTitle={hasQuery ? config.noMatchTitle : config.emptyTitle}
                emptyStateDescription={hasQuery ? config.noMatchDescription : config.emptyDescription}
                emptyStateAction={emptyAction}
                data-testid={`gallery-grid-${type}`}
                renderCard={(item) => (
                    <GalleryCard
                        id={item.id}
                        title={item.title}
                        badge={item.badge}
                        tags={item.tags}
                        imageUrl={item.imageUrl}
                        themeSongUrl={item.themeSongUrl}
                        shareOptions={shareOptionsFor(item)}
                        deleting={deletingId === item.id}
                        onClick={() => primaryAction(item)}
                        actionLabel={
                            type === 'adventure' ? `Begin adventure: ${item.title}` : `Edit ${item.title}`
                        }
                        onTagClick={gallery.setQuery}
                        options={optionsFor(item)}
                        highlighted={highlightedId === item.id}
                    />
                )}
            />

            <ConfirmDialog
                visible={pendingDelete !== null}
                title={`Delete ${type === 'adventure' ? 'adventure' : type === 'persona' ? 'persona' : type}`}
                message={
                    pendingDelete
                        ? `Delete "${pendingDelete.title.slice(0, 80)}"? This cannot be undone.`
                        : ''
                }
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => void confirmDelete()}
                onCancel={() => setPendingDelete(null)}
            />

            <PersonaPickerDialog
                open={personaPick !== null}
                title={personaPick?.kind === 'chat' ? 'Choose your persona' : 'Begin as'}
                actionLabel={personaPick?.kind === 'chat' ? 'Start chat' : 'Begin adventure'}
                description={
                    personaPick?.kind === 'chat'
                        ? 'Choose the persona who will speak for you in this conversation.'
                        : 'Choose the persona you will play before starting this adventure.'
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
        </div>
    )
}
