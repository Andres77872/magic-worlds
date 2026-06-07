import {useState} from 'react'
import type {World} from '../../../shared/types'
import {ConfirmDialog} from '../ConfirmDialog'
import {Card, CardGrid} from './Card'
import type {CardOption} from './Card'
import {EmptyState} from '../common/EmptyState'
import {Globe, Pencil, Trash2} from 'lucide-react'
import {Icon, Tag} from '@/ui/primitives'

interface WorldListProps {
    worlds: World[]
    onDelete: (index: number) => Promise<void> | void
    onEdit: (w: World) => void
    loading?: boolean
    /** `grid` (default) for full pages; `rail` for dashboard shelves. */
    layout?: 'grid' | 'rail'
}

export function WorldList({
                              worlds,
                              onDelete,
                              onEdit,
                              loading = false,
                              layout = 'grid',
                          }: WorldListProps) {
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
                items={worlds}
                layout={layout}
                loading={loading}
                emptyMessage={
                    <EmptyState
                        icon={<Icon icon={Globe} size={32}/>}
                        message="No worlds created yet"
                        button={{
                            label: 'Create Your First World',
                            onClick: () => onEdit({
                                id: '',
                                name: 'New World',
                                type: 'fantasy',
                                details: {},
                                description: ''
                            })
                        }}
                    />
                }
                renderCard={(world, idx) => {
                    const isDeleting = deletingId === idx

                    const options: CardOption[] = [
                        {
                            type: 'custom',
                            icon: <Icon icon={Pencil} size={15}/>,
                            label: 'Edit',
                            onClick: () => onEdit(world),
                            disabled: isDeleting
                        },
                        {
                            type: 'custom',
                            icon: <Icon icon={Trash2} size={15}/>,
                            label: 'Delete',
                            onClick: () => setPending({idx, name: world.name}),
                            disabled: isDeleting,
                            danger: true
                        },
                    ]

                    return (
                        <Card
                            key={world.id}
                            title={world.name}
                            subtitle={
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {world.type && <Tag>{world.type}</Tag>}
                                </div>
                            }
                            options={options}
                            onClick={() => onEdit(world)}
                            className={isDeleting ? 'pointer-events-none opacity-50' : ''}
                        >
                            <p className="m-0 font-narrative text-sm leading-normal text-parchment-400">
                                {world.description
                                    ? world.description.substring(0, 100) + (world.description.length > 100 ? '...' : '')
                                    : 'No description'}
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
                title="Delete World"
                message={pending ? `Are you sure you want to delete the world "${pending.name}"? This action cannot be undone.` : ''}
                onConfirm={handleDelete}
                onCancel={() => setPending(null)}
                variant="danger"
            />
        </div>
    )
}