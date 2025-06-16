/**
 * Data management provider for all application entities
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Character, World, Adventure, LoadingState } from '../../shared/types'
import { storage } from '../../infrastructure/storage'

interface DataContextValue {
    // Characters
    characters: Character[]
    setCharacters: (characters: Character[]) => void
    editingCharacter: Character | null
    setEditingCharacter: (character: Character | null) => void
    
    // Worlds
    worlds: World[]
    setWorlds: (worlds: World[]) => void
    editingWorld: World | null
    setEditingWorld: (world: World | null) => void
    
    // Adventures
    templateAdventures: Adventure[]
    setTemplateAdventures: (adventures: Adventure[]) => void
    inProgressAdventures: Adventure[]
    setInProgressAdventures: (adventures: Adventure[]) => void
    editingTemplate: Adventure | null
    setEditingTemplate: (adventure: Adventure | null) => void
    editingInProgress: Adventure | null
    setEditingInProgress: (adventure: Adventure | null) => void
    
    // UI State
    loadingState: LoadingState
    confirmClear: boolean
    setConfirmClear: (confirm: boolean) => void
    
    // Actions
    loadData: () => Promise<void>
    clearAllData: () => Promise<void>
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

interface DataProviderProps {
    children: ReactNode
}

export function DataProvider({ children }: DataProviderProps) {
    // Characters state
    const [characters, setCharacters] = useState<Character[]>([])
    const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)
    
    // Worlds state
    const [worlds, setWorlds] = useState<World[]>([])
    const [editingWorld, setEditingWorld] = useState<World | null>(null)
    
    // Adventures state
    const [templateAdventures, setTemplateAdventures] = useState<Adventure[]>([])
    const [inProgressAdventures, setInProgressAdventures] = useState<Adventure[]>([])
    const [editingTemplate, setEditingTemplate] = useState<Adventure | null>(null)
    const [editingInProgress, setEditingInProgress] = useState<Adventure | null>(null)
    
    // UI state
    const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
    const [confirmClear, setConfirmClear] = useState(false)

    const loadData = async () => {
        try {
            setLoadingState({ isLoading: true })
            
            const [
                loadedCharacters,
                loadedWorlds,
                loadedTemplateAdventures,
                loadedInProgressAdventures
            ] = await Promise.all([
                storage.loadCharacters(),
                storage.loadWorlds(),
                storage.loadTemplateAdventures(),
                storage.loadInProgressAdventures()
            ])

            setCharacters(loadedCharacters)
            setWorlds(loadedWorlds)
            setTemplateAdventures(loadedTemplateAdventures)
            setInProgressAdventures(loadedInProgressAdventures)
            
            setLoadingState({ isLoading: false })
        } catch (error) {
            setLoadingState({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to load data' 
            })
        }
    }

    const clearAllData = async () => {
        try {
            setLoadingState({ isLoading: true })
            
            await Promise.all([
                storage.clearCharacters(),
                storage.clearWorlds(),
                storage.clearTemplateAdventures(),
                storage.clearInProgressAdventures()
            ])

            setCharacters([])
            setWorlds([])
            setTemplateAdventures([])
            setInProgressAdventures([])
            setEditingCharacter(null)
            setEditingWorld(null)
            setEditingTemplate(null)
            setEditingInProgress(null)
            
            setLoadingState({ isLoading: false })
        } catch (error) {
            setLoadingState({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to clear data' 
            })
        }
    }

    // Load data on mount
    useEffect(() => {
        loadData()
    }, [])

    const value: DataContextValue = {
        characters,
        setCharacters,
        editingCharacter,
        setEditingCharacter,
        worlds,
        setWorlds,
        editingWorld,
        setEditingWorld,
        templateAdventures,
        setTemplateAdventures,
        inProgressAdventures,
        setInProgressAdventures,
        editingTemplate,
        setEditingTemplate,
        editingInProgress,
        setEditingInProgress,
        loadingState,
        confirmClear,
        setConfirmClear,
        loadData,
        clearAllData
    }

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    )
}

export function useData() {
    const context = useContext(DataContext)
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider')
    }
    return context
}
