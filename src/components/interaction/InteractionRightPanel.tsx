import type { Adventure, TurnEntry } from '../../types'
import '../../App.css'

export function InteractionRightPanel({
  adventure,
  turns = [],
}: {
  adventure?: Adventure
  turns?: TurnEntry[]
}) {
  // Ensure we have a valid adventure and turns
  if (!adventure) {
    return (
      <div className="right-panel">
        <p>No adventure selected</p>
      </div>
    )
  }

  return (
    <div className="right-panel">
      <h4>Adventure Details</h4>
      <p><strong>Scenario:</strong> {adventure.scenario || 'No scenario'}</p>
      
      <h5>Turns ({turns.length})</h5>
      {!turns || turns.length === 0 ? (
        <p>No turns yet. Start the conversation!</p>
      ) : (
        <ul className="turn-list">
          {turns.map((turn) => {
            const userText = turn.userInput || ''
            const aiText = turn.assistantResponse || ''
            
            return (
              <li key={turn.number} className="turn-item">
                <strong>Turn {turn.number}:</strong>
                <div className="turn-summary">
                  <em>You:</em> {userText.slice(0, 50)}
                  {userText.length > 50 ? '...' : ''}
                </div>
                <div className="turn-summary">
                  <em>AI:</em> {aiText.slice(0, 50)}
                  {aiText.length > 50 ? '...' : ''}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}