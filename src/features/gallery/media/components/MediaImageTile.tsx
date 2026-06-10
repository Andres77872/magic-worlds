/**
 * MediaImageTile — a square image tile for the media gallery's mixed feed.
 * Click (or the Eye action) opens the shared lightbox; hovering reveals the
 * date and actions; a persistent glass badge names the tagged card and filters
 * the gallery to it on click.
 */

import { Eye, Trash2 } from 'lucide-react'
import { Badge, cx, IconButton } from '@/ui/primitives'
import { formatWhen, type CardRef, type MediaImageItem } from '../mediaGalleryTypes'

export interface MediaImageTileProps {
    item: MediaImageItem
    deleting?: boolean
    onView: () => void
    onDelete: () => void
    /** Filter the gallery to this tile's card (only offered when tagged). */
    onFilterCard?: (card: CardRef) => void
}

export function MediaImageTile({ item, deleting = false, onView, onDelete, onFilterCard }: MediaImageTileProps) {
    return (
        <div
            className={cx(
                'group relative aspect-square overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800 transition-all',
                'hover:border-parchment-50/25 hover:shadow-card-hover',
                deleting && 'pointer-events-none opacity-40',
            )}
            aria-busy={deleting}
            data-testid="media-image-tile"
        >
            <button
                type="button"
                onClick={onView}
                aria-label={`View image${item.card?.name ? ` for ${item.card.name}` : ''} full size`}
                className="absolute inset-0 h-full w-full cursor-zoom-in"
            >
                <img
                    src={item.url}
                    alt={item.card?.name ? `Image for ${item.card.name}` : 'Generated image'}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
            </button>

            {item.card && (
                <Badge
                    tone="glass"
                    className={cx('absolute left-2 top-2 max-w-[80%]', onFilterCard && 'cursor-pointer hover:text-arcane-200')}
                    onClick={
                        onFilterCard
                            ? (e) => {
                                  e.stopPropagation()
                                  onFilterCard(item.card!)
                              }
                            : undefined
                    }
                    role={onFilterCard ? 'button' : undefined}
                    title={onFilterCard ? `Show all media for ${item.card.name ?? 'this card'}` : undefined}
                    data-testid="media-card-badge"
                >
                    <span className="truncate">{item.card.name ?? 'Card'}</span>
                </Badge>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-ink-900/85 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <span className="font-mono text-[10px] text-parchment-300">{formatWhen(item.createdAt)}</span>
                <div className="pointer-events-auto flex items-center gap-1">
                    <IconButton label="View full size" size="sm" onClick={onView}>
                        <Eye size={15} strokeWidth={1.75} />
                    </IconButton>
                    <IconButton label="Delete image" size="sm" tone="danger" onClick={onDelete}>
                        <Trash2 size={15} strokeWidth={1.75} />
                    </IconButton>
                </div>
            </div>
        </div>
    )
}
