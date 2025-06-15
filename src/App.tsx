import { useState, useEffect } from 'react'
import './App.css'
import { storage } from './services/storage'
import type { Character, World, Adventure } from './types'
import { CharacterCreator } from './components/CharacterCreator'
import { WorldCreator } from './components/WorldCreator'
import { AdventureCreator } from './components/AdventureCreator'
import { TemplateList } from './components/TemplateList'
import { InProgressList } from './components/InProgressList'

export default function App() {
  const [page, setPage] = useState<'landing' | 'character' | 'world' | 'adventure'>('landing')
  const [characters, setCharacters] = useState<Character[]>([])
  const [worlds, setWorlds] = useState<World[]>([])
  const [templateAdventures, setTemplateAdventures] = useState<Adventure[]>([])
  const [inProgressAdventures, setInProgressAdventures] = useState<Adventure[]>([])

  const goTo = (next: 'landing' | 'character' | 'world' | 'adventure') => setPage(next)

  const addCharacter = (c: Character) => {
    setCharacters((prev) => [...prev, c])
    setPage('landing')
  }

  const addWorld = (w: World) => {
    setWorlds((prev) => [...prev, w])
    setPage('landing')
  }

  const addAdventure = (a: Adventure) => {
    setTemplateAdventures((prev) => [...prev, a])
    setPage('landing')
  }

  const startAdventure = (a: Adventure) => {
    setInProgressAdventures((prev) => [...prev, a])
  }

  // Load from browser storage on mount
  useEffect(() => {
    storage.loadCharacters().then(setCharacters)
    storage.loadWorlds().then(setWorlds)
    storage.loadTemplateAdventures().then(setTemplateAdventures)
    storage.loadInProgressAdventures().then(setInProgressAdventures)
  }, [])

  // Persist changes to browser storage
  useEffect(() => { storage.saveCharacters(characters) }, [characters])
  useEffect(() => { storage.saveWorlds(worlds) }, [worlds])
  useEffect(() => { storage.saveTemplateAdventures(templateAdventures) }, [templateAdventures])
  useEffect(() => { storage.saveInProgressAdventures(inProgressAdventures) }, [inProgressAdventures])

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
            <h3>Adventure Templates</h3>
            <TemplateList templates={templateAdventures} onStart={startAdventure} />
          </div>

          <div className="list-section">
            <h3>Adventures In Progress</h3>
            <InProgressList adventures={inProgressAdventures} />
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