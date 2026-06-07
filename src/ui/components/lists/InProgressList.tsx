import {useState} from 'react'
import type {Adventure} from '../../../shared/types'
import {ConfirmDialog} from '../ConfirmDialog'
import {Card, CardGrid} from './Card'
import type {CardOption} from './Card'
import {EmptyState} from '../common/EmptyState'
import {Compass, Pencil, Play, Trash2} from 'lucide-react'
import {Badge, Icon, Tag} from '@/ui/primitives'

interface InProgressListProps {
    adventures: Adventure[]
    onDelete: (index: number) => Promise<void> | void
    onEdit: (a: Adventure) => void
    onPlay?: (a: Adventure) => void
    loading?: boolean
    /** `grid` (default) for full pages; `rail` for dashboard shelves. */
    layout?: 'grid' | 'rail'
}

export function InProgressList({
                                   adventures,
                                   onDelete,
                                   onEdit,
                                   onPlay,
                                   loading = false,
                                   layout = 'grid',
                               }: InProgressListProps) {
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
                items={adventures}
                layout={layout}
                loading={loading}
                emptyMessage={
                    <EmptyState
                        icon={<Icon icon={Compass} size={32}/>}
                        message="No adventures in progress"
                        secondaryText="Start a new adventure from the Templates section!"
                    />
                }
                renderCard={(adventure, idx) => {
                    const isDeleting = deletingId === idx
                    const characterNames = adventure.characters?.map(c => c.name).join(', ') || 'No characters'

                    const options: CardOption[] = [
                        {
                            type: 'custom',
                            icon: <Icon icon={Play} size={15}/>,
                            label: 'Continue',
                            onClick: () => onPlay ? onPlay(adventure) : onEdit(adventure),
                            disabled: isDeleting
                        },
                        {
                            type: 'custom',
                            icon: <Icon icon={Pencil} size={15}/>,
                            label: 'Edit',
                            onClick: () => onEdit(adventure),
                            disabled: isDeleting
                        },
                        {
                            type: 'custom',
                            icon: <Icon icon={Trash2} size={15}/>,
                            label: 'Delete',
                            onClick: () => setPending({idx, name: adventure.scenario}),
                            disabled: isDeleting,
                            danger: true
                        },
                    ]

                    return (
                        <Card
                            key={adventure.id}
                            title={adventure.scenario}
                            subtitle={
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge tone="live">{adventure.status || 'in-progress'}</Badge>
                                    {adventure.world?.name && <Tag>{adventure.world.name}</Tag>}
                                </div>
                            }
                            options={options}
                            onClick={() => onPlay ? onPlay(adventure) : onEdit(adventure)}
                            className={isDeleting ? 'pointer-events-none opacity-50' : ''}
                        >
                            <p className="m-0 font-narrative text-sm text-parchment-400">Characters: {characterNames}</p>
                            {adventure.turns && adventure.turns.length > 0 && (
                                <div className="mt-2 border-t border-dashed border-parchment-50/10 pt-2 font-narrative text-sm italic text-parchment-400">
                                    Last
                                    action: {adventure.turns[adventure.turns.length - 1].content.substring(0, 100)}...
                                </div>
                            )}
                            {isDeleting && (
                                <div className="absolute inset-0 z-[1] flex items-center justify-center bg-ink-900/70 font-medium text-parchment-50">
                                    Deleting...
                                </div>
                            )}
                        </Card>
                    )
                }}
            />

            {pending && (
                <ConfirmDialog
                    title="Delete Adventure"
                    message={
                        <>
                            Are you sure you want to delete <strong>{pending.name}</strong>?
                            <div className="mt-2 text-sm font-medium text-amber-500">This action cannot be undone.</div>
                        </>
                    }
                    visible={true}
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    variant="danger"
                    isProcessing={deletingId !== null}
                    onConfirm={handleDelete}
                    onCancel={() => setPending(null)}
                />
            )}
        </div>
    )
}