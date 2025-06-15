import type { Character, World, Adventure } from '../types'
import { CharacterList, WorldList, TemplateList, InProgressList } from './lists'
import { ConfirmDialog } from './ConfirmDialog'

interface LandingPageProps {
  isLoading: boolean
  characters: Character[]
  worlds: World[]
  templateAdventures: Adventure[]
  inProgressAdventures: Adventure[]
  onCharacterEdit: (character: Character) => void
  onCharacterDelete: (index: number) => Promise<void>
  onWorldEdit: (world: World) => void
  onWorldDelete: (index: number) => Promise<void>
  onTemplateEdit: (template: Adventure) => void
  onTemplateStart: (template: Adventure) => void
  onTemplateDelete: (index: number) => Promise<void>
  onInProgressEdit: (adventure: Adventure) => void
  onInProgressDelete: (index: number) => Promise<void>
  onClearAll: () => void
  onGoTo: (page: 'landing' | 'character' | 'world' | 'adventure' | 'interaction') => void
  confirmClear: boolean
  setConfirmClear: (value: boolean) => void
}

export function LandingPage({
  isLoading,
  characters,
  worlds,
  templateAdventures,
  inProgressAdventures,
  onCharacterEdit,
  onCharacterDelete,
  onWorldEdit,
  onWorldDelete,
  onTemplateEdit,
  onTemplateStart,
  onTemplateDelete,
  onInProgressEdit,
  onInProgressDelete,
  onClearAll,
  onGoTo,
  confirmClear,
  setConfirmClear,
}: LandingPageProps) {
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <span className="spinner" />
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="landing">
      <div className="landing-buttons">
        <button className="landing-button" onClick={() => onGoTo('character')}>
          Create New Character
        </button>
        <button className="landing-button" onClick={() => onGoTo('world')}>
          Create New World
        </button>
        <button className="landing-button" onClick={() => onGoTo('adventure')}>
          Create New Adventure
        </button>
      </div>

      <div className="list-section">
        <h3>Characters</h3>
        <CharacterList
          characters={characters}
          onEdit={onCharacterEdit}
          onDelete={onCharacterDelete}
        />
      </div>

      <div className="list-section">
        <h3>Worlds</h3>
        <WorldList
          worlds={worlds}
          onEdit={onWorldEdit}
          onDelete={onWorldDelete}
        />
      </div>

      <div className="list-section">
        <h3>Adventure Templates</h3>
        <TemplateList
          templates={templateAdventures}
          onEdit={onTemplateEdit}
          onStart={onTemplateStart}
          onDelete={onTemplateDelete}
        />
      </div>

      <div className="list-section">
        <h3>Adventures In Progress</h3>
        <InProgressList
          adventures={inProgressAdventures}
          onEdit={onInProgressEdit}
          onDelete={onInProgressDelete}
        />
      </div>

      <div className="list-section">
        <button
          className="delete-button"
          onClick={() => setConfirmClear(true)}
        >
          Clear All Data
        </button>
        <ConfirmDialog
          visible={confirmClear}
          message="Delete all stored data for Magic Worlds?"
          onConfirm={onClearAll}
          onCancel={() => setConfirmClear(false)}
        />
      </div>
    </div>
  )
}
