/**
 * LibraryRail — a generic portrait-card rail for one library collection (worlds,
 * items). A SectionHeader over a compact GalleryCard scroll-snap rail, owning its
 * own delete confirmation. Used for the quiet reference shelves near the bottom
 * of the dashboard; renders nothing when the collection is empty.
 */

import { useState } from 'react'
import { ArrowRight, Pencil, Trash2, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PlaylistTrack } from '@/app/providers'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { CardGrid, GalleryCard, type CardOption } from '@/ui/components/lists/Card'
import { Button, Icon, SectionHeader } from '@/ui/primitives'
import type { LibraryCardProps } from './libraryCards'

export interface LibraryRailProps<T extends { id: string; name: string }> {
    title: string
    icon: LucideIcon
    tone?: 'ember' | 'arcane'
    items: T[]
    /** Full collection size (items is already capped) for the "View all (N)" count. */
    total?: number
    toCard: (item: T) => LibraryCardProps
    cardType: PlaylistTrack['cardType']
    /** ConfirmDialog title, e.g. "Delete world". */
    deleteTitle: string
    onEdit: (item: T) => void
    onDelete: (item: T) => Promise<void> | void
    onViewAll?: () => void
    'data-testid'?: string
}

export function LibraryRail<T extends { id: string; name: string }>({
    title,
    icon,
    tone = 'ember',
    items,
    total,
    toCard,
    cardType,
    deleteTitle,
    onEdit,
    onDelete,
    onViewAll,
    'data-testid': testId,
}: LibraryRailProps<T>) {
    const { t } = useTranslation()
    const [pending, setPending] = useState<T | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    if (items.length === 0) return null
    const count = total ?? items.length

    const confirmDelete = async () => {
        const target = pending
        setPending(null)
        if (!target) return
        setDeletingId(target.id)
        try {
            await onDelete(target)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <section className="flex flex-col gap-3" data-testid={testId}>
            <SectionHeader
                title={title}
                icon={icon}
                tone={tone}
                right={
                    onViewAll ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            iconRight={<Icon icon={ArrowRight} size={14} />}
                            onClick={onViewAll}
                            aria-label={t('landing.rail.viewAll', { count })}
                        >
                            {t('landing.rail.viewAll', { count })}
                        </Button>
                    ) : undefined
                }
            />
            <CardGrid
                items={items}
                layout="rail"
                fadeEdges
                getItemKey={(item) => item.id}
                showEmptyState={false}
                renderCard={(item) => {
                    const options: CardOption[] = [
                        { type: 'custom', icon: <Icon icon={Pencil} size={15} />, label: t('gallery.edit'), onClick: () => onEdit(item) },
                        {
                            type: 'custom',
                            icon: <Icon icon={Trash2} size={15} />,
                            label: t('gallery.delete'),
                            onClick: () => setPending(item),
                            danger: true,
                        },
                    ]
                    return (
                        <GalleryCard
                            {...toCard(item)}
                            cardType={cardType}
                            cardId={item.id}
                            options={options}
                            onClick={() => onEdit(item)}
                            actionLabel={t('landing.rail.editAria', { name: item.name })}
                            deleting={deletingId === item.id}
                        />
                    )
                }}
            />

            <ConfirmDialog
                visible={pending !== null}
                title={deleteTitle}
                message={pending ? t('landing.rail.deleteMessage', { name: pending.name }) : ''}
                confirmLabel={t('gallery.delete')}
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setPending(null)}
            />
        </section>
    )
}
