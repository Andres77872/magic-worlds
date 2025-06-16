import {useState} from 'react'
import type {Adventure} from '../../../shared/types'
import {ConfirmDialog} from '../ConfirmDialog'
import {Card, CardGrid} from './Card'
import type {CardOption} from './Card'
import {EmptyState} from '../common/EmptyState'
import {FaEdit, FaPlay, FaPlus, FaTrash} from 'react-icons/fa'
import './lists.css'

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
        <div className="template-list">
            <CardGrid
                items={templates}
                loading={loading}
                emptyMessage={
                    <EmptyState
                        icon={<FaPlus size={32}/>}
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
                            icon: <FaEdit/>,
                            label: 'Edit',
                            onClick: () => onEdit(template),
                            disabled: isDeleting
                        },
                        {
                            type: 'custom',
                            icon: <FaPlay/>,
                            label: 'Start',
                            onClick: () => onStart(template),
                            disabled: isDeleting
                        },
                        {
                            type: 'custom',
                            icon: <FaTrash/>,
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
                            subtitle={`Characters: ${characterNames} • World: ${template.world?.name || 'No world'}`}
                            actions={options}
                            onClick={() => onEdit(template)}
                            className={isDeleting ? 'deleting' : ''}
                        >
                            {template.turns && template.turns.length > 0 && (
                                <div className="message-preview">
                                    {template.turns[0].content.substring(0, 100)}...
                                </div>
                            )}
                            {isDeleting && <div className="deleting-overlay">Deleting...</div>}
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