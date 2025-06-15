import { useState } from 'react'
import type { Character } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import '../App.css'

export function CharacterList({
  characters,
  onDelete,
}: {
  characters: Character[]
  onDelete: (index: number) => void
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
              <button
                className="delete-button"
                onClick={() => setPending({ idx, name: c.name })}
              >
                Delete
              </button>
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