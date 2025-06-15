import { useState } from 'react'
import type { World } from '../../types'
import { ConfirmDialog } from '../ConfirmDialog'
import { CardGrid } from './Card/CardGrid'
import { Card } from './Card/Card'
import type { CardOption } from './Card/CardOptions'
import { EmptyState } from '../common/EmptyState'
import { FaTrash, FaEdit, FaGlobe } from 'react-icons/fa'
import './cards.css'

interface WorldListProps {
  worlds: World[]
  onDelete: (index: number) => Promise<void> | void
  onEdit: (w: World) => void
  loading?: boolean
}

export function WorldList({
  worlds,
  onDelete,
  onEdit,
  loading = false,
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
    <div className="world-list">
      <CardGrid
        items={worlds}
        loading={loading}
        emptyMessage={
          <EmptyState
            icon={<FaGlobe size={32} />}
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
              icon: <FaEdit />, 
              label: 'Edit',
              onClick: () => onEdit(world),
              disabled: isDeleting
            },
            { 
              type: 'custom', 
              icon: <FaTrash />, 
              label: 'Delete',
              onClick: () => setPending({ idx, name: world.name }),
              disabled: isDeleting,
              danger: true
            },
          ]

          return (
            <Card
              key={world.id}
              title={`${world.name} (${world.type})`}
              subtitle={world.description ? world.description.substring(0, 100) + (world.description.length > 100 ? '...' : '') : 'No description'}
              actions={options}
              onClick={() => onEdit(world)}
              className={isDeleting ? 'deleting' : ''}
            >
              {isDeleting && <div className="deleting-overlay">Deleting...</div>}
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