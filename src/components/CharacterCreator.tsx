import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Character } from '../types'
import '../App.css'

export function CharacterCreator({
  onSubmit,
  onBack,
}: {
  onSubmit: (c: Character) => void
  onBack: () => void
}) {
  const [name, setName] = useState('')
  const [race, setRace] = useState('')
  const [stats, setStats] = useState<{ key: string; value: string }[]>([])

  const addStat = () => setStats((prev) => [...prev, { key: '', value: '' }])

  const updateStat = (
    index: number,
    field: 'key' | 'value',
    value: string,
  ) => {
    setStats((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const statsRecord = stats.reduce<Record<string, string>>((acc, cur) => {
      if (cur.key) acc[cur.key] = cur.value
      return acc
    }, {})
    onSubmit({ name, race, stats: statsRecord })
  }

  return (
    <form className="form-container" onSubmit={handleSubmit}>
      <h2>Create Character</h2>
      <div className="form-field">
        <label className="field-label">Name</label>
        <input
          className="field-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="field-label">Race</label>
        <input
          className="field-input"
          value={race}
          onChange={(e) => setRace(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="field-label">Additional Stats</label>
        {stats.map((stat, i) => (
          <div key={i} className="form-field">
            <input
              className="field-input"
              placeholder="Stat Name"
              value={stat.key}
              onChange={(e) => updateStat(i, 'key', e.target.value)}
            />
            <input
              className="field-input"
              placeholder="Stat Value"
              value={stat.value}
              onChange={(e) => updateStat(i, 'value', e.target.value)}
            />
          </div>
        ))}
        <button type="button" className="add-stat-button" onClick={addStat}>
          + Add Stat
        </button>
      </div>
      <div className="button-group">
        <button type="button" className="back-button" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="submit-button">
          Save Character
        </button>
      </div>
    </form>
  )
}