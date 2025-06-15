import type { Adventure } from '../../types'
import '../../App.css'

export function InteractionLeftPanel({ adventure }: { adventure: Adventure }) {
  return (
    <div className="left-panel">
      <h4>Adventure Info</h4>
      <p><strong>Scenario:</strong> {adventure.scenario}</p>

      <h4>World</h4>
      {adventure.world ? (
        <ul>
          <li key={adventure.world.id}>
            {adventure.world.name} ({adventure.world.type})
          </li>
        </ul>
      ) : (
        <p>No world selected</p>
      )}

      <h4>Characters</h4>
      {adventure.characters && adventure.characters.length > 0 ? (
        <ul>
          {adventure.characters.map((character) => (
            <li key={character.id}>{character.name}</li>
          ))}
        </ul>
      ) : (
        <p>No characters</p>
      )}
    </div>
  )
}