/**
 * Data management provider for all application entities
 * Uses API for data persistence instead of localStorage
 */

import { createContext, useEffect, useState, type ReactNode } from 'react'
import type {
    Character,
    World,
    Item,
    Adventure,
    AdventureSnapshot,
    CharacterChatCodexCard,
    CharacterChatCodexCardKind,
    CharacterChatSession,
    LoadingState,
    Lorebook,
    Story,
    StoryCardRef,
    StoryChapter,
    StoryContextTrace,
    StoryCreateRequest,
    StoryGenerateRequest,
    StoryGeneration,
} from '../../shared'
import { apiService, ApiError } from '../../infrastructure'
import { parseApiTimestamp } from '../../utils/time'
import { parseTurnState } from '../../utils/turnState'
import { asArray, transformCharacters, transformItems, transformTemplates, transformWorlds } from '../../utils/cardTransforms'
import { normalizeLorebookList } from '../../features/lorebook/lorebookTransforms'
import {
    adventureFieldsFromSnapshot,
    asSnapshot,
    synthesizeSnapshotFromTemplate,
} from '../../features/interaction/utils/adventureSnapshot'
import { useAuth } from '../hooks/useAuth'

export type CharacterChatMode = 'text' | 'voice'

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

    // Items / Objects
    items: Item[]
    setItems: (items: Item[]) => void
    editingItem: Item | null
    setEditingItem: (item: Item | null) => void
    editItem: (item: Item) => void
    deleteItem: (id: string) => Promise<void>
    
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
    startTemplate: (template: Adventure, persona: Character) => Promise<Adventure>
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

    // Story Studio
    stories: Story[]
    setStories: (stories: Story[]) => void
    activeStory: Story | null
    setActiveStory: (story: Story | null) => void
    createStory: (story: StoryCreateRequest) => Promise<Story>
    openStory: (story: Story) => Promise<void>
    updateStory: (storyId: string, patch: Partial<Story> | Record<string, unknown>) => Promise<Story>
    deleteStory: (id: string) => Promise<void>
    createStoryChapter: (storyId: string, chapter: Partial<StoryChapter>) => Promise<StoryChapter>
    updateStoryChapter: (storyId: string, chapterId: string, patch: Partial<StoryChapter>) => Promise<StoryChapter>
    deleteStoryChapter: (storyId: string, chapterId: string) => Promise<void>
    addStoryCardRef: (storyId: string, ref: Partial<StoryCardRef> | Record<string, unknown>) => Promise<StoryCardRef>
    addStoryCardRefs: (storyId: string, refs: Array<Partial<StoryCardRef> | Record<string, unknown>>) => Promise<void>
    refreshStory: (storyId: string) => Promise<Story>
    updateStoryCardRef: (storyId: string, refId: string, ref: Partial<StoryCardRef> | Record<string, unknown>) => Promise<StoryCardRef>
    deleteStoryCardRef: (storyId: string, refId: string) => Promise<void>
    previewStoryContext: (storyId: string, request: StoryGenerateRequest) => Promise<StoryContextTrace>
    generateStoryCandidate: (storyId: string, request: StoryGenerateRequest) => Promise<StoryGeneration>
    acceptStoryGeneration: (storyId: string, generationId: string) => Promise<Story>
    stashStoryGeneration: (storyId: string, generationId: string) => Promise<void>
    discardStoryGeneration: (storyId: string, generationId: string) => Promise<void>

    // 1:1 character chat
    activeCharacterChat: CharacterChatSession | null
    setActiveCharacterChat: (chat: CharacterChatSession | null) => void
    activeCharacterChatMode: CharacterChatMode
    /** Start a fresh 1:1 chat with a character; caller navigates to 'character-chat'. */
    startCharacterChat: (character: Character, persona: Character) => Promise<CharacterChatSession>
    /** Start a fresh group chat with 2-6 AI character cards; caller navigates to 'character-chat'. */
    startCharacterGroupChat: (characters: Character[], persona: Character) => Promise<CharacterChatSession>
    /** Past 1:1 chats (the "Recent chats" shelf); loaded alongside the other lists. */
    characterChats: CharacterChatSession[]
    /** Reopen an existing chat from the list; caller navigates to 'character-chat'. */
    resumeCharacterChat: (chat: CharacterChatSession, options?: { mode?: CharacterChatMode }) => void
    addCharacterChatCodexCards: (chatId: string, cards: Array<{ kind: CharacterChatCodexCardKind; cardId: string }>) => Promise<CharacterChatSession>
    toggleCharacterChatCodexCard: (chatId: string, codexCardId: string, enabled: boolean) => Promise<CharacterChatSession>
    removeCharacterChatCodexCard: (chatId: string, codexCardId: string) => Promise<CharacterChatSession>
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
        image_url: template.image_url,
        theme_song_url: template.theme_song_url,
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

const CHARACTER_CHAT_CODEX_KINDS = new Set<CharacterChatCodexCardKind>(['character', 'world', 'item', 'adventure_template'])

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizeCharacterChatCodexCards(raw: unknown): CharacterChatCodexCard[] {
    if (!Array.isArray(raw)) return []
    return raw
        .map((entry, index): CharacterChatCodexCard | null => {
            if (!isRecord(entry)) return null
            const kind = String(entry.kind ?? '') as CharacterChatCodexCardKind
            const snapshot = isRecord(entry.snapshot) ? entry.snapshot : {}
            const cardId = String(entry.card_id ?? entry.cardId ?? snapshot.source_card_id ?? '')
            const id = String(entry.id ?? '')
            if (!id || !cardId || !CHARACTER_CHAT_CODEX_KINDS.has(kind)) return null
            const rawPrecedence = Number(entry.precedence ?? index)
            return {
                id,
                kind,
                cardId,
                enabled: entry.enabled !== false,
                precedence: Number.isFinite(rawPrecedence) ? rawPrecedence : index,
                snapshot,
            }
        })
        .filter((entry): entry is CharacterChatCodexCard => Boolean(entry))
        .sort((a, b) => a.precedence - b.precedence)
}

function normalizeCharacterChat(
    chat: any,
    libraryCharacters: Character[],
    fallbackCharacters: Character[] = [],
    fallbackPersona?: Character,
): CharacterChatSession {
    const rawSnapshotCharacters: unknown[] = Array.isArray(chat.characters)
        ? chat.characters
        : chat.character
          ? [chat.character]
          : []
    const snapshotCharacters = rawSnapshotCharacters.length > 0 ? transformCharacters(rawSnapshotCharacters) : []
    const rawCharacterIds = Array.isArray(chat.character_ids)
        ? chat.character_ids.map((id: unknown) => String(id)).filter(Boolean)
        : []
    const singleCharacterId = String(chat.character_id ?? chat.character_card_id ?? '')
    const characterIds = rawCharacterIds.length > 0 ? rawCharacterIds : singleCharacterId ? [singleCharacterId] : []
    const sessionCharacters = (characterIds.length > 0 ? characterIds : snapshotCharacters.map((character) => character.id))
        .map((id: string, index: number) =>
            libraryCharacters.find((character) => character.id === id)
            ?? fallbackCharacters.find((character) => character.id === id)
            ?? snapshotCharacters.find((character) => character.id === id)
            ?? snapshotCharacters[index],
        )
        .filter((character: Character | undefined): character is Character => Boolean(character))
    const snapshotPersona = chat.persona ? transformCharacters([chat.persona])[0] : undefined
    const personaId = String(chat.persona_id ?? '')
    const livePersona = personaId ? libraryCharacters.find((character) => character.id === personaId) : undefined
    const persona = livePersona ?? fallbackPersona ?? snapshotPersona

    return {
        id: String(chat.chat_id ?? chat.id),
        kind: chat.kind === 'character_group' ? 'character_group' : 'character',
        character_id: characterIds[0],
        character_ids: characterIds,
        title: typeof chat.title === 'string' ? chat.title : undefined,
        character: sessionCharacters[0],
        characters: sessionCharacters.length > 0 ? sessionCharacters : undefined,
        persona_id: personaId || undefined,
        persona,
        codexCards: normalizeCharacterChatCodexCards(chat.codex_cards ?? chat.codexCards),
        turns: parseTurnState(chat.last_turn),
        createdAt: chat.created_at,
        updatedAt: chat.updated_at,
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

    // Items state
    const [items, setItems] = useState<Item[]>([])
    const [editingItem, setEditingItem] = useState<Item | null>(null)
    
    // Adventures state
    const [templateAdventures, setTemplateAdventures] = useState<Adventure[]>([])
    const [inProgressAdventures, setInProgressAdventures] = useState<Adventure[]>([])
    const [editingTemplate, setEditingTemplate] = useState<Adventure | null>(null)
    const [editingInProgress, setEditingInProgress] = useState<Adventure | null>(null)

    // Lorebook state
    const [lorebooks, setLorebooks] = useState<Lorebook[]>([])
    const [editingLorebook, setEditingLorebook] = useState<Lorebook | null>(null)

    // Story Studio state
    const [stories, setStories] = useState<Story[]>([])
    const [activeStory, setActiveStory] = useState<Story | null>(null)

    // 1:1 character chat state
    const [activeCharacterChat, setActiveCharacterChat] = useState<CharacterChatSession | null>(null)
    const [activeCharacterChatMode, setActiveCharacterChatMode] = useState<CharacterChatMode>('text')
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
            setCharacters(prev => prev.filter(character => character.id !== id))
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
            setWorlds(prev => prev.filter(world => world.id !== id))
        } catch (error) {
            console.error('Failed to delete world:', error)
            throw error
        }
    }

    // Item actions
    const editItem = (item: Item) => {
        setEditingItem(item)
    }

    const deleteItem = async (id: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete items')
        }
        try {
            await apiService.deleteItem(id)
            setItems(prev => prev.filter(item => item.id !== id))
        } catch (error) {
            console.error('Failed to delete item:', error)
            throw error
        }
    }
    
    // Template adventure actions
    const editTemplate = (adventure: Adventure) => {
        setEditingTemplate(adventure)
    }
    
    const startTemplate = async (template: Adventure, persona: Character): Promise<Adventure> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to start adventures')
        }
        if (!persona?.id) {
            throw new Error('Choose a persona before starting an adventure')
        }
        try {
            // Create a new adventure session via API. The backend clones the
            // template's cards into the session snapshot and returns it.
            const session = await apiService.createAdventureSession(template.id, persona.id)

            // Build the in-progress adventure from the session's own cloned snapshot
            // so edits affect this adventure's copy, never the original template.
            const snapshot = resolveAdventureSnapshot(session.template_snapshot, template)
            const newInProgressAdventure: Adventure = {
                ...template,
                ...buildInProgressAdventure(session, template, snapshot),
            }
            
            // Update state
            setInProgressAdventures(prev => [...prev, newInProgressAdventure])

            // Set as the current editing adventure
            setEditingInProgress(newInProgressAdventure)
            return newInProgressAdventure
        } catch (error) {
            console.error('Failed to start adventure from template:', error)
            setLoadingState({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to start adventure' 
            })
            throw error
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
            setTemplateAdventures(prev => prev.filter((_, i) => i !== index))
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

    const upsertStory = (story: Story) => {
        setStories((prev) => [story, ...prev.filter((item) => item.id !== story.id)])
        setActiveStory((prev) => (prev && prev.id === story.id ? story : prev))
    }

    const createStory = async (story: StoryCreateRequest): Promise<Story> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to create stories')
        }
        const created = await apiService.createStory(story)
        setStories((prev) => [created, ...prev.filter((item) => item.id !== created.id)])
        setActiveStory(created)
        return created
    }

    const openStory = async (story: Story) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to open stories')
        }
        const loaded = await apiService.getStory(story.id)
        setActiveStory(loaded)
        setStories((prev) => prev.map((item) => (item.id === loaded.id ? loaded : item)))
    }

    const updateStory = async (storyId: string, patch: Partial<Story> | Record<string, unknown>): Promise<Story> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to update stories')
        }
        const updated = await apiService.updateStory(storyId, patch)
        upsertStory(updated)
        return updated
    }

    const deleteStory = async (id: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete stories')
        }
        await apiService.deleteStory(id)
        setStories((prev) => prev.filter((story) => story.id !== id))
        setActiveStory((prev) => (prev?.id === id ? null : prev))
    }

    const createStoryChapter = async (storyId: string, chapter: Partial<StoryChapter>): Promise<StoryChapter> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to create story chapters')
        }
        const created = await apiService.createStoryChapter(storyId, chapter)
        const loaded = await apiService.getStory(storyId)
        upsertStory(loaded)
        return created
    }

    const updateStoryChapter = async (storyId: string, chapterId: string, patch: Partial<StoryChapter>): Promise<StoryChapter> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to update story chapters')
        }
        const updated = await apiService.updateStoryChapter(storyId, chapterId, patch)
        setActiveStory((prev) => {
            if (!prev || prev.id !== storyId) return prev
            const chapters = (prev.chapters ?? prev.scenes).map((chapter) => (chapter.id === chapterId ? { ...chapter, ...updated } : chapter))
            return { ...prev, chapters, scenes: chapters }
        })
        setStories((prev) =>
            prev.map((story) => {
                if (story.id !== storyId) return story
                const chapters = (story.chapters ?? story.scenes).map((chapter) => (chapter.id === chapterId ? { ...chapter, ...updated } : chapter))
                return { ...story, chapters, scenes: chapters }
            }),
        )
        return updated
    }

    const deleteStoryChapter = async (storyId: string, chapterId: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete story chapters')
        }
        await apiService.deleteStoryChapter(storyId, chapterId)
        const loaded = await apiService.getStory(storyId)
        upsertStory(loaded)
    }

    const addStoryCardRef = async (storyId: string, ref: Partial<StoryCardRef> | Record<string, unknown>): Promise<StoryCardRef> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to add story cards')
        }
        const created = await apiService.addStoryCardRef(storyId, ref)
        const loaded = await apiService.getStory(storyId)
        upsertStory(loaded)
        return created
    }

    // Batch variant for the codex: sequential POSTs keep precedence ordering
    // deterministic, and the story is refetched once at the end.
    const addStoryCardRefs = async (storyId: string, refs: Array<Partial<StoryCardRef> | Record<string, unknown>>): Promise<void> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to add story cards')
        }
        if (refs.length === 0) return
        try {
            for (const ref of refs) {
                await apiService.addStoryCardRef(storyId, ref)
            }
        } finally {
            // Refresh even on partial failure so the UI reflects what landed.
            const loaded = await apiService.getStory(storyId)
            upsertStory(loaded)
        }
    }

    const refreshStory = async (storyId: string): Promise<Story> => {
        const loaded = await apiService.getStory(storyId)
        upsertStory(loaded)
        return loaded
    }

    const updateStoryCardRef = async (storyId: string, refId: string, ref: Partial<StoryCardRef> | Record<string, unknown>): Promise<StoryCardRef> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to update story cards')
        }
        const updated = await apiService.updateStoryCardRef(storyId, refId, ref)
        const loaded = await apiService.getStory(storyId)
        upsertStory(loaded)
        return updated
    }

    const deleteStoryCardRef = async (storyId: string, refId: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to remove story cards')
        }
        await apiService.deleteStoryCardRef(storyId, refId)
        const loaded = await apiService.getStory(storyId)
        upsertStory(loaded)
    }

    const generateStoryCandidate = async (storyId: string, request: StoryGenerateRequest): Promise<StoryGeneration> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to generate story text')
        }
        const response = await apiService.generateStory(storyId, request)
        return response.generation
    }

    const previewStoryContext = async (storyId: string, request: StoryGenerateRequest): Promise<StoryContextTrace> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to preview story context')
        }
        return apiService.previewStoryContext(storyId, request)
    }

    const acceptStoryGeneration = async (storyId: string, generationId: string): Promise<Story> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to accept story generations')
        }
        const updated = await apiService.acceptStoryGeneration(storyId, generationId)
        upsertStory(updated)
        return updated
    }

    const stashStoryGeneration = async (storyId: string, generationId: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to stash story generations')
        }
        await apiService.stashStoryGeneration(storyId, generationId)
    }

    const discardStoryGeneration = async (storyId: string, generationId: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to discard story generations')
        }
        await apiService.discardStoryGeneration(storyId, generationId)
    }
    
    // Start a fresh 1:1 character chat seeded with the character's greeting.
    // The caller navigates to the 'character-chat' page.
    const startCharacterChat = async (character: Character, persona: Character): Promise<CharacterChatSession> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to chat with characters')
        }
        if (!persona?.id) {
            throw new Error('Choose a persona before starting a chat')
        }
        try {
            const session = await apiService.createCharacterChat(character.id, persona.id)
            const chat = normalizeCharacterChat(session, characters, [character], persona)
            setActiveCharacterChatMode('text')
            setActiveCharacterChat(chat)
            // Upsert into the "Recent chats" list so a first chat shows up without a reload.
            setCharacterChats((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)])
            return chat
        } catch (error) {
            console.error('Failed to start character chat:', error)
            setLoadingState({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to start character chat',
            })
            throw error
        }
    }

    const startCharacterGroupChat = async (selectedCharacters: Character[], persona: Character): Promise<CharacterChatSession> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to chat with characters')
        }
        if (!persona?.id) {
            throw new Error('Choose a persona before starting a group chat')
        }
        const characterIds = selectedCharacters.map((character) => character.id).filter(Boolean)
        if (characterIds.length < 2 || characterIds.length > 6 || new Set(characterIds).size !== characterIds.length) {
            throw new Error('Choose 2 to 6 different characters for a group chat')
        }
        try {
            const session = await apiService.createCharacterGroupChat(characterIds, persona.id)
            const chat = normalizeCharacterChat(session, characters, selectedCharacters, persona)
            setActiveCharacterChatMode('text')
            setActiveCharacterChat(chat)
            setCharacterChats((prev) => [chat, ...prev.filter((existing) => existing.id !== chat.id)])
            return chat
        } catch (error) {
            console.error('Failed to start character group chat:', error)
            setLoadingState({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to start character group chat',
            })
            throw error
        }
    }

    // Reopen a chat from the list. No network call needed: the chat view re-hydrates
    // the conversation from the server when its socket opens.
    const resumeCharacterChat = (chat: CharacterChatSession, options: { mode?: CharacterChatMode } = {}) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to chat with characters')
        }
        setActiveCharacterChatMode(options.mode ?? 'text')
        setActiveCharacterChat(chat)
    }

    const upsertCharacterChat = (chat: CharacterChatSession) => {
        setCharacterChats((prev) => [chat, ...prev.filter((existing) => existing.id !== chat.id)])
        setActiveCharacterChat((prev) => (prev && prev.id === chat.id ? chat : prev))
        return chat
    }

    const addCharacterChatCodexCards = async (
        chatId: string,
        cards: Array<{ kind: CharacterChatCodexCardKind; cardId: string }>,
    ): Promise<CharacterChatSession> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to edit chat codex')
        }
        if (cards.length === 0) {
            const current = activeCharacterChat && activeCharacterChat.id === chatId
                ? activeCharacterChat
                : characterChats.find((chat) => chat.id === chatId)
            if (!current) throw new Error('Character chat not found')
            return current
        }
        const updated = await apiService.addCharacterChatCodexCards(Number(chatId), cards)
        return upsertCharacterChat(normalizeCharacterChat(updated, characters))
    }

    const toggleCharacterChatCodexCard = async (
        chatId: string,
        codexCardId: string,
        enabled: boolean,
    ): Promise<CharacterChatSession> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to edit chat codex')
        }
        const updated = await apiService.updateCharacterChatCodexCard(Number(chatId), codexCardId, enabled)
        return upsertCharacterChat(normalizeCharacterChat(updated, characters))
    }

    const removeCharacterChatCodexCard = async (chatId: string, codexCardId: string): Promise<CharacterChatSession> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to edit chat codex')
        }
        const updated = await apiService.deleteCharacterChatCodexCard(Number(chatId), codexCardId)
        return upsertCharacterChat(normalizeCharacterChat(updated, characters))
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
            if (activeCharacterChat?.id === id) setActiveCharacterChatMode('text')
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
            setInProgressAdventures(prev => prev.filter((_, i) => i !== index))
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
                if (import.meta.env.DEV) console.log('[DataProvider] User not authenticated — skipping data load, rendering empty state')
                setCharacters([])
                setWorlds([])
                setItems([])
                setTemplateAdventures([])
                setInProgressAdventures([])
                setLorebooks([])
                setStories([])
                setActiveStory(null)
                setCharacterChats([])
                if (!silent) setLoadingState({ isLoading: false })
                return
            }

            if (!silent) setLoadingState({ isLoading: true })
            if (import.meta.env.DEV) console.log('[DataProvider] Starting to load data from API...')
            
            // Load each resource independently: a single failing endpoint (a
            // transient 5xx, or one route briefly down) must NOT wipe out or stale
            // the others. With Promise.all, one rejection skipped EVERY setState
            // below — so e.g. freshly generated media (theme/portrait) stayed
            // invisible until a later all-success refresh.
            const [charsRes, worldsRes, itemsRes, templatesRes, sessionsRes, chatsRes, lorebooksRes, storiesRes] = await Promise.allSettled([
                apiService.getCharacters(),
                apiService.getWorlds(),
                apiService.getItems(),
                apiService.getAdventureTemplates(),
                apiService.getAdventureSessions(),
                apiService.getCharacterChats(),
                apiService.getLorebooks(),
                apiService.getStories(),
            ])

            const loadedCharacters = charsRes.status === 'fulfilled' ? charsRes.value : []
            const loadedWorlds = worldsRes.status === 'fulfilled' ? worldsRes.value : []
            const loadedItems = itemsRes.status === 'fulfilled' ? itemsRes.value : []
            const loadedTemplateAdventures = templatesRes.status === 'fulfilled' ? templatesRes.value : []
            const loadedSessions = sessionsRes.status === 'fulfilled' ? sessionsRes.value : []
            const loadedChats = chatsRes.status === 'fulfilled' ? chatsRes.value : []
            const loadedLorebooks = lorebooksRes.status === 'fulfilled' ? lorebooksRes.value : []
            const loadedStories = storiesRes.status === 'fulfilled' ? storiesRes.value : []

            const failures = [charsRes, worldsRes, itemsRes, templatesRes, sessionsRes, chatsRes, lorebooksRes, storiesRes].filter(
                (r): r is PromiseRejectedResult => r.status === 'rejected'
            )
            for (const f of failures) {
                const isTransient = f.reason instanceof ApiError && f.reason.isTransient
                ;(isTransient ? console.warn : console.error)('[DataProvider] Resource load failed:', f.reason)
            }

            if (import.meta.env.DEV) {
                console.log('[DataProvider] Data loaded from API:', {
                    characters: loadedCharacters,
                    worlds: loadedWorlds,
                    items: loadedItems,
                    templateAdventures: loadedTemplateAdventures,
                    sessions: loadedSessions,
                    lorebooks: loadedLorebooks,
                    stories: loadedStories,
                })
            }

            // Transform API response to match local types (shared with the
            // gallery pages via utils/cardTransforms).
            const transformedCharacters = transformCharacters(loadedCharacters)
            const transformedWorlds = transformWorlds(loadedWorlds)
            const transformedItems = transformItems(loadedItems)
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

            // Transform character chats. Prefer live library cards; fall back to
            // frozen snapshots when a source card was deleted.
            const transformedChats: CharacterChatSession[] = asArray(loadedChats).map((chat: any) =>
                normalizeCharacterChat(chat, transformedCharacters),
            )
            // Most recent first — this list renders as the "Recent chats" shelf.
            const chatStamp = (chat: CharacterChatSession) => {
                const time = parseApiTimestamp(chat.updatedAt ?? chat.createdAt)
                return Number.isNaN(time) ? 0 : time
            }
            transformedChats.sort((a, b) => chatStamp(b) - chatStamp(a))

            // Only overwrite a resource we actually fetched this round — a failed
            // one keeps its previous state instead of blanking.
            if (charsRes.status === 'fulfilled') setCharacters(transformedCharacters)
            if (worldsRes.status === 'fulfilled') setWorlds(transformedWorlds)
            if (itemsRes.status === 'fulfilled') setItems(transformedItems)
            if (templatesRes.status === 'fulfilled') setTemplateAdventures(transformedTemplates)
            if (sessionsRes.status === 'fulfilled') setInProgressAdventures(transformedInProgress)
            if (chatsRes.status === 'fulfilled') setCharacterChats(transformedChats)
            if (lorebooksRes.status === 'fulfilled') setLorebooks(transformedLorebooks)
            if (storiesRes.status === 'fulfilled') setStories(asArray(loadedStories) as Story[])

            if (import.meta.env.DEV) console.log('[DataProvider] State updated successfully')
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
            setItems([])
            setTemplateAdventures([])
            setInProgressAdventures([])
            setLorebooks([])
            setStories([])
            setCharacterChats([])
            setActiveCharacterChat(null)
            setActiveCharacterChatMode('text')
            setActiveStory(null)
            setEditingCharacter(null)
            setEditingWorld(null)
            setEditingItem(null)
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

        items,
        setItems,
        editingItem,
        setEditingItem,
        editItem,
        deleteItem,
        
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

        stories,
        setStories,
        activeStory,
        setActiveStory,
        createStory,
        openStory,
        updateStory,
        deleteStory,
        createStoryChapter,
        updateStoryChapter,
        deleteStoryChapter,
        addStoryCardRef,
        addStoryCardRefs,
        refreshStory,
        updateStoryCardRef,
        deleteStoryCardRef,
        previewStoryContext,
        generateStoryCandidate,
        acceptStoryGeneration,
        stashStoryGeneration,
        discardStoryGeneration,

        activeCharacterChat,
        setActiveCharacterChat,
        activeCharacterChatMode,
        startCharacterChat,
        startCharacterGroupChat,
        characterChats,
        resumeCharacterChat,
        addCharacterChatCodexCards,
        toggleCharacterChatCodexCard,
        removeCharacterChatCodexCard,
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
