import {useState} from 'react'
import type {Adventure} from '../../../shared/types'
import {ConfirmDialog} from '../ConfirmDialog'
import {Card, CardGrid} from './Card'
import type {CardOption} from './Card'
import {EmptyState} from '../common/EmptyState'
import {ModeBadge} from '../common/ModeBadge'
import {Compass, Pencil, Play, Trash2} from 'lucide-react'
import {Icon, Tag} from '@/ui/primitives'
import {resolveMediaUrl} from '@/infrastructure/api'
import {formatRelativeTime} from '@/utils/time'

interface InProgressListProps {
    adventures: Adventure[]
    onDelete: (index: number) => Promise<void> | void
    onEdit: (a: Adventure) => void
    onPlay?: (a: Adventure) => void
    loading?: boolean
    /** `grid` (default) for full pages; `rail` for dashboard shelves. */
    layout?: 'grid' | 'rail'
}

function meaningful(value?: string | null): string {
    const text = value?.trim() ?? ''
    return text.length > 1 ? text : ''
}

function inProgressTitle(adventure: Adventure): string {
    const personaName = meaningful(adventure.persona?.name)
    const worldName = meaningful(adventure.world?.name)
    return (
        meaningful(adventure.snapshot?.template?.name) ||
        meaningful(adventure.scenario) ||
        (personaName ? `${personaName}'s adventure` : '') ||
        (worldName ? `Adventure in ${worldName}` : '') ||
        'Untitled session'
    )
}

function inProgressWorldName(adventure: Adventure): string {
    return meaningful(adventure.world?.name) || meaningful(adventure.worlds?.[0]?.name)
}

function sessionUpdatedLabel(adventure: Adventure): string {
    const relative = formatRelativeTime(adventure.updatedAt ?? adventure.createdAt)
    return relative ? `Updated ${relative}` : ''
}

function sessionDetails(adventure: Adventure): string[] {
    const personaName = meaningful(adventure.persona?.name)
    const cast = (adventure.characters ?? [])
        .map((character) => meaningful(character.name))
        .filter(Boolean)
    const visibleCast = cast.slice(0, 3)
    const details: string[] = []

    if (personaName) details.push(`Playing as ${personaName}`)
    if (visibleCast.length > 0) {
        details.push(`Cast: ${visibleCast.join(', ')}${cast.length > visibleCast.length ? ` +${cast.length - visibleCast.length}` : ''}`)
    }

    const updated = sessionUpdatedLabel(adventure)
    if (updated) details.push(updated)
    if (details.length === 0) details.push('Ready to continue')

    return details
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
                        secondaryText="Begin an adventure from your library."
                    />
                }
                renderCard={(adventure, idx) => {
                    const isDeleting = deletingId === idx
                    const title = inProgressTitle(adventure)
                    const worldName = inProgressWorldName(adventure)
                    const details = sessionDetails(adventure)

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
                            onClick: () => setPending({idx, name: title}),
                            disabled: isDeleting,
                            danger: true
                        },
                    ]

                    return (
                        <Card
                            key={adventure.id}
                            title={title}
                            subtitle={
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <ModeBadge mode="adventure"/>
                                    {worldName && <Tag>{worldName}</Tag>}
                                </div>
                            }
                            options={options}
                            onClick={() => onPlay ? onPlay(adventure) : onEdit(adventure)}
                            imageUrl={resolveMediaUrl(adventure.image_url ?? adventure.snapshot?.template?.image_url)}
                            themeSongUrl={resolveMediaUrl(adventure.theme_song_url ?? adventure.snapshot?.template?.theme_song_url)}
                            className={isDeleting ? 'pointer-events-none opacity-50' : ''}
                        >
                            <div className="flex flex-col gap-1 font-narrative text-sm text-parchment-400">
                                {details.map((detail) => (
                                    <p key={detail} className="m-0">{detail}</p>
                                ))}
                            </div>
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
