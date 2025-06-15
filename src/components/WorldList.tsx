import { useState } from 'react'
import type { World } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
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
        <ul className="list">
          {worlds.map((w, idx) => (
            <li key={idx} className="list-item">
              <span>{w.name} ({w.type})</span>
              <div>
                <button
                  className="edit-button"
                  onClick={() => onEdit(w)}
                >
                  Open
                </button>
                <button
                  className="delete-button"
                  onClick={() => setPending({ idx, name: w.name })}
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