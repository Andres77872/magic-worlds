import {useEffect, useState} from 'react'
import './App.css'
import {storage} from './services/storage'
import type {Adventure, Character, World} from './types'
import { CharacterCreator } from './components/CharacterCreator'
import { WorldCreator } from './components/WorldCreator'
import { AdventureCreator } from './components/AdventureCreator'
import { TemplateList } from './components/TemplateList'
import { InProgressList } from './components/InProgressList'
import { CharacterList } from './components/CharacterList'
import { WorldList } from './components/WorldList'
import { ConfirmDialog } from './components/ConfirmDialog'

export default function App() {
  const [page, setPage] = useState<'landing' | 'character' | 'world' | 'adventure'>('landing')
  const [characters, setCharacters] = useState<Character[]>([])
  const [worlds, setWorlds] = useState<World[]>([])
  const [templateAdventures, setTemplateAdventures] = useState<Adventure[]>([])
  const [inProgressAdventures, setInProgressAdventures] = useState<Adventure[]>([])

  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)
  const [editingWorld, setEditingWorld] = useState<World | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<Adventure | null>(null)
  const [editingInProgress, setEditingInProgress] = useState<Adventure | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

    const goTo = (next: 'landing' | 'character' | 'world' | 'adventure') => setPage(next)

  const handleSubmitCharacter = async (c: Character) => {
    let next: Character[]
    if (editingCharacter) {
      next = characters.map((x) => (x.id === c.id ? c : x))
      setEditingCharacter(null)
    } else {
      next = [...characters, c]
    }
    setCharacters(next)
    await storage.saveCharacters(next)
    setPage('landing')
  }

  const handleSubmitWorld = async (w: World) => {
    let next: World[]
    if (editingWorld) {
      next = worlds.map((x) => (x.id === w.id ? w : x))
      setEditingWorld(null)
    } else {
      next = [...worlds, w]
    }
    setWorlds(next)
    await storage.saveWorlds(next)
    setPage('landing')
  }

  const handleSubmitTemplate = async (a: Adventure) => {
    let next: Adventure[]
    if (editingTemplate) {
      next = templateAdventures.map((x) => (x.id === a.id ? a : x))
      setEditingTemplate(null)
    } else {
      next = [...templateAdventures, a]
    }
    setTemplateAdventures(next)
    await storage.saveTemplateAdventures(next)
    setPage('landing')
  }

  const handleStartOrUpdateInProgress = async (a: Adventure) => {
    let next: Adventure[]
    if (editingInProgress) {
      next = inProgressAdventures.map((x) => (x.id === a.id ? a : x))
      setEditingInProgress(null)
    } else {
      next = [...inProgressAdventures, a]
    }
    setInProgressAdventures(next)
    await storage.saveInProgressAdventures(next)
  }

    // DeleteCharacter handler is now provided inline in the list

    // DeleteWorld handler is now provided inline in the list

    // DeleteTemplate handler is now provided inline in the list

    // DeleteInProgress handler is now provided inline in the list

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
              onEdit={(c) => {
                setEditingCharacter(c)
                goTo('character')
              }}
              onDelete={async (idx) => {
                const next = characters.filter((_, i) => i !== idx)
                setCharacters(next)
                await storage.saveCharacters(next)
              }}
            />
          </div>

          <div className="list-section">
            <h3>Worlds</h3>
            <WorldList
              worlds={worlds}
              onEdit={(w) => {
                setEditingWorld(w)
                goTo('world')
              }}
              onDelete={async (idx) => {
                const next = worlds.filter((_, i) => i !== idx)
                setWorlds(next)
                await storage.saveWorlds(next)
              }}
            />
          </div>

          <div className="list-section">
            <h3>Adventure Templates</h3>
            <TemplateList
              templates={templateAdventures}
              onEdit={(t) => {
                setEditingTemplate(t)
                goTo('adventure')
              }}
              onStart={(t) => handleStartOrUpdateInProgress(t)}
              onDelete={async (idx) => {
                const next = templateAdventures.filter((_, i) => i !== idx)
                setTemplateAdventures(next)
                await storage.saveTemplateAdventures(next)
              }}
            />
          </div>

          <div className="list-section">
            <h3>Adventures In Progress</h3>
            <InProgressList
              adventures={inProgressAdventures}
              onEdit={(a) => {
                setEditingInProgress(a)
                goTo('adventure')
              }}
              onDelete={async (idx) => {
                const next = inProgressAdventures.filter((_, i) => i !== idx)
                setInProgressAdventures(next)
                await storage.saveInProgressAdventures(next)
              }}
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
              onConfirm={async () => {
                await storage.clearAll()
                setCharacters([])
                setWorlds([])
                setTemplateAdventures([])
                setInProgressAdventures([])
                setConfirmClear(false)
              }}
              onCancel={() => setConfirmClear(false)}
            />
          </div>

                </div>
            )}

      {page === 'character' && (
        <CharacterCreator
          onSubmit={handleSubmitCharacter}
          onBack={() => {
            setEditingCharacter(null)
            goTo('landing')
          }}
          initial={editingCharacter ?? undefined}
        />
      )}

      {page === 'world' && (
        <WorldCreator
          onSubmit={handleSubmitWorld}
          onBack={() => {
            setEditingWorld(null)
            goTo('landing')
          }}
          initial={editingWorld ?? undefined}
        />
      )}

      {page === 'adventure' && (
        <AdventureCreator
          characters={characters}
          worlds={worlds}
          onSubmit={handleSubmitTemplate}
          onBack={() => {
            setEditingTemplate(null)
            setEditingInProgress(null)
            goTo('landing')
          }}
          initial={editingTemplate ?? editingInProgress ?? undefined}
        />
      )}
        </div>
    )
}