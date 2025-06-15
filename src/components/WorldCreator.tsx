import { useState } from 'react'
import type { FormEvent } from 'react'
import type { World } from '../types'
import '../App.css'

export function WorldCreator({
  onSubmit,
  onBack,
  initial,
}: {
  onSubmit: (w: World) => void
  onBack: () => void
  initial?: World
}) {
  const [id] = useState(initial?.id ?? crypto.randomUUID())
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState(initial?.type ?? '')
  const [details, setDetails] = useState<{ key: string; value: string }[]>(
    initial ? Object.entries(initial.details).map(([key, value]) => ({ key, value })) : [],
  )

  const addDetail = () => setDetails((prev) => [...prev, { key: '', value: '' }])

  const updateDetail = (
    index: number,
    field: 'key' | 'value',
    value: string,
  ) => {
    setDetails((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const detailsRecord = details.reduce<Record<string, string>>((acc, cur) => {
      if (cur.key) acc[cur.key] = cur.value
      return acc
    }, {})
    onSubmit({ id, name, type, details: detailsRecord })
  }

  return (
    <form className="form-container" onSubmit={handleSubmit}>
      <h2>Create World</h2>
      <div className="form-field">
        <label className="field-label">Name</label>
        <input
          className="field-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="field-label">Type</label>
        <input
          className="field-input"
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="field-label">Additional Details</label>
        {details.map((detail, i) => (
          <div key={i} className="form-field">
            <input
              className="field-input"
              placeholder="Detail Name"
              value={detail.key}
              onChange={(e) => updateDetail(i, 'key', e.target.value)}
            />
            <input
              className="field-input"
              placeholder="Detail Value"
              value={detail.value}
              onChange={(e) => updateDetail(i, 'value', e.target.value)}
            />
          </div>
        ))}
        <button type="button" className="add-stat-button" onClick={addDetail}>
          + Add Detail
        </button>
      </div>
      <div className="button-group">
        <button type="button" className="back-button" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="submit-button">
          Save World
        </button>
      </div>
    </form>
  )
}