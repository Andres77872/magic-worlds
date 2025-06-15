import { useState } from 'react'
import type { Adventure } from '../../types'
import { ConfirmDialog } from '../ConfirmDialog'
import { CardGrid } from './CardGrid'
import { Card } from './Card'
import type { CardOption } from './CardOptions'
import { FaTrash, FaPlay, FaEdit } from 'react-icons/fa'
import './cards.css'

interface InProgressListProps {
  adventures: Adventure[]
  onDelete: (index: number) => Promise<void> | void
  onEdit: (a: Adventure) => void
  loading?: boolean
}

export function InProgressList({
  adventures,
  onDelete,
  onEdit,
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
          <div className="empty-state">
            <p>No adventures in progress</p>
            <p>Start a new adventure from the Templates section!</p>
          </div>
        }
        renderCard={(adventure, idx) => {
          const isDeleting = deletingId === idx
          const characterNames = adventure.characters?.map(c => c.name).join(', ') || 'No characters'
          
          const options: CardOption[] = [
            { 
              type: 'custom', 
              icon: <FaPlay />, 
              label: 'Continue',
              onClick: () => onEdit(adventure),
              disabled: isDeleting
            },
            { 
              type: 'custom', 
              icon: <FaEdit />, 
              label: 'Edit',
              onClick: () => onEdit(adventure),
              disabled: isDeleting
            },
            { 
              type: 'custom', 
              icon: <FaTrash />, 
              label: 'Delete',
              onClick: () => setPending({ idx, name: adventure.scenario }),
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
              onClick={() => onEdit(adventure)}
              className={isDeleting ? 'deleting' : ''}
            >
              {adventure.turns && adventure.turns.length > 0 && (
                <div className="message-preview">
                  Last action: {adventure.turns[adventure.turns.length - 1].userInput.substring(0, 100)}...
                </div>
              )}
              {isDeleting && <div className="deleting-overlay">Deleting...</div>}
            </Card>
          )
        }}
      />

      <ConfirmDialog
        visible={pending !== null}
        title="Delete Adventure"
        message={pending ? `Are you sure you want to delete the adventure "${pending.name}"? This action cannot be undone.` : ''}
        onConfirm={handleDelete}
        onCancel={() => setPending(null)}
        variant="danger"
      />
    </div>
  )
}