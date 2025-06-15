import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Adventure, Character, World } from '../types'
import '../App.css'

export function AdventureCreator({
  characters,
  worlds,
  onSubmit,
  onBack,
}: {
  characters: Character[]
  worlds: World[]
  onSubmit: (a: Adventure) => void
  onBack: () => void
}) {
  const [scenario, setScenario] = useState('')
  const [selectedChars, setSelectedChars] = useState<string[]>([])
  const [selectedWorlds, setSelectedWorlds] = useState<string[]>([])

  const handleCharChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const opts = Array.from(e.target.selectedOptions).map((o) => o.value)
    setSelectedChars(opts)
  }

  const handleWorldChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const opts = Array.from(e.target.selectedOptions).map((o) => o.value)
    setSelectedWorlds(opts)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const chosenChars = characters.filter((c) =>
      selectedChars.includes(c.name),
    )
    const chosenWorlds = worlds.filter((w) =>
      selectedWorlds.includes(w.name),
    )
    onSubmit({ scenario, characters: chosenChars, worlds: chosenWorlds })
  }

  return (
    <form className="form-container" onSubmit={handleSubmit}>
      <h2>Create Adventure</h2>
      <div className="form-field">
        <label className="field-label">Scenario</label>
        <input
          className="field-input"
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="field-label">Choose Characters</label>
        <select
          className="field-input"
          multiple
          value={selectedChars}
          onChange={handleCharChange}
        >
          {characters.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label className="field-label">Choose Worlds</label>
        <select
          className="field-input"
          multiple
          value={selectedWorlds}
          onChange={handleWorldChange}
        >
          {worlds.map((w) => (
            <option key={w.name} value={w.name}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      <div className="button-group">
        <button type="button" className="back-button" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="submit-button">
          Save Adventure
        </button>
      </div>
    </form>
  )
}