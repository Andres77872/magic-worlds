import type { Adventure, TurnEntry } from '../types'
import '../App.css'


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
            <strong>Turn {t.number}:</strong>
            <div className="turn-summary">
              <em>You:</em> {t.user.slice(0, 50)}
              {t.user.length > 50 ? '...' : ''}
            </div>
            <div className="turn-summary">
              <em>AI:</em> {t.assistant.slice(0, 50)}
              {t.assistant.length > 50 ? '...' : ''}
            </div>
          </li>
        ))}
        </ul>
      )}
    </div>
  )
}