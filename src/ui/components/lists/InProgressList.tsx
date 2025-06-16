import {useState} from 'react'
import type {Adventure} from '../../../shared/types'
import {ConfirmDialog} from '../ConfirmDialog'
import {Card, CardGrid} from './Card'
import type {CardOption} from './Card'
import {EmptyState} from '../common/EmptyState'
import {FaCompass, FaEdit, FaPlay, FaTrash} from 'react-icons/fa'
import './lists.css'

interface InProgressListProps {
    adventures: Adventure[]
    onDelete: (index: number) => Promise<void> | void
    onEdit: (a: Adventure) => void
    onPlay?: (a: Adventure) => void
    loading?: boolean
}

export function InProgressList({
                                   adventures,
                                   onDelete,
                                   onEdit,
                                   onPlay,
                                   loading = false,
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
        <div className="in-progress-list">
            <CardGrid
                items={adventures}
                loading={loading}
                emptyMessage={
                    <EmptyState
                        icon={<FaCompass size={32}/>}
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
                            icon: <FaPlay/>,
                            label: 'Continue',
                            onClick: () => onPlay ? onPlay(adventure) : onEdit(adventure),
                            disabled: isDeleting
                        },
                        {
                            type: 'custom',
                            icon: <FaEdit/>,
                            label: 'Edit',
                            onClick: () => onEdit(adventure),
                            disabled: isDeleting
                        },
                        {
                            type: 'custom',
                            icon: <FaTrash/>,
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
                            subtitle={`Characters: ${characterNames} • World: ${adventure.world?.name || 'No world'}`}
                            actions={options}
                            onClick={() => onPlay ? onPlay(adventure) : onEdit(adventure)}
                            className={isDeleting ? 'deleting' : ''}
                        >
                            {adventure.turns && adventure.turns.length > 0 && (
                                <div className="message-preview">
                                    Last
                                    action: {adventure.turns[adventure.turns.length - 1].content.substring(0, 100)}...
                                </div>
                            )}
                            {isDeleting && <div className="deleting-overlay">Deleting...</div>}
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
                            <div className="warning-text">This action cannot be undone.</div>
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