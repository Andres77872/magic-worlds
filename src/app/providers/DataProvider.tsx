/**
 * Data management provider for all application entities
 * Uses API for data persistence instead of localStorage
 */

import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Character, World, Adventure, AdventureSnapshot, LoadingState } from '../../shared'
import { apiService, ApiError } from '../../infrastructure'
import { parseTurnState } from '../../utils/turnState'
import {
    adventureFieldsFromSnapshot,
    asSnapshot,
    synthesizeSnapshotFromTemplate,
} from '../../features/interaction/utils/adventureSnapshot'
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
    /** Persist an edit to an adventure's cloned-card snapshot (its own copy only). */
    saveInProgressSnapshot: (adventureId: string, snapshot: AdventureSnapshot) => Promise<void>
    
    // UI State
    loadingState: LoadingState
    isLoading: boolean
    error: string | null

    // Actions
    loadData: () => Promise<void>
    clearAllData: () => Promise<void>
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

/**
 * Resolve an adventure's cloned-card snapshot: prefer the server snapshot, else
 * synthesize one from the originating template so legacy sessions still display
 * and edit consistently (the first edit persists the synthesized copy).
 */
function resolveAdventureSnapshot(rawSnapshot: unknown, template?: Adventure | null): AdventureSnapshot | undefined {
    const real = asSnapshot(rawSnapshot)
    if (real) return real
    if (!template) return undefined
    return synthesizeSnapshotFromTemplate({
        id: template.id,
        description: template.scenario,
        triggers: template.triggers,
        persona: (template.persona as never) ?? null,
        characters: (template.characters as never) ?? [],
        world: template.world ? [template.world as never] : [],
        category: template.category,
    })
}

/** Raw adventure-session row as returned by the API (only the fields we read). */
interface RawAdventureSession {
    adventure_id: number | string
    adventure_template?: string
    adventure_last_turn?: string | null
    adventure_created_at?: string
    adventure_last_update?: string
    template_snapshot?: unknown
}

/** Build an in-progress Adventure from a session + (optional) originating template. */
function buildInProgressAdventure(session: RawAdventureSession, template: Adventure | undefined, snapshot: AdventureSnapshot | undefined): Adventure {
    const fields = adventureFieldsFromSnapshot(snapshot)
    // With a snapshot, trust its (possibly empty) arrays — a user who cleared the
    // cast must not have the template's cards reappear on reload. Only fall back to
    // the template when there is no snapshot at all (truly legacy / template deleted).
    return {
        id: String(session.adventure_id),
        scenario: (snapshot ? fields.scenario : template?.scenario) ?? `Adventure Session ${session.adventure_id}`,
        persona: snapshot ? fields.persona : template?.persona,
        characters: snapshot ? fields.characters : (template?.characters ?? []),
        world: snapshot ? fields.world : template?.world,
        worlds: snapshot ? fields.worlds : (template?.world ? [template.world] : []),
        snapshot,
        turns: parseTurnState(session.adventure_last_turn),
        status: 'in-progress' as const,
        createdAt: session.adventure_created_at,
        updatedAt: session.adventure_last_update,
    }
}

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
            // Create a new adventure session via API. The backend clones the
            // template's cards into the session snapshot and returns it.
            const session = await apiService.createAdventureSession(template.id)

            // Build the in-progress adventure from the session's own cloned snapshot
            // so edits affect this adventure's copy, never the original template.
            const snapshot = resolveAdventureSnapshot(session.template_snapshot, template)
            const newInProgressAdventure: Adventure = {
                ...template,
                ...buildInProgressAdventure(session, template, snapshot),
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

    const saveInProgressSnapshot = async (adventureId: string, snapshot: AdventureSnapshot) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to edit adventure cards')
        }
        // Persist to this adventure's own snapshot — never the library/template card.
        await apiService.updateAdventureSnapshot(Number(adventureId), snapshot)

        const fields = adventureFieldsFromSnapshot(snapshot)
        const patch = (adv: Adventure): Adventure =>
            adv.id === adventureId
                ? {
                      ...adv,
                      snapshot,
                      scenario: fields.scenario ?? adv.scenario,
                      persona: fields.persona ?? adv.persona,
                      characters: fields.characters,
                      world: fields.world ?? adv.world,
                      worlds: fields.worlds,
                  }
                : adv
        setInProgressAdventures((prev) => prev.map(patch))
        setEditingInProgress((prev) => (prev && prev.id === adventureId ? patch(prev) : prev))
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

            // Transform API response to match local types. List endpoints return
            // arrays, but a non-array can slip through (e.g. a 401 degrades a GET to
            // `{}`); guard so `.map` never throws and we render an empty state.
            const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

            const transformedCharacters = asArray(loadedCharacters).map((char: any) => ({
                id: char.id || char.uuid,
                name: char.name,
                race: char.race || '',
                description: char.description || '',
                stats: {},
                category: char.category,
                triggers: char.triggers ?? []
            }))

            const transformedWorlds = asArray(loadedWorlds).map((world: any) => ({
                id: world.id || world.uuid,
                name: world.name,
                type: world.type || '',
                description: world.description || '',
                details: {},
                category: world.category,
                triggers: world.triggers ?? []
            }))

            const transformedTemplates = asArray(loadedTemplateAdventures).map((template: any) => ({
                id: template.id || template.uuid,
                scenario: template.description || template.name,
                persona: template.persona || undefined,
                characters: template.characters || [],
                world: template.world?.[0] || undefined,
                objectives: {},
                notes: {},
                category: template.category,
                triggers: template.triggers ?? []
            }))

            // Transform sessions to in-progress adventures. Cards come from the
            // session's own cloned snapshot (server-side clone), falling back to the
            // originating template for legacy sessions that predate cloning.
            const transformedInProgress = asArray(loadedSessions).map((session: any) => {
                const template = transformedTemplates.find((t: { id: string }) => t.id === session.adventure_template)
                const snapshot = resolveAdventureSnapshot(session.template_snapshot, template)
                return buildInProgressAdventure(session, template, snapshot)
            })

            setCharacters(transformedCharacters)
            setWorlds(transformedWorlds)
            setTemplateAdventures(transformedTemplates)
            setInProgressAdventures(transformedInProgress)
            
            console.log('[DataProvider] State updated successfully')
            setLoadingState({ isLoading: false })
        } catch (error) {
            // A transient backend outage (5xx, e.g. auth service briefly down →
            // 503) is expected and recovers on its own — log it quietly. The UI
            // stays non-blocking and renders empty states regardless.
            const isTransient = error instanceof ApiError && error.isTransient
            const log = isTransient ? console.warn : console.error
            log('[DataProvider] Error loading data from API:', error)
            setLoadingState({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to load data'
            })
        }
    }

    // Wipe every piece of the user's content in one atomic server call, then
    // reset local caches. The account itself is preserved (see DELETE /user/data).
    const clearAllData = async () => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to clear data')
        }
        setLoadingState({ isLoading: true })
        try {
            await apiService.deleteAllUserData()

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
            throw error // let the caller (confirm dialog) surface the failure
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
        saveInProgressSnapshot,

        loadingState,
        isLoading,
        error,
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
