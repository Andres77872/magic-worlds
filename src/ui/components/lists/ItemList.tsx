import { useState } from 'react'
import type { Item } from '../../../shared/types'
import { ConfirmDialog } from '../ConfirmDialog'
import { Card, CardGrid } from './Card'
import type { CardOption } from './Card'
import { EmptyState } from '../common/EmptyState'
import { Gem, Pencil, Trash2 } from 'lucide-react'
import { Icon, Tag } from '@/ui/primitives'
import { resolveMediaUrl } from '@/infrastructure/api'

interface ItemListProps {
    items: Item[]
    onDelete: (index: number) => Promise<void> | void
    onEdit: (item: Item) => void
    loading?: boolean
    /** `grid` (default) for full pages; `rail` for dashboard shelves. */
    layout?: 'grid' | 'rail'
}

function meaningful(value?: string | null): string {
    const text = value?.trim() ?? ''
    return text.length > 1 ? text : ''
}

export function ItemList({
    items,
    onDelete,
    onEdit,
    loading = false,
    layout = 'grid',
}: ItemListProps) {
    const [pending, setPending] = useState<{ idx: number; name: string } | null>(null)
    const [deletingId, setDeletingId] = useState<number | null>(null)

    const handleDelete = async () => {
        if (pending) {
            setDeletingId(pending.idx)
            try {
                await onDelete(pending.idx)
            } finally {
                setDeletingId(null)
                setPending(null)
            }
        }
    }

    return (
        <div className="flex flex-col gap-4 py-4">
            <CardGrid
                items={items}
                layout={layout}
                loading={loading}
                emptyMessage={
                    <EmptyState
                        icon={<Icon icon={Gem} size={32} />}
                        message="No items created yet"
                        button={{
                            label: 'Create Your First Item',
                            onClick: () =>
                                onEdit({
                                    id: '',
                                    name: 'New Item',
                                    type: 'relic',
                                    rarity: '',
                                    description: '',
                                    effects: [],
                                    requirements: [],
                                    limitations: [],
                                }),
                        }}
                    />
                }
                renderCard={(item, idx) => {
                    const isDeleting = deletingId === idx
                    const title = meaningful(item.name) || 'Untitled item'
                    const itemType = meaningful(item.type)
                    const rarity = meaningful(item.rarity)
                    const description = meaningful(item.description)

                    const options: CardOption[] = [
                        {
                            type: 'custom',
                            icon: <Icon icon={Pencil} size={15} />,
                            label: 'Edit',
                            onClick: () => onEdit(item),
                            disabled: isDeleting,
                        },
                        {
                            type: 'custom',
                            icon: <Icon icon={Trash2} size={15} />,
                            label: 'Delete',
                            onClick: () => setPending({ idx, name: title }),
                            disabled: isDeleting,
                            danger: true,
                        },
                    ]

                    return (
                        <Card
                            key={item.id}
                            title={title}
                            subtitle={
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {itemType && <Tag>{itemType}</Tag>}
                                    {rarity && <Tag>{rarity}</Tag>}
                                </div>
                            }
                            options={options}
                            onClick={() => onEdit(item)}
                            imageUrl={resolveMediaUrl(item.image_url)}
                            themeSongUrl={resolveMediaUrl(item.theme_song_url)}
                            className={isDeleting ? 'pointer-events-none opacity-50' : ''}
                        >
                            <p className="m-0 font-narrative text-sm leading-normal text-parchment-400">
                                {description
                                    ? description.substring(0, 100) + (description.length > 100 ? '...' : '')
                                    : item.effects[0] || 'No description'}
                            </p>
                            {isDeleting && (
                                <div className="absolute inset-0 z-[1] flex items-center justify-center bg-ink-900/70 font-medium text-parchment-50">
                                    Deleting...
                                </div>
                            )}
                        </Card>
                    )
                }}
            />

            <ConfirmDialog
                visible={pending !== null}
                title="Delete Item"
                message={pending ? `Are you sure you want to delete "${pending.name}"? This action cannot be undone.` : ''}
                onConfirm={handleDelete}
                onCancel={() => setPending(null)}
                variant="danger"
            />
        </div>
    )
}
