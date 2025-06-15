import { useState } from 'react'
import type { Adventure } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import '../App.css'

export function TemplateList({
  templates,
  onStart,
  onDelete,
  onEdit,
}: {
  templates: Adventure[]
  onStart: (a: Adventure) => void
  onDelete: (index: number) => void
  onEdit: (a: Adventure) => void
}) {
  const [pending, setPending] = useState<{
    idx: number
    name: string
  } | null>(null)

  return (
    <>
      {templates.length === 0 ? (
        <p>No adventure templates yet.</p>
      ) : (
        <ul className="list">
          {templates.map((t, idx) => (
            <li key={idx} className="list-item">
              <span>{t.scenario}</span>
              <div>
                <button
                  className="edit-button"
                  onClick={() => onEdit(t)}
                >
                  Open
                </button>
                <button
                  className="start-button"
                  onClick={() => onStart(t)}
                >
                  Start
                </button>
                <button
                  className="delete-button"
                  onClick={() => setPending({ idx, name: t.scenario })}
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
        message={pending ? `Delete template "${pending.name}"?` : ''}
        onConfirm={() => {
          onDelete(pending!.idx)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      />
    </>
  )
}