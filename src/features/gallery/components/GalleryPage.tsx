/**
 * GalleryPage — full-page, server-searched library for one card type. A dense
 * image-forward grid (GalleryCard) with a masthead search bar (name + triggers,
 * debounced server query) and skip/limit infinite scroll. Actions reuse the
 * DataProvider flows (edit/begin/chat/delete) so the dashboard stays in sync.
 */

import { useState, type ReactNode } from 'react'
import { Loader2, Pencil, Play, Plus, MessageCircle, Search, Trash2, X } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import type { Adventure, Character, World } from '@/shared'
import { MODE_META } from '@/shared/modes'
import { CardGrid, GalleryCard, type CardOption } from '@/ui/components'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Button, controlClass, Icon, IconButton, PageHeader } from '@/ui/primitives'
import { GALLERY_CONFIG, type GalleryItem, type GalleryType } from '../galleryConfig'
import { useCardGallery } from '../hooks/useCardGallery'

export interface GalleryPageProps {
    type: GalleryType
}

export function GalleryPage({ type }: GalleryPageProps) {
    const config = GALLERY_CONFIG[type]
    const gallery = useCardGallery(config)
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const {
        editCharacter,
        deleteCharacter,
        startCharacterChat,
        editWorld,
        deleteWorld,
        editTemplate,
        startTemplate,
        deleteTemplateById,
    } = useData()

    const [pendingDelete, setPendingDelete] = useState<GalleryItem | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const requireAuth = (action: () => void) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        action()
    }

    const primaryAction = (item: GalleryItem) => {
        if (type === 'character') {
            requireAuth(() => {
                editCharacter(item.source as Character)
                setPage('character')
            })
        } else if (type === 'world') {
            requireAuth(() => {
                editWorld(item.source as World)
                setPage('world')
            })
        } else {
            requireAuth(() => {
                void startTemplate(item.source as Adventure)
                setPage('interaction')
            })
        }
    }

    const optionsFor = (item: GalleryItem): CardOption[] => {
        const edit = () => primaryAction(item)
        const options: CardOption[] = []
        if (type === 'character') {
            options.push({
                type: 'custom',
                icon: <Icon icon={MessageCircle} size={15} />,
                label: 'Chat',
                onClick: () =>
                    requireAuth(() => {
                        void startCharacterChat(item.source as Character)
                        setPage('character-chat')
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
            if (type === 'character') await deleteCharacter(target.id)
            else if (type === 'world') await deleteWorld(target.id)
            else await deleteTemplateById(target.id)
            gallery.removeItem(target.id)
        } catch (error) {
            console.error('Failed to delete from gallery:', error)
        } finally {
            setDeletingId(null)
        }
    }

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
            onClick={() => requireAuth(() => setPage(config.createPage))}
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
                                className={`${controlClass} rounded-full pl-10 pr-12`}
                                data-testid="gallery-search-input"
                            />
                            {gallery.searching && (
                                <Loader2
                                    className="absolute right-10 animate-spin text-ember-500"
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
                            onClick={() => requireAuth(() => setPage(config.createPage))}
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
                        title={item.title}
                        badge={item.badge}
                        tags={item.tags}
                        imageUrl={item.imageUrl}
                        themeSongUrl={item.themeSongUrl}
                        deleting={deletingId === item.id}
                        onClick={() => primaryAction(item)}
                        actionLabel={
                            type === 'adventure' ? `Begin adventure: ${item.title}` : `Edit ${item.title}`
                        }
                        onTagClick={gallery.setQuery}
                        options={optionsFor(item)}
                    />
                )}
            />

            <ConfirmDialog
                visible={pendingDelete !== null}
                title={`Delete ${type === 'adventure' ? 'adventure' : type}`}
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
        </div>
    )
}
