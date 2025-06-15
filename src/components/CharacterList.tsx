import { useState } from 'react'
import type { Character } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { CardGrid } from './CardGrid'
import { Card } from './Card'
import type { CardOption } from './CardOptions'
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
        <CardGrid
          items={characters}
          renderCard={(c, idx) => {
            const options: CardOption[] = [
              { type: 'open', onClick: () => onEdit(c) },
              { type: 'delete', onClick: () => setPending({ idx, name: c.name }) },
            ]
            return <Card title={`${c.name} (${c.race})`} actions={options} />
          }}
        />
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