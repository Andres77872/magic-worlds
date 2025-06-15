import type { Adventure } from '../types'
import '../App.css'

export function InteractionLeftPanel({ adventure }: { adventure: Adventure }) {
  return (
    <div className="left-panel">
      <h4>Adventure Info</h4>
      <p><strong>Scenario:</strong> {adventure.scenario}</p>

      <h4>Worlds</h4>
      <ul>
        {adventure.worlds.map((w) => (
          <li key={w.id}>{w.name}</li>
        ))}
      </ul>

      <h4>Characters</h4>
      <ul>
        {adventure.characters.map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>
    </div>
  )
}