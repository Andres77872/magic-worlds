import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Adventure, Character, World } from '../types'
import '../App.css'

export function AdventureCreator({
  characters,
  worlds,
  onSubmit,
  onBack,
  initial,
}: {
  characters: Character[]
  worlds: World[]
  onSubmit: (a: Adventure) => void
  onBack: () => void
  initial?: Adventure
}) {
  const [id] = useState(initial?.id ?? crypto.randomUUID())
  const [scenario, setScenario] = useState(initial?.scenario ?? '')
  const [selectedChars, setSelectedChars] = useState<string[]>(
    initial ? initial.characters.map((c) => c.name) : [],
  )
  const [selectedWorlds, setSelectedWorlds] = useState<string[]>(
    initial ? initial.worlds.map((w) => w.name) : [],
  )


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
    onSubmit({ id, scenario, characters: chosenChars, worlds: chosenWorlds })
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
        <div className="checkbox-group">
          {characters.length === 0 ? (
            <p>No characters available.</p>
          ) : (
            characters.map((c) => (
              <label key={c.id} className="checkbox-label">
                <input
                  type="checkbox"
                  value={c.name}
                  checked={selectedChars.includes(c.name)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedChars((prev) => [...prev, c.name])
                    } else {
                      setSelectedChars((prev) =>
                        prev.filter((name) => name !== c.name),
                      )
                    }
                  }}
                />
                {c.name}
              </label>
            ))
          )}
        </div>
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