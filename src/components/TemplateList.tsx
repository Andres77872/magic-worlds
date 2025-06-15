import { useState } from 'react'
import type { Adventure } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { CardGrid } from './CardGrid'
import { Card } from './Card'
import type { CardOption } from './CardOptions'
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
        <CardGrid
          items={templates}
          renderCard={(t, idx) => {
            const options: CardOption[] = [
              { type: 'open', onClick: () => onEdit(t) },
              { type: 'start', onClick: () => onStart(t) },
              { type: 'delete', onClick: () => setPending({ idx, name: t.scenario }) },
            ]
            return <Card title={t.scenario} actions={options} />
          }}
        />
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