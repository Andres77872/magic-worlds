import { useState } from 'react'
import { BookOpen, Pencil, Plus, Search, Trash2, X, Loader2 } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { CardGrid, ConfirmDialog, type CardOption } from '@/ui/components'
import { Button, controlClass, Icon, IconButton, PageHeader } from '@/ui/primitives'
import type { Lorebook } from '@/shared'
import { useLorebookGallery } from '../hooks/useLorebookGallery'
import { LorebookCard } from './LorebookCard'

export function LorebookGalleryPage() {
    const gallery = useLorebookGallery()
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { editLorebook, setEditingLorebook, deleteLorebook } = useData()
    const [pendingDelete, setPendingDelete] = useState<Lorebook | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const requireAuth = (action: () => void) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        action()
    }

    const openLorebook = (lorebook: Lorebook) => {
        requireAuth(() => {
            editLorebook(lorebook)
            setPage('lorebook')
        })
    }

    const createLorebook = () => {
        requireAuth(() => {
            setEditingLorebook(null)
            setPage('lorebook')
        })
    }

    const optionsFor = (lorebook: Lorebook): CardOption[] => [
        {
            type: 'custom',
            label: 'Edit',
            icon: <Icon icon={Pencil} size={15} />,
            onClick: () => openLorebook(lorebook),
        },
        {
            type: 'custom',
            label: 'Delete',
            icon: <Icon icon={Trash2} size={15} />,
            onClick: () => requireAuth(() => setPendingDelete(lorebook)),
            danger: true,
        },
    ]

    const confirmDelete = async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target) return
        setDeletingId(target.id)
        try {
            await deleteLorebook(target.id)
            gallery.removeItem(target.id)
        } catch (error) {
            console.error('Failed to delete lorebook:', error)
        } finally {
            setDeletingId(null)
        }
    }

    const hasQuery = gallery.query.trim().length > 0

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow="Your library"
                title="Lorebooks"
                icon={<span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-ember-500/15 text-ember-400"><Icon icon={BookOpen} size={22} /></span>}
                size="lg"
                subtitle="Build activation-tested context books for worlds, characters, adventures, and chats."
                actions={
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto md:justify-end">
                        <div className="relative flex w-full items-center sm:w-[320px]">
                            <span className="pointer-events-none absolute left-3 flex items-center text-parchment-400">
                                <Icon icon={Search} size={16} />
                            </span>
                            <input
                                type="search"
                                value={gallery.query}
                                onChange={(event) => gallery.setQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') gallery.setQuery('')
                                }}
                                placeholder="Search lorebooks by name, tag, or key..."
                                aria-label="Search lorebooks by name, tag, or key"
                                className={`${controlClass} rounded-full pl-10 ${gallery.searching && hasQuery ? 'pr-16' : 'pr-12'}`}
                            />
                            {gallery.searching && (
                                <Loader2
                                    className={`absolute ${hasQuery ? 'right-12' : 'right-4'} animate-spin text-ember-500`}
                                    size={16}
                                    aria-hidden="true"
                                />
                            )}
                            {hasQuery && (
                                <IconButton
                                    size="sm"
                                    onClick={() => gallery.setQuery('')}
                                    label="Clear search"
                                    className="absolute right-2"
                                >
                                    <Icon icon={X} size={16} />
                                </IconButton>
                            )}
                        </div>
                        <Button kind="primary" iconLeft={<Icon icon={Plus} size={16} />} onClick={createLorebook}>
                            New lorebook
                        </Button>
                    </div>
                }
            />

            {gallery.error && (
                <div className="flex items-center justify-between gap-4 rounded-lg border border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-sm text-parchment-200" role="alert">
                    <span>{gallery.error}</span>
                    <Button kind="secondary" size="sm" onClick={gallery.refresh}>Retry</Button>
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
                emptyStateTitle={hasQuery ? 'No lorebooks match' : 'No lorebooks yet'}
                emptyStateDescription={hasQuery ? 'Try a different name, tag, or activation key.' : 'Create a lorebook to manage reusable prompt context.'}
                emptyStateAction={
                    hasQuery ? (
                        <Button kind="secondary" size="sm" onClick={() => gallery.setQuery('')}>Clear search</Button>
                    ) : (
                        <Button kind="primary" size="sm" iconLeft={<Icon icon={Plus} size={16} />} onClick={createLorebook}>New lorebook</Button>
                    )
                }
                data-testid="gallery-grid-lorebook"
                renderCard={(lorebook) => (
                    <LorebookCard
                        lorebook={lorebook}
                        deleting={deletingId === lorebook.id}
                        onClick={() => openLorebook(lorebook)}
                        onTagClick={gallery.setQuery}
                        options={optionsFor(lorebook)}
                    />
                )}
            />

            <ConfirmDialog
                visible={pendingDelete !== null}
                title="Delete lorebook"
                message={pendingDelete ? `Delete "${pendingDelete.name.slice(0, 80)}"? This also removes its entries and attachments.` : ''}
                confirmLabel="Delete"
                cancelLabel="Keep"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setPendingDelete(null)}
            />
        </div>
    )
}
