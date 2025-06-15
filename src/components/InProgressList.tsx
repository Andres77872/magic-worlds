import { useState } from 'react'
import type { Adventure } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { CardGrid } from './CardGrid'
import { Card } from './Card'
import type { CardOption } from './CardOptions'
import '../App.css'

export function InProgressList({
  adventures,
  onDelete,
  onEdit,
}: {
  adventures: Adventure[]
  onDelete: (index: number) => void
  onEdit: (a: Adventure) => void
}) {
  const [pending, setPending] = useState<{
    idx: number
    name: string
  } | null>(null)

  return (
    <>
      {adventures.length === 0 ? (
        <p>No adventures in progress.</p>
      ) : (
        <CardGrid>
          {adventures.map((a, idx) => {
            const actions: CardOption[] = [
              { type: 'open', onClick: () => onEdit(a) },
              { type: 'delete', onClick: () => setPending({ idx, name: a.scenario }) },
            ]
            return <Card key={a.id} title={a.scenario} actions={actions} />
          })}
        </CardGrid>
      )}
      <ConfirmDialog
        visible={pending !== null}
        message={pending ? `Delete in‑progress "${pending.name}"?` : ''}
        onConfirm={() => {
          onDelete(pending!.idx)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      />
    </>
  )
}