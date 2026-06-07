import {useState} from 'react'
import type {Character} from '../../../shared/types'
import {ConfirmDialog} from '../ConfirmDialog'
import {Card, CardGrid} from './Card'
import type {CardOption} from './Card'
import {EmptyState} from '../common/EmptyState'
import {Pencil, Trash2, User} from 'lucide-react'
import {Icon, Tag} from '@/ui/primitives'

interface CharacterListProps {
    characters: Character[]
    onDelete: (index: number) => Promise<void> | void
    onEdit: (character: Character) => void
    loading?: boolean
    /** `grid` (default) for full pages; `rail` for dashboard shelves. */
    layout?: 'grid' | 'rail'
}

export function CharacterList({
                                  characters,
                                  onDelete,
                                  onEdit,
                                  loading = false,
                                  layout = 'grid',
                              }: CharacterListProps) {
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
                items={characters}
                layout={layout}
                loading={loading}
                emptyMessage={
                    <EmptyState
                        icon={<Icon icon={User} size={32}/>}
                        message="No characters created yet"
                        button={{
                            label: 'Create Your First Character',
                            onClick: () => onEdit({id: '', name: '', race: '', stats: {}})
                        }}
                    />
                }
                renderCard={(character, idx) => {
                    const isDeleting = deletingId === idx

                    const options: CardOption[] = [
                        {
                            type: 'custom',
                            icon: <Icon icon={Pencil} size={15}/>,
                            label: 'Edit',
                            onClick: () => onEdit(character),
                            disabled: isDeleting
                        },
                        {
                            type: 'custom',
                            icon: <Icon icon={Trash2} size={15}/>,
                            label: 'Delete',
                            onClick: () => setPending({idx, name: character.name}),
                            disabled: isDeleting,
                            danger: true
                        },
                    ]

                    const stats = Object.entries(character.stats ?? {})
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' • ')

                    return (
                        <Card
                            key={character.id}
                            title={character.name as string}
                            subtitle={
                                character.race
                                    ? <div className="flex flex-wrap items-center gap-1.5"><Tag>{character.race}</Tag></div>
                                    : undefined
                            }
                            options={options}
                            onClick={() => onEdit(character)}
                            className={isDeleting ? 'pointer-events-none opacity-50' : ''}
                        >
                            {stats && <div className="font-narrative text-sm italic text-parchment-400">{stats}</div>}
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
                title="Delete Character"
                message={
                    <>
                        Are you sure you want to delete <strong>{pending?.name}</strong>?
                        <p className="mt-2 text-sm font-medium text-amber-500">This action cannot be undone.</p>
                    </>
                }
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleDelete}
                onCancel={() => setPending(null)}
                isProcessing={deletingId !== null}
            />
        </div>
    )
}