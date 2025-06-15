import { useState } from 'react'
import type { Character } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
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
              <span>{c.name} ({c.race})</span>
              <div>
                <button
                  className="edit-button"
                  onClick={() => onEdit(c)}
                >
                  Open
                </button>
                <button
                  className="delete-button"
                  onClick={() => setPending({ idx, name: c.name })}
                >
                  Delete
                </button>
              </div>
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