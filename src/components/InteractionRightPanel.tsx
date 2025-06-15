import type { Adventure } from '../types'
import '../App.css'

interface TurnEntry {
  number: number
  input: string
}

export function InteractionRightPanel({
  adventure,
  turns,
}: {
  adventure: Adventure
  turns: TurnEntry[]
}) {
  return (
    <div className="right-panel">
      <h4>Adventure Details</h4>
      <p><strong>ID:</strong> {adventure.id}</p>
      <h5>Turns</h5>
      {turns.length === 0 ? (
        <p>No turns yet.</p>
      ) : (
        <ul>
          {turns.map((t) => (
            <li key={t.number}>
              <strong>Turn {t.number}:</strong> {t.input.slice(0, 50)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}