import { useState } from 'react'
import type { World } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { CardGrid } from './CardGrid'
import { Card } from './Card'
import type { CardOption } from './CardOptions'
import '../App.css'

export function WorldList({
  worlds,
  onDelete,
  onEdit,
}: {
  worlds: World[]
  onDelete: (index: number) => void
  onEdit: (w: World) => void
}) {
  const [pending, setPending] = useState<{
    idx: number
    name: string
  } | null>(null)

  return (
    <>
      {worlds.length === 0 ? (
        <p>No worlds yet.</p>
      ) : (
        <CardGrid>
          {worlds.map((w, idx) => {
            const actions: CardOption[] = [
              { type: 'open', onClick: () => onEdit(w) },
              { type: 'delete', onClick: () => setPending({ idx, name: w.name }) },
            ]
            return <Card key={w.id} title={`${w.name} (${w.type})`} actions={actions} />
          })}
        </CardGrid>
      )}
      <ConfirmDialog
        visible={pending !== null}
        message={pending ? `Delete world "${pending.name}"?` : ''}
        onConfirm={() => {
          onDelete(pending!.idx)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      />
    </>
  )
}