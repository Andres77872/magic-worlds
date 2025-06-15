import { useState } from 'react'
import type { Adventure } from '../../types'
import { ConfirmDialog } from '../ConfirmDialog'
import { CardGrid } from './Card/CardGrid'
import { Card } from './Card/Card'
import type { CardOption } from './Card/CardOptions'
import { FaPlay, FaTrash, FaEdit } from 'react-icons/fa'
import './cards.css'

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
          <div className="empty-state">
            <p>No adventure templates yet</p>
            <button 
              className="primary-button" 
              onClick={() => onEdit({ 
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
              })}
            >
              Create Your First Template
            </button>
          </div>
        }
        renderCard={(template, idx) => {
          const isDeleting = deletingId === idx
          const characterNames = template.characters?.map(c => c.name).join(', ') || 'No characters'
          
          const options: CardOption[] = [
            { 
              type: 'custom', 
              icon: <FaEdit />, 
              label: 'Edit',
              onClick: () => onEdit(template),
              disabled: isDeleting
            },
            { 
              type: 'custom', 
              icon: <FaPlay />, 
              label: 'Start',
              onClick: () => onStart(template),
              disabled: isDeleting
            },
            { 
              type: 'custom', 
              icon: <FaTrash />, 
              label: 'Delete',
              onClick: () => setPending({ idx, name: template.scenario }),
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
                  {template.turns[0].userInput.substring(0, 100)}...
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