/**
 * Data management provider for all application entities
 * Uses API for data persistence instead of localStorage
 */

import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Character, World, Adventure, AdventureSnapshot, CharacterChatSession, LoadingState, Lorebook } from '../../shared'
import { apiService, ApiError } from '../../infrastructure'
import { parseTurnState } from '../../utils/turnState'
import { asArray, transformCharacters, transformTemplates, transformWorlds } from '../../utils/cardTransforms'
import { normalizeLorebookList } from '../../features/lorebook/lorebookTransforms'
import {
    adventureFieldsFromSnapshot,
    asSnapshot,
    synthesizeSnapshotFromTemplate,
} from '../../features/interaction/utils/adventureSnapshot'
import { useAuth } from '../hooks/useAuth'

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
    /** Id-based variant for searched/paginated views that don't index into the provider list. */
    deleteTemplateById: (id: string) => Promise<void>
    editInProgress: (adventure: Adventure) => void
    deleteInProgress: (index: number) => Promise<void>
    /** Persist an edit to an adventure's cloned-card snapshot (its own copy only). */
    saveInProgressSnapshot: (adventureId: string, snapshot: AdventureSnapshot) => Promise<void>

    // Lorebooks
    lorebooks: Lorebook[]
    setLorebooks: (lorebooks: Lorebook[]) => void
    editingLorebook: Lorebook | null
    setEditingLorebook: (lorebook: Lorebook | null) => void
    editLorebook: (lorebook: Lorebook) => void
    deleteLorebook: (id: string) => Promise<void>

    // 1:1 character chat
    activeCharacterChat: CharacterChatSession | null
    setActiveCharacterChat: (chat: CharacterChatSession | null) => void
    /** Start (or resume) a 1:1 chat with a character; caller navigates to 'character-chat'. */
    startCharacterChat: (character: Character) => Promise<void>
    /** Past 1:1 chats (the "Recent chats" shelf); loaded alongside the other lists. */
    characterChats: CharacterChatSession[]
    /** Reopen an existing chat from the list; caller navigates to 'character-chat'. */
    resumeCharacterChat: (chat: CharacterChatSession) => void
    deleteCharacterChat: (id: string) => Promise<void>

    // UI State
    loadingState: LoadingState
    isLoading: boolean
    error: string | null

    // Actions
    /** `silent` refreshes lists in place without flipping the global loading spinner. */
    loadData: (opts?: { silent?: boolean }) => Promise<void>
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
        // Cover image + theme: prefer the session's own snapshot, fall back to the template.
        image_url: snapshot?.template?.image_url ?? template?.image_url,
        theme_song_url: snapshot?.template?.theme_song_url ?? template?.theme_song_url,
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

    // Lorebook state
    const [lorebooks, setLorebooks] = useState<Lorebook[]>([])
    const [editingLorebook, setEditingLorebook] = useState<Lorebook | null>(null)

    // 1:1 character chat state
    const [activeCharacterChat, setActiveCharacterChat] = useState<CharacterChatSession | null>(null)
    const [characterChats, setCharacterChats] = useState<CharacterChatSession[]>([])

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

    const deleteTemplateById = async (id: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete adventure templates')
        }
        try {
            await apiService.deleteAdventureTemplate(id)
            setTemplateAdventures((prev) => prev.filter((template) => template.id !== id))
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

    const editLorebook = (lorebook: Lorebook) => {
        setEditingLorebook(lorebook)
    }

    const deleteLorebook = async (id: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete lorebooks')
        }
        try {
            await apiService.deleteLorebook(id)
            setLorebooks((prev) => prev.filter((lorebook) => lorebook.id !== id))
            setEditingLorebook((prev) => (prev?.id === id ? null : prev))
        } catch (error) {
            console.error('Failed to delete lorebook:', error)
            throw error
        }
    }
    
    // Start (or resume) a 1:1 character chat. The backend is idempotent per
    // (user, character): it returns the existing chat or creates one seeded with the
    // character's greeting. The caller navigates to the 'character-chat' page.
    const startCharacterChat = async (character: Character) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to chat with characters')
        }
        try {
            const session = await apiService.createCharacterChat(character.id)
            const chat: CharacterChatSession = {
                id: String(session.chat_id ?? session.id),
                character_id: String(session.character_id ?? character.id),
                // The live library card drives the sidebar; chat content comes from last_turn.
                character,
                turns: parseTurnState(session.last_turn),
                createdAt: session.created_at,
                updatedAt: session.updated_at,
            }
            setActiveCharacterChat(chat)
            // Upsert into the "Recent chats" list so a first chat shows up without a reload.
            setCharacterChats((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)])
        } catch (error) {
            console.error('Failed to start character chat:', error)
            setLoadingState({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to start character chat',
            })
        }
    }

    // Reopen a chat from the list. No network call needed: the chat view re-hydrates
    // the conversation from the server when its socket opens.
    const resumeCharacterChat = (chat: CharacterChatSession) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to chat with characters')
        }
        setActiveCharacterChat(chat)
    }

    const deleteCharacterChat = async (id: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete chats')
        }
        try {
            await apiService.deleteCharacterChat(Number(id))
            setCharacterChats((prev) => prev.filter((chat) => chat.id !== id))
            setActiveCharacterChat((prev) => (prev && prev.id === id ? null : prev))
        } catch (error) {
            console.error('Failed to delete character chat:', error)
            throw error
        }
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

    // `silent` refreshes the lists in place WITHOUT toggling `loadingState.isLoading`.
    // AppRouter swaps the whole page for <LoadingSpinner/> whenever isLoading is true,
    // so a silent run is what lets the dashboard re-fetch on every visit (picking up
    // media persisted by the creators) without the unmount/flicker/loop.
    const loadData = async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent ?? false
        try {
            // If not authenticated, skip API calls entirely — render empty state gracefully
            if (!isAuthenticated) {
                console.log('[DataProvider] User not authenticated — skipping data load, rendering empty state')
                setCharacters([])
                setWorlds([])
                setTemplateAdventures([])
                setInProgressAdventures([])
                setLorebooks([])
                setCharacterChats([])
                if (!silent) setLoadingState({ isLoading: false })
                return
            }

            if (!silent) setLoadingState({ isLoading: true })
            console.log('[DataProvider] Starting to load data from API...')
            
            // Load each resource independently: a single failing endpoint (a
            // transient 5xx, or one route briefly down) must NOT wipe out or stale
            // the others. With Promise.all, one rejection skipped EVERY setState
            // below — so e.g. freshly generated media (theme/portrait) stayed
            // invisible until a later all-success refresh.
            const [charsRes, worldsRes, templatesRes, sessionsRes, chatsRes, lorebooksRes] = await Promise.allSettled([
                apiService.getCharacters(),
                apiService.getWorlds(),
                apiService.getAdventureTemplates(),
                apiService.getAdventureSessions(),
                apiService.getCharacterChats(),
                apiService.getLorebooks(),
            ])

            const loadedCharacters = charsRes.status === 'fulfilled' ? charsRes.value : []
            const loadedWorlds = worldsRes.status === 'fulfilled' ? worldsRes.value : []
            const loadedTemplateAdventures = templatesRes.status === 'fulfilled' ? templatesRes.value : []
            const loadedSessions = sessionsRes.status === 'fulfilled' ? sessionsRes.value : []
            const loadedChats = chatsRes.status === 'fulfilled' ? chatsRes.value : []
            const loadedLorebooks = lorebooksRes.status === 'fulfilled' ? lorebooksRes.value : []

            const failures = [charsRes, worldsRes, templatesRes, sessionsRes, chatsRes, lorebooksRes].filter(
                (r): r is PromiseRejectedResult => r.status === 'rejected'
            )
            for (const f of failures) {
                const isTransient = f.reason instanceof ApiError && f.reason.isTransient
                ;(isTransient ? console.warn : console.error)('[DataProvider] Resource load failed:', f.reason)
            }

            console.log('[DataProvider] Data loaded from API:', {
                characters: loadedCharacters,
                worlds: loadedWorlds,
                templateAdventures: loadedTemplateAdventures,
                sessions: loadedSessions,
                lorebooks: loadedLorebooks,
            })

            // Transform API response to match local types (shared with the
            // gallery pages via utils/cardTransforms).
            const transformedCharacters = transformCharacters(loadedCharacters)
            const transformedWorlds = transformWorlds(loadedWorlds)
            const transformedTemplates = transformTemplates(loadedTemplateAdventures)
            const transformedLorebooks = normalizeLorebookList(loadedLorebooks)

            // Transform sessions to in-progress adventures. Cards come from the
            // session's own cloned snapshot (server-side clone), falling back to the
            // originating template for legacy sessions that predate cloning.
            const transformedInProgress = asArray(loadedSessions).map((session: any) => {
                const template = transformedTemplates.find((t: { id: string }) => t.id === session.adventure_template)
                const snapshot = resolveAdventureSnapshot(session.template_snapshot, template)
                return buildInProgressAdventure(session, template, snapshot)
            })

            // Transform 1:1 chats. Prefer the live library card (consistent with
            // startCharacterChat — it drives the sidebar); fall back to the chat's
            // frozen snapshot when the source card was deleted.
            const transformedChats: CharacterChatSession[] = asArray(loadedChats).map((chat: any) => {
                const characterId = String(chat.character_id ?? '')
                const liveCard = transformedCharacters.find((c: { id: string }) => c.id === characterId)
                const snapshotCard = chat.character ? transformCharacters([chat.character])[0] : undefined
                return {
                    id: String(chat.chat_id ?? chat.id),
                    character_id: characterId,
                    character: liveCard ?? snapshotCard,
                    turns: parseTurnState(chat.last_turn),
                    createdAt: chat.created_at,
                    updatedAt: chat.updated_at,
                }
            })
            // Most recent first — this list renders as the "Recent chats" shelf.
            const chatStamp = (chat: CharacterChatSession) => {
                const time = Date.parse(chat.updatedAt ?? chat.createdAt ?? '')
                return Number.isNaN(time) ? 0 : time
            }
            transformedChats.sort((a, b) => chatStamp(b) - chatStamp(a))

            // Only overwrite a resource we actually fetched this round — a failed
            // one keeps its previous state instead of blanking.
            if (charsRes.status === 'fulfilled') setCharacters(transformedCharacters)
            if (worldsRes.status === 'fulfilled') setWorlds(transformedWorlds)
            if (templatesRes.status === 'fulfilled') setTemplateAdventures(transformedTemplates)
            if (sessionsRes.status === 'fulfilled') setInProgressAdventures(transformedInProgress)
            if (chatsRes.status === 'fulfilled') setCharacterChats(transformedChats)
            if (lorebooksRes.status === 'fulfilled') setLorebooks(transformedLorebooks)

            console.log('[DataProvider] State updated successfully')
            // Silent refresh never touches isLoading (would unmount the page); the
            // lists were already updated in place above.
            if (!silent) {
                setLoadingState(
                    failures.length
                        ? { isLoading: false, error: 'Some content failed to load — try refreshing.' }
                        : { isLoading: false }
                )
            }
        } catch (error) {
            // A transient backend outage (5xx, e.g. auth service briefly down →
            // 503) is expected and recovers on its own — log it quietly. The UI
            // stays non-blocking and renders empty states regardless.
            const isTransient = error instanceof ApiError && error.isTransient
            const log = isTransient ? console.warn : console.error
            log('[DataProvider] Error loading data from API:', error)
            // A silent refresh keeps the existing view; don't surface a blocking error/spinner.
            if (!silent) {
                setLoadingState({
                    isLoading: false,
                    error: error instanceof Error ? error.message : 'Failed to load data'
                })
            }
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
            setLorebooks([])
            setCharacterChats([])
            setActiveCharacterChat(null)
            setEditingCharacter(null)
            setEditingWorld(null)
            setEditingTemplate(null)
            setEditingInProgress(null)
            setEditingLorebook(null)

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
        deleteTemplateById,
        editInProgress,
        deleteInProgress,
        saveInProgressSnapshot,

        lorebooks,
        setLorebooks,
        editingLorebook,
        setEditingLorebook,
        editLorebook,
        deleteLorebook,

        activeCharacterChat,
        setActiveCharacterChat,
        startCharacterChat,
        characterChats,
        resumeCharacterChat,
        deleteCharacterChat,

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
