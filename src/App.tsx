import { useState, useEffect } from 'react'
import './App.css'
import { storage } from './services/storage'
import type { Character, World, Adventure } from './types'
import { CharacterCreator } from './components/CharacterCreator'
import { WorldCreator } from './components/WorldCreator'
import { AdventureCreator } from './components/AdventureCreator'
import { TemplateList } from './components/TemplateList'
import { InProgressList } from './components/InProgressList'
import { CharacterList } from './components/CharacterList'
import { WorldList } from './components/WorldList'

export default function App() {
  const [page, setPage] = useState<'landing' | 'character' | 'world' | 'adventure'>('landing')
  const [characters, setCharacters] = useState<Character[]>([])
  const [worlds, setWorlds] = useState<World[]>([])
  const [templateAdventures, setTemplateAdventures] = useState<Adventure[]>([])
  const [inProgressAdventures, setInProgressAdventures] = useState<Adventure[]>([])

  const goTo = (next: 'landing' | 'character' | 'world' | 'adventure') => setPage(next)

  const addCharacter = async (c: Character) => {
    const next = [...characters, c]
    setCharacters(next)
    await storage.saveCharacters(next)
    setPage('landing')
  }

  const addWorld = async (w: World) => {
    const next = [...worlds, w]
    setWorlds(next)
    await storage.saveWorlds(next)
    setPage('landing')
  }

  const addAdventure = async (a: Adventure) => {
    const next = [...templateAdventures, a]
    setTemplateAdventures(next)
    await storage.saveTemplateAdventures(next)
    setPage('landing')
  }

  const startAdventure = async (a: Adventure) => {
    const next = [...inProgressAdventures, a]
    setInProgressAdventures(next)
    await storage.saveInProgressAdventures(next)
  }

  const deleteCharacter = async (idx: number) => {
    const next = characters.filter((_, i) => i !== idx)
    setCharacters(next)
    await storage.saveCharacters(next)
  }

  const deleteWorld = async (idx: number) => {
    const next = worlds.filter((_, i) => i !== idx)
    setWorlds(next)
    await storage.saveWorlds(next)
  }

  const deleteTemplate = async (idx: number) => {
    const next = templateAdventures.filter((_, i) => i !== idx)
    setTemplateAdventures(next)
    await storage.saveTemplateAdventures(next)
  }

  const deleteInProgress = async (idx: number) => {
    const next = inProgressAdventures.filter((_, i) => i !== idx)
    setInProgressAdventures(next)
    await storage.saveInProgressAdventures(next)
  }

  // Load from browser storage on mount
  useEffect(() => {
    storage.loadCharacters().then(setCharacters)
    storage.loadWorlds().then(setWorlds)
    storage.loadTemplateAdventures().then(setTemplateAdventures)
    storage.loadInProgressAdventures().then(setInProgressAdventures)
  }, [])


  return (
    <div className="app-container">
      {page === 'landing' && (
        <div className="landing">
          <h1>Magic Worlds RPG</h1>
          <div className="landing-buttons">
            <button className="landing-button" onClick={() => goTo('character')}>
              Create New Character
            </button>
            <button className="landing-button" onClick={() => goTo('world')}>
              Create New World
            </button>
            <button className="landing-button" onClick={() => goTo('adventure')}>
              Create New Adventure
            </button>
          </div>

          <div className="list-section">
            <h3>Characters</h3>
            <CharacterList
              characters={characters}
              onDelete={deleteCharacter}
            />
          </div>

          <div className="list-section">
            <h3>Worlds</h3>
            <WorldList
              worlds={worlds}
              onDelete={deleteWorld}
            />
          </div>

          <div className="list-section">
            <h3>Adventure Templates</h3>
            <TemplateList
              templates={templateAdventures}
              onStart={startAdventure}
              onDelete={deleteTemplate}
            />
          </div>

          <div className="list-section">
            <h3>Adventures In Progress</h3>
            <InProgressList
              adventures={inProgressAdventures}
              onDelete={deleteInProgress}
            />
          </div>
        </div>
      )}

      {page === 'character' && (
        <CharacterCreator onSubmit={addCharacter} onBack={() => goTo('landing')} />
      )}

      {page === 'world' && (
        <WorldCreator onSubmit={addWorld} onBack={() => goTo('landing')} />
      )}

      {page === 'adventure' && (
        <AdventureCreator
          characters={characters}
          worlds={worlds}
          onSubmit={addAdventure}
          onBack={() => goTo('landing')}
        />
      )}
    </div>
  )
}