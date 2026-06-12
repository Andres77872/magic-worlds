/**
 * MediaGalleryPage — the user's full media library: every generated image and
 * theme song in one newest-first feed, filterable by media type, card type, and
 * a specific card. Images open in the lightbox; themes play inline; deletes
 * soft-delete the asset after a confirm.
 */

import { useMemo, useState } from 'react'
import { useAuth, useData } from '@/app/hooks'
import { apiService, resolveMediaUrl } from '@/infrastructure/api'
import { Button, PageHeader } from '@/ui/primitives'
import { ImageLightbox } from '@/ui/primitives'
import { CardGrid } from '@/ui/components'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { emptyCopy, type CardRef, type MediaGalleryItem } from '../mediaGalleryTypes'
import { useMediaGallery } from '../hooks/useMediaGallery'
import { MediaFilterBar } from './MediaFilterBar'
import { MediaImageTile } from './MediaImageTile'
import { MediaThemeCard } from './MediaThemeCard'

export function MediaGalleryPage() {
    const gallery = useMediaGallery()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { characters, worlds, items, templateAdventures } = useData()

    const [lightboxUrl, setLightboxUrl] = useState<string | undefined>(undefined)
    const [pendingDelete, setPendingDelete] = useState<MediaGalleryItem | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)

    const requestDelete = (item: MediaGalleryItem) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        setPendingDelete(item)
    }

    const confirmDelete = async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target) return
        setDeletingId(target.id)
        setActionError(null)
        try {
            if (target.kind === 'image') await apiService.deleteImageAsset(target.id)
            else await apiService.deleteThemeSongAsset(target.id)
            gallery.removeItem(target.id)
        } catch {
            setActionError(`Could not delete that ${target.kind === 'image' ? 'image' : 'theme'}. Try again.`)
        } finally {
            setDeletingId(null)
        }
    }

    const filtered =
        gallery.filters.mediaType !== 'all' || gallery.filters.cardType !== 'all' || Boolean(gallery.filters.card)
    const empty = emptyCopy(gallery.filters)
    const error = gallery.error ?? actionError
    const artworkByCard = useMemo(() => {
        const entries: Array<[string, string | undefined]> = [
            ...characters.map(
                (card): [string, string | undefined] => [`character:${card.id}`, resolveMediaUrl(card.image_url)],
            ),
            ...worlds.map(
                (card): [string, string | undefined] => [`world:${card.id}`, resolveMediaUrl(card.image_url)],
            ),
            ...items.map(
                (card): [string, string | undefined] => [`item:${card.id}`, resolveMediaUrl(card.image_url)],
            ),
            ...templateAdventures.map(
                (card): [string, string | undefined] => [
                    `adventure_template:${card.id}`,
                    resolveMediaUrl(card.image_url),
                ],
            ),
        ]
        return new Map(entries.filter((entry): entry is [string, string] => Boolean(entry[1])))
    }, [characters, items, worlds, templateAdventures])
    const cardArtwork = (card?: CardRef): string | undefined =>
        card ? artworkByCard.get(`${card.type}:${card.id}`) : undefined

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow="Your library"
                title="Media"
                subtitle="Every image and theme you've conjured, across all your cards."
                size="lg"
            />

            <MediaFilterBar
                filters={gallery.filters}
                onMediaType={gallery.setMediaType}
                onCardType={gallery.setCardType}
                onCard={gallery.setCard}
            />

            {error && (
                <div
                    className="flex items-center justify-between gap-4 rounded-lg border border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-sm text-parchment-200"
                    role="alert"
                >
                    <span>{error}</span>
                    <Button
                        kind="secondary"
                        size="sm"
                        onClick={() => {
                            setActionError(null)
                            if (gallery.error) gallery.refresh()
                        }}
                    >
                        {gallery.error ? 'Retry' : 'Dismiss'}
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
                emptyStateTitle={empty.title}
                emptyStateDescription={empty.description}
                emptyStateAction={
                    filtered ? (
                        <Button kind="secondary" size="sm" onClick={gallery.clearFilters}>
                            Clear filters
                        </Button>
                    ) : undefined
                }
                data-testid="media-gallery-grid"
                renderCard={(item) =>
                    item.kind === 'image' ? (
                        <MediaImageTile
                            item={item}
                            deleting={deletingId === item.id}
                            onView={() => setLightboxUrl(item.url)}
                            onDelete={() => requestDelete(item)}
                            onFilterCard={gallery.setCard}
                        />
                    ) : (
                        <MediaThemeCard
                            item={item}
                            artworkUrl={cardArtwork(item.card)}
                            deleting={deletingId === item.id}
                            onDelete={() => requestDelete(item)}
                            onFilterCard={gallery.setCard}
                        />
                    )
                }
            />

            <ImageLightbox
                open={Boolean(lightboxUrl)}
                src={lightboxUrl}
                alt="Generated image"
                onClose={() => setLightboxUrl(undefined)}
            />

            <ConfirmDialog
                visible={pendingDelete !== null}
                title={pendingDelete?.kind === 'theme' ? 'Delete theme' : 'Delete image'}
                message={
                    pendingDelete
                        ? `Delete this ${pendingDelete.kind === 'theme' ? 'theme' : 'image'}? This cannot be undone.`
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
