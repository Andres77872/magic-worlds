import { useState } from 'react'
import type { Adventure } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { ListItemActions } from './ListItemActions'
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
              <button
                className="list-item-link"
                onClick={() => onEdit(t)}
              >
                {t.scenario}
              </button>
              <ListItemActions
                actions={[
                  { type: 'open', onClick: () => onEdit(t) },
                  { type: 'start', onClick: () => onStart(t) },
                  { type: 'delete', onClick: () => setPending({ idx, name: t.scenario }) },
                ]}
              />
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