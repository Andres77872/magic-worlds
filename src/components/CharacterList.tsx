import { useState } from 'react'
import type { Character } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { ListItemActions } from './ListItemActions'
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
        <ul className="list">
          {characters.map((c, idx) => (
            <li key={idx} className="list-item">
              <button
                className="list-item-link"
                onClick={() => onEdit(c)}
              >
                {c.name} ({c.race})
              </button>
              <ListItemActions
                actions={[
                  { type: 'open', onClick: () => onEdit(c) },
                  { type: 'delete', onClick: () => setPending({ idx, name: c.name }) },
                ]}
              />
            </li>
          ))}
        </ul>
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