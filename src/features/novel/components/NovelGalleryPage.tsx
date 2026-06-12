/**
 * NovelGalleryPage — full-page, server-searched library of the user's novels.
 * A structural twin of the card GalleryPage: masthead search (debounced
 * server query over title/description/chapter text), skip/limit infinite
 * scroll, image-forward GalleryCard grid, and DataProvider-backed actions.
 */

import { useState, type ReactNode } from 'react'
import { BookOpenText, Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import type { StoryCreateRequest } from '@/shared'
import { CardGrid, GalleryCard, type CardOption } from '@/ui/components'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Button, controlClass, Icon, IconButton, PageHeader, Toast } from '@/ui/primitives'
import { NOVEL_GALLERY_CONFIG, type NovelGalleryItem } from '../novelGalleryConfig'
import { useCardGallery } from '@/features/gallery/hooks/useCardGallery'
import { NovelCreateModal } from './NovelCreateModal'

interface ActionNotice {
    tone: 'success' | 'error'
    title: string
    message?: string
}

export function NovelGalleryPage() {
    const gallery = useCardGallery<NovelGalleryItem>(NOVEL_GALLERY_CONFIG)
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { createStory, openStory, deleteStory } = useData()

    const [createOpen, setCreateOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const [openingId, setOpeningId] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<NovelGalleryItem | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null)

    const requireAuth = (action: () => void) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        action()
    }

    const openNovel = (item: NovelGalleryItem) => {
        requireAuth(() => {
            if (openingId) return
            setOpeningId(item.id)
            openStory(item.source)
                .then(() => setPage('story'))
                .catch((error) => {
                    console.error('Failed to open novel:', error)
                    setActionNotice({ tone: 'error', title: 'Could not open novel', message: 'Try again.' })
                })
                .finally(() => setOpeningId(null))
        })
    }

    const handleCreate = async (request: StoryCreateRequest) => {
        setCreating(true)
        try {
            await createStory(request)
            setCreateOpen(false)
            setPage('story')
        } catch (error) {
            console.error('Failed to create novel:', error)
            setActionNotice({ tone: 'error', title: 'Could not create novel', message: 'Try again.' })
        } finally {
            setCreating(false)
        }
    }

    const confirmDelete = async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target) return
        setDeletingId(target.id)
        try {
            await deleteStory(target.id)
            gallery.removeItem(target.id)
        } catch (error) {
            console.error('Failed to delete novel:', error)
            setActionNotice({ tone: 'error', title: 'Could not delete novel', message: 'Try again.' })
        } finally {
            setDeletingId(null)
        }
    }

    const optionsFor = (item: NovelGalleryItem): CardOption[] => [
        {
            type: 'custom',
            icon: <Icon icon={BookOpenText} size={15} />,
            label: 'Open',
            onClick: () => openNovel(item),
        },
        {
            type: 'custom',
            icon: <Icon icon={Trash2} size={15} />,
            label: 'Delete',
            onClick: () => requireAuth(() => setPendingDelete(item)),
            danger: true,
        },
    ]

    const hasQuery = gallery.query.trim().length > 0

    const emptyAction: ReactNode = hasQuery ? (
        <Button kind="secondary" size="sm" onClick={() => gallery.setQuery('')}>
            Clear search
        </Button>
    ) : (
        <Button
            kind="primary"
            size="sm"
            iconLeft={<Icon icon={Plus} size={16} />}
            onClick={() => requireAuth(() => setCreateOpen(true))}
        >
            {NOVEL_GALLERY_CONFIG.createLabel}
        </Button>
    )

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={NOVEL_GALLERY_CONFIG.eyebrow}
                title={NOVEL_GALLERY_CONFIG.title}
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
                                placeholder={NOVEL_GALLERY_CONFIG.searchPlaceholder}
                                aria-label={NOVEL_GALLERY_CONFIG.searchPlaceholder}
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
                            onClick={() => requireAuth(() => setCreateOpen(true))}
                            className="shrink-0"
                        >
                            {NOVEL_GALLERY_CONFIG.createLabel}
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
                emptyStateTitle={hasQuery ? NOVEL_GALLERY_CONFIG.noMatchTitle : NOVEL_GALLERY_CONFIG.emptyTitle}
                emptyStateDescription={hasQuery ? NOVEL_GALLERY_CONFIG.noMatchDescription : NOVEL_GALLERY_CONFIG.emptyDescription}
                emptyStateAction={emptyAction}
                data-testid="gallery-grid-novel"
                renderCard={(item) => (
                    <GalleryCard
                        id={item.id}
                        title={item.title}
                        badge={item.badge}
                        tags={item.tags}
                        imageUrl={item.imageUrl}
                        deleting={deletingId === item.id}
                        onClick={() => openNovel(item)}
                        actionLabel={`Open ${item.title}`}
                        options={optionsFor(item)}
                    />
                )}
            />

            <ConfirmDialog
                visible={pendingDelete !== null}
                title="Delete novel"
                message={pendingDelete ? `Delete "${pendingDelete.title.slice(0, 80)}"? Its chapters and codex cannot be recovered.` : ''}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => void confirmDelete()}
                onCancel={() => setPendingDelete(null)}
            />

            <NovelCreateModal
                open={createOpen}
                creating={creating}
                onClose={() => setCreateOpen(false)}
                onCreate={(request) => void handleCreate(request)}
            />
        </div>
    )
}
