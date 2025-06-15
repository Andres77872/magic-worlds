import { useState } from 'react'
import type { Adventure } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
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
        <ul className="list">
          {adventures.map((a, idx) => (
            <li key={idx} className="list-item">
              <span>{a.scenario}</span>
              <div>
                <button
                  className="edit-button"
                  onClick={() => onEdit(a)}
                >
                  Open
                </button>
                <button
                  className="delete-button"
                  onClick={() => setPending({ idx, name: a.scenario })}
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