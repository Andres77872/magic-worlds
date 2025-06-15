import {useEffect, useState} from 'react'
import './App.css'
import { Header } from './components/Header'
import type { ThemeOption } from './components/Header'
import { storage } from './services/storage'
import type { Adventure, Character, World } from './types'
import { CharacterCreator } from './components/CharacterCreator'
import { WorldCreator } from './components/WorldCreator'
import { AdventureCreator } from './components/AdventureCreator'
import { AdventureInteraction } from './components/AdventureInteraction'
import { LandingPage } from './components/LandingPage'

export default function App() {
  const [page, setPage] = useState<'landing' | 'character' | 'world' | 'adventure' | 'interaction'>('landing')
const [theme, setTheme] = useState<ThemeOption>(() => {
    const stored = localStorage.getItem('theme')
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  })
  const [characters, setCharacters] = useState<Character[]>([])
  const [worlds, setWorlds] = useState<World[]>([])
  const [templateAdventures, setTemplateAdventures] = useState<Adventure[]>([])
  const [inProgressAdventures, setInProgressAdventures] = useState<Adventure[]>([])

  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)
  const [editingWorld, setEditingWorld] = useState<World | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<Adventure | null>(null)
  const [editingInProgress, setEditingInProgress] = useState<Adventure | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const goTo = (next: 'landing' | 'character' | 'world' | 'adventure' | 'interaction') => setPage(next)

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
  // Load saved data on mount
  useEffect(() => {
    storage.loadCharacters().then(setCharacters)
    storage.loadWorlds().then(setWorlds)
    storage.loadTemplateAdventures().then(setTemplateAdventures)
    storage.loadInProgressAdventures().then(setInProgressAdventures)
  }, [])

  // Watch and apply theme setting (with system fallback)
  useEffect(() => {
    const apply = (mode: ThemeOption) => {
      const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    }
    apply(theme)
    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      const listener = () => apply('system')
      mql.addEventListener('change', listener)
      return () => mql.removeEventListener('change', listener)
    }
  }, [theme])


  return (
    <div className="app-container">
      <Header theme={theme} setTheme={setTheme} goTo={goTo} />
      <main className="app-main">
        {page === 'landing' && (
          <LandingPage
            characters={characters}
            worlds={worlds}
            templateAdventures={templateAdventures}
            inProgressAdventures={inProgressAdventures}
            onCharacterEdit={(c) => {
              setEditingCharacter(c)
              goTo('character')
            }}
            onCharacterDelete={async (idx) => {
              const next = characters.filter((_, i) => i !== idx)
              setCharacters(next)
              await storage.saveCharacters(next)
            }}
            onWorldEdit={(w) => {
              setEditingWorld(w)
              goTo('world')
            }}
            onWorldDelete={async (idx) => {
              const next = worlds.filter((_, i) => i !== idx)
              setWorlds(next)
              await storage.saveWorlds(next)
            }}
            onTemplateEdit={(t) => {
              setEditingTemplate(t)
              goTo('adventure')
            }}
            onTemplateStart={(t) => {
              const instance: Adventure = { ...t, id: crypto.randomUUID() }
              handleStartOrUpdateInProgress(instance)
            }}
            onTemplateDelete={async (idx) => {
              const next = templateAdventures.filter((_, i) => i !== idx)
              setTemplateAdventures(next)
              await storage.saveTemplateAdventures(next)
            }}
            onInProgressEdit={(a) => {
              setEditingInProgress(a)
              goTo('interaction')
            }}
            onInProgressDelete={async (idx) => {
              const next = inProgressAdventures.filter((_, i) => i !== idx)
              setInProgressAdventures(next)
              await storage.saveInProgressAdventures(next)
            }}
            onClearAll={async () => {
              await storage.clearAll()
              setCharacters([])
              setWorlds([])
              setTemplateAdventures([])
              setInProgressAdventures([])
              setConfirmClear(false)
            }}
            onGoTo={goTo}
            confirmClear={confirmClear}
            setConfirmClear={setConfirmClear}
          />
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

        {page === 'interaction' && editingInProgress && (
          <AdventureInteraction
            adventure={editingInProgress}
            onBack={() => goTo('landing')}
          />
        )}
      </main>
    </div>
  )
}