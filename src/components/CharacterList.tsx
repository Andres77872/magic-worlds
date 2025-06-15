import { useState } from 'react'
import type { Character } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { CardGrid } from './CardGrid'
import { Card } from './Card'
import type { ListAction } from './ListItemActions'
import '../App.css'

export function CharacterList({
  characters,
  onDelete,
  onEdit,
}: {
  characters: Character[]
  onDelete: (index: number) => void
  onEdit: (c: Character) => void
}) {
  const [pending, setPending] = useState<{
    idx: number
    name: string
  } | null>(null)

  return (
    <>
      {characters.length === 0 ? (
        <p>No characters yet.</p>
      ) : (
        <CardGrid>
          {characters.map((c, idx) => {
            const actions: ListAction[] = [
              { type: 'open', onClick: () => onEdit(c) },
              { type: 'delete', onClick: () => setPending({ idx, name: c.name }) },
            ]
            return (
              <Card key={c.id} title={`${c.name} (${c.race})`} actions={actions} />
            )
          })}
        </CardGrid>
      )}
      <ConfirmDialog
        visible={pending !== null}
        message={pending ? `Delete character "${pending.name}"?` : ''}
        onConfirm={() => {
          onDelete(pending!.idx)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      />
    </>
  )
}