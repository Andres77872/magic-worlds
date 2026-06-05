/**
 * Data management provider for all application entities
 * Uses API for data persistence instead of localStorage
 */

import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Character, World, Adventure, LoadingState } from '../../shared'
import { apiService } from '../../infrastructure'
import { useAuth } from '../hooks'

interface DataContextValue {
    // Characters
    characters: Character[]
    setCharacters: (characters: Character[]) => void
    editingCharacter: Character | null
    setEditingCharacter: (character: Character | null) => void
    editCharacter: (character: Character) => void
    deleteCharacter: (id: string) => Promise<void>
    
    // Worlds
    worlds: World[]
    setWorlds: (worlds: World[]) => void
    editingWorld: World | null
    setEditingWorld: (world: World | null) => void
    editWorld: (world: World) => void
    deleteWorld: (id: string) => Promise<void>
    
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
    
    // Auth state for graceful degradation
    const { isAuthenticated, openLoginModal } = useAuth()

    // Character actions
    const editCharacter = (character: Character) => {
        setEditingCharacter(character)
    }
    
    const deleteCharacter = async (id: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete characters')
        }
        try {
            await apiService.deleteCharacter(id)
            setCharacters(characters.filter(character => character.id !== id))
        } catch (error) {
            console.error('Failed to delete character:', error)
            throw error
        }
    }
    
    // World actions
    const editWorld = (world: World) => {
        setEditingWorld(world)
    }
    
    const deleteWorld = async (id: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete worlds')
        }
        try {
            await apiService.deleteWorld(id)
            setWorlds(worlds.filter(world => world.id !== id))
        } catch (error) {
            console.error('Failed to delete world:', error)
            throw error
        }
    }
    
    // Template adventure actions
    const editTemplate = (adventure: Adventure) => {
        setEditingTemplate(adventure)
    }
    
    const startTemplate = async (template: Adventure) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to start adventures')
        }
        try {
            // Create a new adventure session via API
            const session = await apiService.createAdventureSession(template.id)
            
            // Create an in-progress adventure object from the session
            const newInProgressAdventure: Adventure = {
                ...template,
                id: String(session.adventure_id),
                status: 'in-progress',
                turns: [],
                createdAt: session.adventure_created_at,
                updatedAt: session.adventure_last_update
            }
            
            // Update state
            const updatedInProgress = [...inProgressAdventures, newInProgressAdventure]
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
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete adventure templates')
        }
        try {
            const templateToDelete = templateAdventures[index]
            if (templateToDelete?.id) {
                await apiService.deleteAdventureTemplate(templateToDelete.id)
            }
            const newTemplates = [...templateAdventures]
            newTemplates.splice(index, 1)
            setTemplateAdventures(newTemplates)
        } catch (error) {
            console.error('Failed to delete template:', error)
            throw error
        }
    }
    
    // In-progress adventure actions
    const editInProgress = (adventure: Adventure) => {
        setEditingInProgress(adventure)
    }
    
    const deleteInProgress = async (index: number) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete adventures')
        }
        try {
            const adventureToDelete = inProgressAdventures[index]
            if (adventureToDelete?.id) {
                await apiService.deleteAdventureSession(Number(adventureToDelete.id))
            }
            const newInProgress = [...inProgressAdventures]
            newInProgress.splice(index, 1)
            setInProgressAdventures(newInProgress)
        } catch (error) {
            console.error('Failed to delete in-progress adventure:', error)
            throw error
        }
    }

    const loadData = async () => {
        try {
            // If not authenticated, skip API calls entirely — render empty state gracefully
            if (!isAuthenticated) {
                console.log('[DataProvider] User not authenticated — skipping data load, rendering empty state')
                setCharacters([])
                setWorlds([])
                setTemplateAdventures([])
                setInProgressAdventures([])
                setLoadingState({ isLoading: false })
                return
            }

            setLoadingState({ isLoading: true })
            console.log('[DataProvider] Starting to load data from API...')
            
            const [
                loadedCharacters,
                loadedWorlds,
                loadedTemplateAdventures,
                loadedSessions
            ] = await Promise.all([
                apiService.getCharacters(),
                apiService.getWorlds(),
                apiService.getAdventureTemplates(),
                apiService.getAdventureSessions()
            ])

            console.log('[DataProvider] Data loaded from API:', {
                characters: loadedCharacters,
                worlds: loadedWorlds,
                templateAdventures: loadedTemplateAdventures,
                sessions: loadedSessions
            })

            // Transform API response to match local types
            const transformedCharacters = (loadedCharacters || []).map((char: any) => ({
                id: char.id || char.uuid,
                name: char.name,
                race: char.race || '',
                description: char.description || '',
                stats: {},
                category: char.category
            }))

            const transformedWorlds = (loadedWorlds || []).map((world: any) => ({
                id: world.id || world.uuid,
                name: world.name,
                type: world.type || '',
                description: world.description || '',
                details: {},
                category: world.category
            }))

            const transformedTemplates = (loadedTemplateAdventures || []).map((template: any) => ({
                id: template.id || template.uuid,
                scenario: template.description || template.name,
                characters: template.characters || [],
                world: template.world?.[0] || undefined,
                objectives: {},
                notes: {},
                category: template.category
            }))

            // Parse the saved {turns} cache safely (the API also rewrites this
            // field with its own projection — fall back to empty turns).
            const parseTurns = (raw?: string) => {
                if (!raw) return []
                try {
                    const parsed = JSON.parse(raw)
                    return Array.isArray(parsed?.turns) ? parsed.turns : []
                } catch {
                    return []
                }
            }

            // Transform sessions to in-progress adventures, enriching scenario /
            // cast / world from the originating template when available.
            const transformedInProgress = (loadedSessions || []).map((session: any) => {
                const template = transformedTemplates.find((t: { id: string }) => t.id === session.adventure_template)
                return {
                    id: String(session.adventure_id),
                    scenario: template?.scenario || `Adventure Session ${session.adventure_id}`,
                    characters: template?.characters ?? [],
                    world: template?.world,
                    turns: parseTurns(session.adventure_last_turn),
                    status: 'in-progress' as const,
                    createdAt: session.adventure_created_at,
                    updatedAt: session.adventure_last_update,
                }
            })

            setCharacters(transformedCharacters)
            setWorlds(transformedWorlds)
            setTemplateAdventures(transformedTemplates)
            setInProgressAdventures(transformedInProgress)
            
            console.log('[DataProvider] State updated successfully')
            setLoadingState({ isLoading: false })
        } catch (error) {
            console.error('[DataProvider] Error loading data from API:', error)
            setLoadingState({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to load data' 
            })
        }
    }

    const clearAllData = async () => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to clear data')
        }
        // Note: Clearing all data via API would require deleting each item individually
        // For now, we just clear the local state - data remains on server
        try {
            setLoadingState({ isLoading: true })
            
            // Delete all items via API
            const deletePromises: Promise<any>[] = []
            
            characters.forEach(char => {
                if (char.id) deletePromises.push(apiService.deleteCharacter(char.id))
            })
            worlds.forEach(world => {
                if (world.id) deletePromises.push(apiService.deleteWorld(world.id))
            })
            templateAdventures.forEach(template => {
                if (template.id) deletePromises.push(apiService.deleteAdventureTemplate(template.id))
            })
            inProgressAdventures.forEach(adventure => {
                if (adventure.id) deletePromises.push(apiService.deleteAdventureSession(Number(adventure.id)))
            })
            
            await Promise.allSettled(deletePromises)

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

    // Load data on mount and whenever auth state changes (login / logout).
    useEffect(() => {
        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated])
    
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

// Export the context for use in hooks
export { DataContext }
