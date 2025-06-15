import { useState } from 'react'
import type { Character } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { CardGrid } from './CardGrid'
import { Card } from './Card'
import type { CardOption } from './CardOptions'
import { FaUser, FaTrash, FaEdit } from 'react-icons/fa'
import '../App.css'

interface CharacterListProps {
  characters: Character[]
  onDelete: (index: number) => Promise<void> | void
  onEdit: (character: Character) => void
  loading?: boolean
}

export function CharacterList({
  characters,
  onDelete,
  onEdit,
  loading = false,
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
    <div className="character-list">
      <CardGrid
        items={characters}
        loading={loading}
        emptyMessage={
          <div className="empty-state">
            <FaUser size={32} className="empty-icon" />
            <p>No characters created yet</p>
            <button 
              className="primary-button" 
              onClick={() => onEdit({ id: '', name: '', race: '', stats: {} })}
            >
              Create Your First Character
            </button>
          </div>
        }
        renderCard={(character, idx) => {
          const isDeleting = deletingId === idx
          
          const options: CardOption[] = [
            { 
              type: 'custom', 
              icon: <FaEdit />, 
              label: 'Edit',
              onClick: () => onEdit(character),
              disabled: isDeleting
            },
            { 
              type: 'custom', 
              icon: <FaTrash />, 
              label: 'Delete',
              onClick: () => setPending({ idx, name: character.name }),
              disabled: isDeleting,
              danger: true
            },
          ]

          const stats = Object.entries(character.stats)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' • ')

          return (
            <Card
              key={character.id}
              title={character.name as string}
              subtitle={`Race: ${character.race}`}
              actions={options}
              onClick={() => onEdit(character)}
              className={isDeleting ? 'deleting' : ''}
            >
              {stats && <div className="character-stats">{stats}</div>}
              {isDeleting && <div className="deleting-overlay">Deleting...</div>}
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
            <p className="warning-text">This action cannot be undone.</p>
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