import {useState} from 'react'
import type {Adventure} from '../../../shared/types'
import {ConfirmDialog} from '../ConfirmDialog'
import {Card, CardGrid} from './Card'
import type {CardOption} from './Card'
import {EmptyState} from '../common/EmptyState'
import {Pencil, Play, Plus, Trash2} from 'lucide-react'
import {Badge, Icon, Tag} from '@/ui/primitives'

interface TemplateListProps {
    templates: Adventure[]
    onStart: (a: Adventure) => void
    onDelete: (index: number) => Promise<void> | void
    onEdit: (a: Adventure) => void
    loading?: boolean
}

export function TemplateList({
                                 templates,
                                 onStart,
                                 onDelete,
                                 onEdit,
                                 loading = false,
                             }: TemplateListProps) {
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
                items={templates}
                loading={loading}
                emptyMessage={
                    <EmptyState
                        icon={<Icon icon={Plus} size={32}/>}
                        message="No adventure templates yet"
                        button={{
                            label: 'Create Your First Template',
                            onClick: () => onEdit({
                                id: '',
                                scenario: 'New Adventure',
                                characters: [],
                                world: {
                                    id: 'new',
                                    name: 'New World',
                                    type: 'fantasy',
                                    details: {},
                                    description: ''
                                },
                                turns: [],
                                status: 'draft'
                            })
                        }}
                    />
                }
                renderCard={(template, idx) => {
                    const isDeleting = deletingId === idx
                    const characterNames = template.characters?.map(c => c.name).join(', ') || 'No characters'

                    const options: CardOption[] = [
                        {
                            type: 'custom',
                            icon: <Icon icon={Pencil} size={15}/>,
                            label: 'Edit',
                            onClick: () => onEdit(template),
                            disabled: isDeleting
                        },
                        {
                            type: 'custom',
                            icon: <Icon icon={Play} size={15}/>,
                            label: 'Start',
                            onClick: () => onStart(template),
                            disabled: isDeleting
                        },
                        {
                            type: 'custom',
                            icon: <Icon icon={Trash2} size={15}/>,
                            label: 'Delete',
                            onClick: () => setPending({idx, name: template.scenario}),
                            disabled: isDeleting,
                            danger: true
                        },
                    ]

                    return (
                        <Card
                            key={template.id}
                            title={template.scenario}
                            subtitle={
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {template.status && <Badge tone="neutral">{template.status}</Badge>}
                                    {template.world?.name && <Tag>{template.world.name}</Tag>}
                                </div>
                            }
                            options={options}
                            onClick={() => onEdit(template)}
                            className={isDeleting ? 'pointer-events-none opacity-50' : ''}
                        >
                            <p className="m-0 font-narrative text-sm text-parchment-400">Characters: {characterNames}</p>
                            {template.turns && template.turns.length > 0 && (
                                <div className="mt-2 border-t border-dashed border-parchment-50/10 pt-2 font-narrative text-sm italic text-parchment-400">
                                    {template.turns[0].content.substring(0, 100)}...
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

            <ConfirmDialog
                visible={pending !== null}
                title="Delete Template"
                message={pending ? `Are you sure you want to delete the template "${pending.name}"? This action cannot be undone.` : ''}
                onConfirm={handleDelete}
                onCancel={() => setPending(null)}
                variant="danger"
            />
        </div>
    )
}