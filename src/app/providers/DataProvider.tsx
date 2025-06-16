/**
 * Data management provider for all application entities
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Character, World, Adventure, LoadingState } from '../../shared'
import { storage } from '../../infrastructure/storage'

interface DataContextValue {
    // Characters
    characters: Character[]
    setCharacters: (characters: Character[]) => void
    editingCharacter: Character | null
    setEditingCharacter: (character: Character | null) => void
    editCharacter: (character: Character) => void
    deleteCharacter: (index: number) => Promise<void>
    
    // Worlds
    worlds: World[]
    setWorlds: (worlds: World[]) => void
    editingWorld: World | null
    setEditingWorld: (world: World | null) => void
    editWorld: (world: World) => void
    deleteWorld: (index: number) => Promise<void>
    
    // Adventures
    templateAdventures: Adventure[]
    setTemplateAdventures: (adventures: Adventure[]) => void
    inProgressAdventures: Adventure[]
    setInProgressAdventures: (adventures: Adventure[]) => void
    editingTemplate: Adventure | null
    setEditingTemplate: (adventure: Adventure | null) => void
    editingInProgress: Adventure | null
    setEditingInProgress: (adventure: Adventure | null) => void
    editTemplate: (adventure: Adventure) => void
    startTemplate: (template: Adventure) => Promise<void>
    deleteTemplate: (index: number) => Promise<void>
    editInProgress: (adventure: Adventure) => void
    deleteInProgress: (index: number) => Promise<void>
    
    // UI State
    loadingState: LoadingState
    isLoading: boolean
    error: string | null
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
    
    // Character actions
    const editCharacter = (character: Character) => {
        setEditingCharacter(character)
    }
    
    const deleteCharacter = async (index: number) => {
        const newCharacters = [...characters]
        newCharacters.splice(index, 1)
        await storage.saveCharacters(newCharacters)
        setCharacters(newCharacters)
    }
    
    // World actions
    const editWorld = (world: World) => {
        setEditingWorld(world)
    }
    
    const deleteWorld = async (index: number) => {
        const newWorlds = [...worlds]
        newWorlds.splice(index, 1)
        await storage.saveWorlds(newWorlds)
        setWorlds(newWorlds)
    }
    
    // Template adventure actions
    const editTemplate = (adventure: Adventure) => {
        setEditingTemplate(adventure)
    }
    
    const startTemplate = async (template: Adventure) => {
        try {
            // Create a new in-progress adventure based on the template
            const newInProgressAdventure: Adventure = {
                ...template,
                id: crypto.randomUUID(),
                status: 'in_progress',
                turns: template.turns || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
            
            // Add it to the in-progress adventures
            const updatedInProgress = [...inProgressAdventures, newInProgressAdventure]
            
            // Save to localStorage
            await storage.saveInProgressAdventures(updatedInProgress)
            
            // Update state
            setInProgressAdventures(updatedInProgress)
            
            // Set as the current editing adventure
            setEditingInProgress(newInProgressAdventure)
        } catch (error) {
            console.error('Failed to start adventure from template:', error)
            setLoadingState({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to start adventure' 
            })
        }
    }
    
    const deleteTemplate = async (index: number) => {
        const newTemplates = [...templateAdventures]
        newTemplates.splice(index, 1)
        await storage.saveTemplateAdventures(newTemplates)
        setTemplateAdventures(newTemplates)
    }
    
    // In-progress adventure actions
    const editInProgress = (adventure: Adventure) => {
        setEditingInProgress(adventure)
    }
    
    const deleteInProgress = async (index: number) => {
        const newInProgress = [...inProgressAdventures]
        newInProgress.splice(index, 1)
        await storage.saveInProgressAdventures(newInProgress)
        setInProgressAdventures(newInProgress)
    }

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
    
    // Extract isLoading and error from loadingState
    const { isLoading = false, error = null } = loadingState

    const value: DataContextValue = {
        characters,
        setCharacters,
        editingCharacter,
        setEditingCharacter,
        editCharacter,
        deleteCharacter,
        
        worlds,
        setWorlds,
        editingWorld,
        setEditingWorld,
        editWorld,
        deleteWorld,
        
        templateAdventures,
        setTemplateAdventures,
        inProgressAdventures,
        setInProgressAdventures,
        editingTemplate,
        setEditingTemplate,
        editingInProgress,
        setEditingInProgress,
        editTemplate,
        startTemplate,
        deleteTemplate,
        editInProgress,
        deleteInProgress,
        
        loadingState,
        isLoading,
        error,
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
