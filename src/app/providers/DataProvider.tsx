import type { TextGenerationOptions } from '@/shared/types/textGeneration.types'
/**
 * Data management provider for all application entities
 * Uses API for data persistence instead of localStorage
 */

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
import type { ApiService } from '../../infrastructure/api'
import {
    isAdventuresFeatureEnabled,
    isCallsFeatureEnabled,
    isGroupChatsFeatureEnabled,
    isLorebooksFeatureEnabled,
    isNovelsFeatureEnabled,
} from '../../shared/featureFlags'
import { parseApiTimestamp } from '../../utils/time'
import { generateUUID } from '../../utils/uuid'
import { asArray, transformCharacters, transformItems, transformTemplates, transformWorlds } from '../../utils/cardTransforms'
import { normalizeLorebookList } from '../../features/lorebook/lorebookTransforms'
import {
    adventureFieldsFromSnapshot,
    asSnapshot,
    writableAdventureSnapshot,
    libraryCardToSnapshotCard,
} from '../../features/interaction/utils/adventureSnapshot'
import { useAuth } from '../hooks/useAuth'
import { useWorkspace } from '../hooks/useWorkspace'
import { isPageFocused, usePageFocus } from '../hooks/usePageFocus'
import { NavigationContext } from './NavigationProvider'
import { pageFromHash } from '../../features/gallery/galleryLinks'

export type CharacterChatMode = 'text' | 'voice'

type EntryRefreshPage = 'landing' | 'chatroom' | 'active-adventures'
interface DataLoadOptions {
    silent?: boolean
    /** Automatic refresh on entering one of the library-backed pages. */
    entryPage?: EntryRefreshPage
    /** Internal: marks an auth-triggered load so its first page mount can reuse it. */
    automatic?: boolean
}

interface DataContextValue {
    // Characters
    characters: Character[]
    setCharacters: (characters: Character[]) => void
    editingCharacter: Character | null
    setEditingCharacter: (character: Character | null) => void
    editCharacter: (character: Character) => void
    deleteCharacter: (id: string) => Promise<void>
    /** Mark a persona as the default one (clears the previous default). */
    setDefaultPersona: (persona: Character) => Promise<void>

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
    /** Called only for the first submitted interaction, never on navigation. */
    ensureAdventureSession: (adventure: Adventure) => Promise<number>
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
    generateStoryCandidate: (storyId: string, request: StoryGenerateRequest, options?: TextGenerationOptions) => Promise<StoryGeneration>
    acceptStoryGeneration: (storyId: string, generationId: string) => Promise<Story>
    stashStoryGeneration: (storyId: string, generationId: string) => Promise<void>
    discardStoryGeneration: (storyId: string, generationId: string) => Promise<void>

    // 1:1 character chat
    activeCharacterChat: CharacterChatSession | null
    setActiveCharacterChat: (chat: CharacterChatSession | null) => void
    activeCharacterChatMode: CharacterChatMode
    /** Open a local 1:1 draft; caller navigates to 'character-chat'. */
    startCharacterChat: (character: Character, persona: Character) => Promise<CharacterChatSession>
    /** Open a local group draft with 2-6 AI cards; caller navigates to 'character-chat'. */
    startCharacterGroupChat: (characters: Character[], persona: Character) => Promise<CharacterChatSession>
    /** Called only for the first submitted message or accepted voice call. */
    ensureCharacterChatSession: (chat: CharacterChatSession) => Promise<number>
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
    loadData: (opts?: DataLoadOptions) => Promise<void>
    clearAllData: () => Promise<void>
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

/** Resolve the stored cloned-card snapshot returned with a session. */
function resolveAdventureSnapshot(rawSnapshot: unknown): AdventureSnapshot | undefined {
    return asSnapshot(rawSnapshot) ?? undefined
}

/** Raw adventure-session row as returned by the API (only the fields we read). */
interface RawAdventureSession {
    adventure_id: number | string
    adventure_template?: string
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
        // Conversation rows are loaded lazily from the stored `/messages` API.
        turns: [],
        status: 'in-progress' as const,
        createdAt: session.adventure_created_at,
        updatedAt: session.adventure_last_update,
    }
}

const CHARACTER_CHAT_CODEX_KINDS = new Set<CharacterChatCodexCardKind>(['character', 'world', 'item', 'adventure_template'])

function disabledFeatureError(feature: string): Error {
    return new Error(`${feature} feature is disabled.`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

const LIBRARY_PAGE_SIZE = 100

function libraryItemKey(item: unknown, index: number): string {
    if (isRecord(item)) {
        for (const field of ['id', 'card_id', 'character_id', 'world_id', 'item_id', 'adventure_template_id', 'lorebook_id', 'story_id']) {
            const value = item[field]
            if (typeof value === 'string' || typeof value === 'number') return `${field}:${value}`
        }
    }
    try {
        return `value:${JSON.stringify(item)}`
    } catch {
        return `index:${index}`
    }
}

/**
 * Consume an offset-based library defensively. A later-page failure rejects the
 * whole load so callers retain their previous resource state.
 */
async function loadAllLibraryPages(fetchPage: (skip: number, limit: number) => Promise<unknown>): Promise<unknown[]> {
    const items: unknown[] = []
    const seen = new Set<string>()
    let skip = 0
    while (true) {
        const page = asArray(await fetchPage(skip, LIBRARY_PAGE_SIZE))
        if (page.length === 0) break
        let added = 0
        for (const [index, item] of page.entries()) {
            const key = libraryItemKey(item, skip + index)
            if (seen.has(key)) continue
            seen.add(key)
            items.push(item)
            added += 1
        }
        if (page.length < LIBRARY_PAGE_SIZE || added === 0) break
        skip += page.length
    }
    return items
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
        // Conversation rows are loaded by the chat surface from `/messages`.
        turns: [],
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
    // Coalesce concurrent first interactions and reuse a created session on retry.
    const draftRequestsRef = useRef(new Map<string, Promise<number>>())
    const createdDraftsRef = useRef(new Map<string, Adventure>())
    const createdChatDraftsRef = useRef(new Map<string, CharacterChatSession>())

    // UI state
    const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
    // True once any loadData pass has completed — later auth transitions reload
    // silently so the mounted page (and its local editor state) survives.
    const hasLoadedOnceRef = useRef(false)
    // True between an `auth:expired` event and the next authenticated load.
    // Auth state for graceful degradation
    const auth = useAuth()
    const { isAuthenticated, openLoginModal } = auth
    const pageFocused = usePageFocus()
    const navigation = useContext(NavigationContext)
    const currentPage = navigation?.currentPage ?? pageFromHash()
    const currentPageRef = useRef(currentPage)
    useLayoutEffect(() => {
        currentPageRef.current = currentPage
    }, [currentPage])
    const authEpoch = auth.authEpoch ?? Number(isAuthenticated)
    const accountKey = auth.accountKey ?? (isAuthenticated ? 'legacy-authenticated' : 'legacy-signed-out')
    const sessionPhase = auth.sessionPhase ?? (isAuthenticated ? 'authenticated' : 'signed_out')
    // Workspace R1: private lists belong to the committed workspace. Loads wait
    // for the handshake (`ready`), use its scoped client, and are owned by
    // (authEpoch, accountKey, workspaceId, workspaceEpoch).
    const workspace = useWorkspace()
    const workspaceStatus = workspace.status
    const workspaceApi = workspace.api
    const workspaceId = workspace.selectedWorkspaceId
    const workspaceEpoch = workspace.workspaceEpoch
    const authOwnerRef = useRef({ authEpoch, accountKey, sessionPhase, workspaceId, workspaceEpoch, api: workspaceApi })
    authOwnerRef.current = { authEpoch, accountKey, sessionPhase, workspaceId, workspaceEpoch, api: workspaceApi }
    /** The account + workspace the loaded lists belong to (`null` = nothing loaded). */
    const dataOwnerRef = useRef<{ accountKey: string; workspaceId: string } | null>(null)
    /** The scoped client of the committed workspace; private calls never fall back to the unscoped singleton. */
    const requireApi = (): ApiService => {
        const api = authOwnerRef.current.api
        if (!api) throw new Error('Your library is not available yet.')
        return api
    }
    const activeStoryOwnerRef = useRef<string | null>(null)
    const authExpiredEventRef = useRef(false)
    const expiredAccountKeyRef = useRef<string | null>(null)
    const signedOutHandledRef = useRef(false)
    const startedAuthLoadRef = useRef<{ authEpoch: number; accountKey: string; workspaceEpoch: number } | null>(null)
    const bootstrapLoadRef = useRef<{
        authEpoch: number
        accountKey: string
        page: string | null
        promise: Promise<void> | null
        consumed: boolean
    } | null>(null)
    const skipNextEntryRef = useRef<{ authEpoch: number; accountKey: string; page: string | null } | null>(null)

    // A bootstrap skip belongs only to the page that was already selected when
    // the full library load completed. Navigating elsewhere invalidates it.
    useEffect(() => {
        if (skipNextEntryRef.current?.page !== currentPage) skipNextEntryRef.current = null
    }, [currentPage])

    const setOwnedActiveStory: typeof setActiveStory = (next) => {
        setActiveStory((current) => {
            const resolved = typeof next === 'function' ? next(current) : next
            activeStoryOwnerRef.current = resolved && isAuthenticated ? accountKey : null
            return resolved
        })
    }

    useEffect(() => {
        if (activeStory && isAuthenticated) activeStoryOwnerRef.current = accountKey
    }, [accountKey, activeStory, isAuthenticated])

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
            await requireApi().deleteCharacter(id)
            setCharacters(prev => prev.filter(character => character.id !== id))
        } catch (error) {
            console.error('Failed to delete character:', error)
            throw error
        }
    }

    const setDefaultPersona = async (persona: Character) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to set a default persona')
        }
        try {
            const updated = await requireApi().setDefaultPersona(persona.id)
            const [normalized] = transformCharacters([updated])
            setCharacters(prev =>
                prev.map(character => {
                    if (character.id === persona.id) {
                        return normalized ?? { ...character, is_default_persona: true, has_draft: false }
                    }
                    // A user has at most one default persona — clear it everywhere else.
                    return character.is_default_persona ? { ...character, is_default_persona: false } : character
                }),
            )
        } catch (error) {
            console.error('Failed to set default persona:', error)
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
            await requireApi().deleteWorld(id)
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
            await requireApi().deleteItem(id)
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
        if (!isAdventuresFeatureEnabled()) throw disabledFeatureError('Adventures')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to start adventures')
        }
        if (!persona?.id) {
            throw new Error('Choose a persona before starting an adventure')
        }
        const draftId = `draft-${generateUUID()}`
        const adventure: Adventure = {
            ...structuredClone(template),
            id: draftId,
            draftId,
            draft: { templateId: template.id, personaId: persona.id },
            persona: structuredClone(persona),
            turns: [],
            status: 'draft',
            snapshot: {
                ...structuredClone(template.snapshot),
                template_card_id: template.id,
                template: {
                    ...structuredClone(template.snapshot?.template),
                    id: template.id,
                    description: template.scenario,
                    persona: libraryCardToSnapshotCard(persona, 'character'),
                    characters: template.characters.map((card) => libraryCardToSnapshotCard(card, 'character')),
                    world: (template.worlds ?? (template.world ? [template.world] : [])).map((card) => libraryCardToSnapshotCard(card, 'world')),
                    image_url: template.image_url,
                    theme_song_url: template.theme_song_url,
                },
            },
        }
        setEditingInProgress(adventure)
        return adventure
    }

    const ensureAdventureSession = async (selected: Adventure): Promise<number> => {
        if (!isAuthenticated) { openLoginModal(); throw new Error('Login required to start adventures') }
        if (!isAdventuresFeatureEnabled()) throw disabledFeatureError('Adventures')
        if (!selected.draft) return Number(selected.id)
        const draft = editingInProgress?.id === selected.id ? editingInProgress : selected
        const key = `${accountKey}:${workspaceId ?? 'none'}:adventure:${draft.id}`
        const pending = draftRequestsRef.current.get(key)
        if (pending) return pending
        const owner = authOwnerRef.current
        const api = requireApi()
        const request = (async () => {
            let adventure = createdDraftsRef.current.get(key)
            if (!adventure) {
                const session = await api.createAdventureSession(draft.draft!.templateId, draft.draft!.personaId)
                adventure = { ...draft, ...buildInProgressAdventure(session, draft, resolveAdventureSnapshot(session.template_snapshot)), draft: undefined, draftId: draft.draftId }
                createdDraftsRef.current.set(key, adventure)
            }
            if (draft.draft?.snapshotEdited && draft.snapshot) {
                const response = await api.updateAdventureSnapshot(Number(adventure.id), writableAdventureSnapshot(draft.snapshot))
                const snapshot = resolveAdventureSnapshot(response?.template_snapshot) ?? draft.snapshot
                adventure = { ...adventure, ...adventureFieldsFromSnapshot(snapshot), snapshot }
                createdDraftsRef.current.set(key, adventure)
            }
            if (authOwnerRef.current.authEpoch !== owner.authEpoch || authOwnerRef.current.accountKey !== owner.accountKey
                || authOwnerRef.current.workspaceEpoch !== owner.workspaceEpoch) {
                throw new Error('Authentication changed while starting the adventure')
            }
            const saved = adventure
            setInProgressAdventures((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)])
            setEditingInProgress((prev) => prev?.id === draft.id ? saved : prev)
            return Number(saved.id)
        })()
        draftRequestsRef.current.set(key, request)
        try { return await request } catch (error) { draftRequestsRef.current.delete(key); throw error }
    }
    
    const deleteTemplate = async (index: number) => {
        if (!isAdventuresFeatureEnabled()) throw disabledFeatureError('Adventures')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete adventure templates')
        }
        try {
            const templateToDelete = templateAdventures[index]
            if (templateToDelete?.id) {
                await requireApi().deleteAdventureTemplate(templateToDelete.id)
            }
            setTemplateAdventures(prev => prev.filter((_, i) => i !== index))
        } catch (error) {
            console.error('Failed to delete template:', error)
            throw error
        }
    }

    const deleteTemplateById = async (id: string) => {
        if (!isAdventuresFeatureEnabled()) throw disabledFeatureError('Adventures')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete adventure templates')
        }
        try {
            await requireApi().deleteAdventureTemplate(id)
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
        if (!isAdventuresFeatureEnabled()) throw disabledFeatureError('Adventures')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to edit adventure cards')
        }
        if (editingInProgress?.id === adventureId && editingInProgress.draft) {
            const fields = adventureFieldsFromSnapshot(snapshot)
            setEditingInProgress({ ...editingInProgress, ...fields, snapshot,
                draft: { ...editingInProgress.draft, snapshotEdited: true } })
            return
        }
        // Persist to this adventure's own snapshot — never the library/template card.
        const writableSnapshot = writableAdventureSnapshot(snapshot)
        const response = await requireApi().updateAdventureSnapshot(Number(adventureId), writableSnapshot)
        const persistedSnapshot = resolveAdventureSnapshot(response?.template_snapshot) ?? writableSnapshot

        const fields = adventureFieldsFromSnapshot(persistedSnapshot)
        const patch = (adv: Adventure): Adventure =>
            adv.id === adventureId
                ? {
                      ...adv,
                      snapshot: persistedSnapshot,
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
        if (!isLorebooksFeatureEnabled()) throw disabledFeatureError('Lorebooks')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete lorebooks')
        }
        try {
            await requireApi().deleteLorebook(id)
            setLorebooks((prev) => prev.filter((lorebook) => lorebook.id !== id))
            setEditingLorebook((prev) => (prev?.id === id ? null : prev))
        } catch (error) {
            console.error('Failed to delete lorebook:', error)
            throw error
        }
    }

    // A story refetch that was issued before a chapter save completed returns a
    // pre-save body; applying it verbatim would roll the chapter back and a
    // later chapter switch would re-seed the editor from stale text. Chapter
    // updatedAt is server-stamped on every save, so keep whichever copy is
    // fresher (ref lists and generation history always come from the refetch).
    const mergeFreshChapters = (incoming: Story, current: Story | null | undefined): Story => {
        if (!current || current.id !== incoming.id || !current.chapters?.length) return incoming
        const localById = new Map(current.chapters.map((chapter) => [chapter.id, chapter]))
        const chapters = (incoming.chapters ?? []).map((chapter) => {
            const local = localById.get(chapter.id)
            if (!local?.updatedAt || !chapter.updatedAt || local.updatedAt <= chapter.updatedAt) return chapter
            return { ...local, activeCardRefs: chapter.activeCardRefs, generationHistory: chapter.generationHistory }
        })
        return { ...incoming, chapters }
    }

    const upsertStory = (story: Story) => {
        setStories((prev) => {
            const merged = mergeFreshChapters(story, prev.find((item) => item.id === story.id))
            return [merged, ...prev.filter((item) => item.id !== story.id)]
        })
        setActiveStory((prev) => (prev && prev.id === story.id ? mergeFreshChapters(story, prev) : prev))
    }

    const createStory = async (story: StoryCreateRequest): Promise<Story> => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to create stories')
        }
        const created = await requireApi().createStory(story)
        setStories((prev) => [created, ...prev.filter((item) => item.id !== created.id)])
        setActiveStory(created)
        return created
    }

    const openStory = async (story: Story) => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to open stories')
        }
        const loaded = await requireApi().getStory(story.id)
        setActiveStory(loaded)
        setStories((prev) => prev.map((item) => (item.id === loaded.id ? loaded : item)))
    }

    const updateStory = async (storyId: string, patch: Partial<Story> | Record<string, unknown>): Promise<Story> => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to update stories')
        }
        const updated = await requireApi().updateStory(storyId, patch)
        upsertStory(updated)
        return updated
    }

    const deleteStory = async (id: string) => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete stories')
        }
        await requireApi().deleteStory(id)
        setStories((prev) => prev.filter((story) => story.id !== id))
        setActiveStory((prev) => (prev?.id === id ? null : prev))
    }

    const createStoryChapter = async (storyId: string, chapter: Partial<StoryChapter>): Promise<StoryChapter> => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to create story chapters')
        }
        const created = await requireApi().createStoryChapter(storyId, chapter)
        const loaded = await requireApi().getStory(storyId)
        upsertStory(loaded)
        return created
    }

    const updateStoryChapter = async (storyId: string, chapterId: string, patch: Partial<StoryChapter>): Promise<StoryChapter> => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to update story chapters')
        }
        const updated = await requireApi().updateStoryChapter(storyId, chapterId, patch)
        setActiveStory((prev) => {
            if (!prev || prev.id !== storyId) return prev
            const chapters = (prev.chapters ?? []).map((chapter) => (chapter.id === chapterId ? { ...chapter, ...updated } : chapter))
            return { ...prev, chapters }
        })
        setStories((prev) =>
            prev.map((story) => {
                if (story.id !== storyId) return story
                const chapters = (story.chapters ?? []).map((chapter) => (chapter.id === chapterId ? { ...chapter, ...updated } : chapter))
                return { ...story, chapters }
            }),
        )
        return updated
    }

    const deleteStoryChapter = async (storyId: string, chapterId: string) => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete story chapters')
        }
        await requireApi().deleteStoryChapter(storyId, chapterId)
        const loaded = await requireApi().getStory(storyId)
        upsertStory(loaded)
    }

    const addStoryCardRef = async (storyId: string, ref: Partial<StoryCardRef> | Record<string, unknown>): Promise<StoryCardRef> => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to add story cards')
        }
        const created = await requireApi().addStoryCardRef(storyId, ref)
        const loaded = await requireApi().getStory(storyId)
        upsertStory(loaded)
        return created
    }

    // Batch variant for the codex: sequential POSTs keep precedence ordering
    // deterministic, and the story is refetched once at the end.
    const addStoryCardRefs = async (storyId: string, refs: Array<Partial<StoryCardRef> | Record<string, unknown>>): Promise<void> => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to add story cards')
        }
        if (refs.length === 0) return
        // One client for the whole batch: a switch mid-loop must not send the rest elsewhere.
        const api = requireApi()
        try {
            for (const ref of refs) {
                await api.addStoryCardRef(storyId, ref)
            }
        } finally {
            // Refresh even on partial failure so the UI reflects what landed.
            const loaded = await requireApi().getStory(storyId)
            upsertStory(loaded)
        }
    }

    const refreshStory = async (storyId: string): Promise<Story> => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        const loaded = await requireApi().getStory(storyId)
        upsertStory(loaded)
        return loaded
    }

    const updateStoryCardRef = async (storyId: string, refId: string, ref: Partial<StoryCardRef> | Record<string, unknown>): Promise<StoryCardRef> => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to update story cards')
        }
        const updated = await requireApi().updateStoryCardRef(storyId, refId, ref)
        const loaded = await requireApi().getStory(storyId)
        upsertStory(loaded)
        return updated
    }

    const deleteStoryCardRef = async (storyId: string, refId: string) => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to remove story cards')
        }
        await requireApi().deleteStoryCardRef(storyId, refId)
        const loaded = await requireApi().getStory(storyId)
        upsertStory(loaded)
    }

    const generateStoryCandidate = async (storyId: string, request: StoryGenerateRequest, options?: TextGenerationOptions): Promise<StoryGeneration> => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to generate story text')
        }
        const response = await requireApi().generateStory(storyId, request, options)
        return response.generation
    }

    const previewStoryContext = async (storyId: string, request: StoryGenerateRequest): Promise<StoryContextTrace> => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to preview story context')
        }
        return requireApi().previewStoryContext(storyId, request)
    }

    const acceptStoryGeneration = async (storyId: string, generationId: string): Promise<Story> => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to accept story generations')
        }
        const updated = await requireApi().acceptStoryGeneration(storyId, generationId)
        upsertStory(updated)
        return updated
    }

    const stashStoryGeneration = async (storyId: string, generationId: string) => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to stash story generations')
        }
        await requireApi().stashStoryGeneration(storyId, generationId)
    }

    const discardStoryGeneration = async (storyId: string, generationId: string) => {
        if (!isNovelsFeatureEnabled()) throw disabledFeatureError('Novels')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to discard story generations')
        }
        await requireApi().discardStoryGeneration(storyId, generationId)
    }
    
    // Prepare a local chat. Selecting cards must never create a server session.
    // The caller navigates to the 'character-chat' page.
    const startCharacterChat = async (character: Character, persona: Character): Promise<CharacterChatSession> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to chat with characters')
        }
        if (!persona?.id) {
            throw new Error('Choose a persona before starting a chat')
        }
        const draftId = `draft-${generateUUID()}`
        const chat: CharacterChatSession = {
            id: draftId, draftId, isDraft: true, kind: 'character',
            character_id: character.id, character_ids: [character.id], persona_id: persona.id,
            character: structuredClone(character), characters: [structuredClone(character)], persona: structuredClone(persona),
            codexCards: [], turns: [],
        }
        setActiveCharacterChatMode('text')
        setActiveCharacterChat(chat)
        return chat
    }

    const startCharacterGroupChat = async (selectedCharacters: Character[], persona: Character): Promise<CharacterChatSession> => {
        if (!isGroupChatsFeatureEnabled()) throw disabledFeatureError('Group chats')
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
        const draftId = `draft-${generateUUID()}`
        const chat: CharacterChatSession = {
            id: draftId, draftId, isDraft: true, kind: 'character_group',
            character_id: characterIds[0], character_ids: characterIds, persona_id: persona.id,
            character: structuredClone(selectedCharacters[0]), characters: structuredClone(selectedCharacters),
            persona: structuredClone(persona), codexCards: [], turns: [],
        }
        setActiveCharacterChatMode('text')
        setActiveCharacterChat(chat)
        return chat
    }

    const ensureCharacterChatSession = async (chat: CharacterChatSession): Promise<number> => {
        if (!isAuthenticated) { openLoginModal(); throw new Error('Login required to chat with characters') }
        if (chat.kind === 'character_group' && !isGroupChatsFeatureEnabled()) throw disabledFeatureError('Group chats')
        if (!chat.isDraft) return Number(chat.id)
        const draft = activeCharacterChat?.id === chat.id ? activeCharacterChat : chat
        const key = `${accountKey}:${workspaceId ?? 'none'}:chat:${chat.id}`
        const pending = draftRequestsRef.current.get(key)
        if (pending) return pending
        const owner = authOwnerRef.current
        const api = requireApi()
        const request = (async () => {
            let saved = createdChatDraftsRef.current.get(key)
            const remember = (session: unknown) => {
                const value = { ...normalizeCharacterChat(session, characters, draft.characters, draft.persona), draftId: draft.draftId }
                createdChatDraftsRef.current.set(key, value)
                return value
            }
            if (!saved) {
                saved = remember(draft.kind === 'character_group'
                    ? await api.createCharacterGroupChat(draft.character_ids!, draft.persona_id!)
                    : await api.createCharacterChat(draft.character_id!, draft.persona_id!))
            }
            const missing = (draft.codexCards ?? []).filter((card) => !saved!.codexCards?.some((stored) => stored.kind === card.kind && stored.cardId === card.cardId))
            if (missing.length) saved = remember(await api.addCharacterChatCodexCards(Number(saved.id), missing.map(({ kind, cardId }) => ({ kind, cardId }))))
            for (const card of draft.codexCards ?? []) {
                const stored = saved.codexCards?.find((entry) => entry.kind === card.kind && entry.cardId === card.cardId)
                if (stored && stored.enabled !== card.enabled) saved = remember(await api.updateCharacterChatCodexCard(Number(saved.id), stored.id, card.enabled))
            }
            if (authOwnerRef.current.authEpoch !== owner.authEpoch || authOwnerRef.current.accountKey !== owner.accountKey
                || authOwnerRef.current.workspaceEpoch !== owner.workspaceEpoch) {
                throw new Error('Authentication changed while starting the chat')
            }
            const persisted = saved
            setCharacterChats((prev) => [persisted, ...prev.filter((item) => item.id !== persisted.id)])
            setActiveCharacterChat((prev) => prev?.id === chat.id ? persisted : prev)
            return Number(persisted.id)
        })()
        draftRequestsRef.current.set(key, request)
        try { return await request } catch (error) { draftRequestsRef.current.delete(key); throw error }
    }

    // Reopen a chat from the list. No network call needed: the chat view re-hydrates
    // the conversation from the server when its socket opens.
    const resumeCharacterChat = (chat: CharacterChatSession, options: { mode?: CharacterChatMode } = {}) => {
        if (chat.kind === 'character_group' && !isGroupChatsFeatureEnabled()) throw disabledFeatureError('Group chats')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to chat with characters')
        }
        // Voice calls are 1:1 only (the backend 409s group callbots) — a stale
        // voice intent must never mount the CallScreen for a group room.
        setActiveCharacterChatMode(options.mode === 'voice' && chat.kind !== 'character_group' && isCallsFeatureEnabled() ? 'voice' : 'text')
        setActiveCharacterChat(chat)
    }

    const upsertCharacterChat = (chat: CharacterChatSession) => {
        if (!chat.isDraft) setCharacterChats((prev) => [chat, ...prev.filter((existing) => existing.id !== chat.id)])
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
        if (activeCharacterChat?.id === chatId && activeCharacterChat.isDraft) {
            const staged = [...(activeCharacterChat.codexCards ?? [])]
            for (const { kind, cardId } of cards) {
                if (staged.some((card) => card.kind === kind && card.cardId === cardId)) continue
                const library = kind === 'character' ? characters : kind === 'world' ? worlds : kind === 'item' ? items : templateAdventures
                const card = library.find((entry) => entry.id === cardId)
                if (!card) throw new Error('Library card not found')
                staged.push({ id: `draft-${generateUUID()}`, kind, cardId, enabled: true, precedence: staged.length,
                    snapshot: structuredClone(card) as unknown as Record<string, unknown> })
            }
            return upsertCharacterChat({ ...activeCharacterChat, codexCards: staged })
        }
        const updated = await requireApi().addCharacterChatCodexCards(Number(chatId), cards)
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
        if (activeCharacterChat?.id === chatId && activeCharacterChat.isDraft) {
            return upsertCharacterChat({ ...activeCharacterChat,
                codexCards: activeCharacterChat.codexCards?.map((card) => card.id === codexCardId ? { ...card, enabled } : card) })
        }
        const updated = await requireApi().updateCharacterChatCodexCard(Number(chatId), codexCardId, enabled)
        return upsertCharacterChat(normalizeCharacterChat(updated, characters))
    }

    const removeCharacterChatCodexCard = async (chatId: string, codexCardId: string): Promise<CharacterChatSession> => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to edit chat codex')
        }
        if (activeCharacterChat?.id === chatId && activeCharacterChat.isDraft) {
            return upsertCharacterChat({ ...activeCharacterChat,
                codexCards: activeCharacterChat.codexCards?.filter((card) => card.id !== codexCardId) })
        }
        const updated = await requireApi().deleteCharacterChatCodexCard(Number(chatId), codexCardId)
        return upsertCharacterChat(normalizeCharacterChat(updated, characters))
    }

    const deleteCharacterChat = async (id: string) => {
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete chats')
        }
        try {
            await requireApi().deleteCharacterChat(Number(id))
            setCharacterChats((prev) => prev.filter((chat) => chat.id !== id))
            setActiveCharacterChat((prev) => (prev && prev.id === id ? null : prev))
            if (activeCharacterChat?.id === id) setActiveCharacterChatMode('text')
        } catch (error) {
            console.error('Failed to delete character chat:', error)
            throw error
        }
    }

    const deleteInProgress = async (index: number) => {
        if (!isAdventuresFeatureEnabled()) throw disabledFeatureError('Adventures')
        if (!isAuthenticated) {
            openLoginModal()
            throw new Error('Login required to delete adventures')
        }
        try {
            const adventureToDelete = inProgressAdventures[index]
            if (adventureToDelete?.id) {
                await requireApi().deleteAdventureSession(Number(adventureToDelete.id))
            }
            setInProgressAdventures(prev => prev.filter((_, i) => i !== index))
        } catch (error) {
            console.error('Failed to delete in-progress adventure:', error)
            throw error
        }
    }

    /** Drops every private list and editor of the previous account/workspace. */
    const resetPrivateState = () => {
        setCharacters([])
        setWorlds([])
        setItems([])
        setTemplateAdventures([])
        setInProgressAdventures([])
        setLorebooks([])
        setStories([])
        setActiveStory(null)
        activeStoryOwnerRef.current = null
        setCharacterChats([])
        setActiveCharacterChat(null)
        setActiveCharacterChatMode('text')
        setEditingCharacter(null)
        setEditingWorld(null)
        setEditingItem(null)
        setEditingTemplate(null)
        setEditingInProgress(null)
        setEditingLorebook(null)
    }

    // `silent` refreshes the lists in place WITHOUT toggling `loadingState.isLoading`.
    // AppRouter swaps the whole page for <LoadingSpinner/> whenever isLoading is true,
    // so a silent run is what lets the dashboard re-fetch on every visit (picking up
    // media persisted by the creators) without the unmount/flicker/loop.
    const loadData = async (opts?: DataLoadOptions) => {
        const silent = opts?.silent ?? false
        const loadOwner = { authEpoch, accountKey, workspaceEpoch }
        if (opts?.entryPage) {
            if (!isAuthenticated || !isPageFocused() || !hasLoadedOnceRef.current) return
            // A child page effect can run before this provider's auth effect. Its
            // entry load then owns the new auth epoch so the parent does not
            // launch a second full sweep in the same commit.
            const started = startedAuthLoadRef.current
            if (isAuthenticated && workspaceStatus === 'ready' && (started?.authEpoch !== authEpoch
                || started.accountKey !== accountKey || started.workspaceEpoch !== workspaceEpoch)) {
                startedAuthLoadRef.current = { authEpoch, accountKey, workspaceEpoch }
            }
            const pending = bootstrapLoadRef.current
            const skip = skipNextEntryRef.current
            skipNextEntryRef.current = null
            if (pending && pending.authEpoch === authEpoch && pending.accountKey === accountKey) {
                pending.consumed = true
                if (pending.page === opts.entryPage && pending.promise) return pending.promise
            }
            if (skip && skip.authEpoch === authEpoch && skip.accountKey === accountKey
                && skip.page === opts.entryPage && currentPage === opts.entryPage) return
        }
        const ownerIsCurrent = () => authOwnerRef.current.authEpoch === loadOwner.authEpoch
            && authOwnerRef.current.accountKey === loadOwner.accountKey
            && authOwnerRef.current.workspaceEpoch === loadOwner.workspaceEpoch
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
                // On session expiry (not an explicit logout) the login modal lets the
                // user re-authenticate in place — keep the open story mounted so a
                // dirty chapter draft survives and its autosave resumes after re-auth.
                const preserveOwnedStory = (sessionPhase === 'expired' || authExpiredEventRef.current)
                    && activeStoryOwnerRef.current === (expiredAccountKeyRef.current ?? accountKey)
                    && activeStory !== null
                if (preserveOwnedStory) {
                    setStories(activeStory ? [activeStory] : [])
                } else {
                    setStories([])
                    setActiveStory(null)
                    activeStoryOwnerRef.current = null
                }
                setCharacterChats([])
                setActiveCharacterChat(null)
                setActiveCharacterChatMode('text')
                setEditingCharacter(null)
                setEditingWorld(null)
                setEditingItem(null)
                setEditingTemplate(null)
                setEditingInProgress(null)
                setEditingLorebook(null)
                setLoadingState({ isLoading: false })
                hasLoadedOnceRef.current = true
                dataOwnerRef.current = null
                return
            }

            // Workspace R1: no private request before the handshake selected a
            // workspace; never fall back to account-wide reads (document 08).
            const api = authOwnerRef.current.api
            if (workspaceStatus !== 'ready' || !api || !workspaceId) {
                const dataOwner = dataOwnerRef.current
                if (dataOwner && dataOwner.accountKey !== accountKey) resetPrivateState()
                // Unavailable/stale: private pages show their blocking state instead of a
                // spinner, and public/account pages must not wait on it.
                if (workspaceStatus === 'unavailable' || workspaceStatus === 'stale') {
                    setLoadingState((prev) => (prev.isLoading || prev.error) ? { isLoading: false } : prev)
                }
                return
            }
            // Lists of another account/workspace are never shown as this one's.
            const dataOwner = dataOwnerRef.current
            if (dataOwner && (dataOwner.accountKey !== accountKey || dataOwner.workspaceId !== workspaceId)) {
                resetPrivateState()
                dataOwnerRef.current = null
            }

            if (!silent) setLoadingState({ isLoading: true })
            if (import.meta.env.DEV) console.log('[DataProvider] Starting to load data from API...')
            
            // Load each resource independently: a single failing endpoint (a
            // transient 5xx, or one route briefly down) must NOT wipe out or stale
            // the others. With Promise.all, one rejection skipped EVERY setState
            // below — so e.g. freshly generated media (theme/portrait) stayed
            // invisible until a later all-success refresh.
            const [charsRes, worldsRes, itemsRes, templatesRes, sessionsRes, chatsRes, lorebooksRes, storiesRes] = await Promise.allSettled([
                loadAllLibraryPages((skip, limit) => api.getCharacters(skip, limit)),
                loadAllLibraryPages((skip, limit) => api.getWorlds(skip, limit)),
                loadAllLibraryPages((skip, limit) => api.getItems(skip, limit)),
                isAdventuresFeatureEnabled()
                    ? loadAllLibraryPages((skip, limit) => api.getAdventureTemplates(skip, limit))
                    : Promise.resolve([]),
                isAdventuresFeatureEnabled() ? api.getAdventureSessions() : Promise.resolve([]),
                api.getCharacterChats(),
                isLorebooksFeatureEnabled()
                    ? loadAllLibraryPages((skip, limit) => api.getLorebooks(skip, limit))
                    : Promise.resolve([]),
                isNovelsFeatureEnabled()
                    ? loadAllLibraryPages((skip, limit) => api.getStories(skip, limit))
                    : Promise.resolve([]),
            ])
            if (!ownerIsCurrent()) return

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
            // session's own stored cloned snapshot (server-side clone).
            const transformedInProgress = asArray(loadedSessions).map((session: any) => {
                const template = transformedTemplates.find((t: { id: string }) => t.id === session.adventure_template)
                const snapshot = resolveAdventureSnapshot(session.template_snapshot)
                return buildInProgressAdventure(session, template, snapshot)
            })

            // Transform character chats. Prefer live library cards; fall back to
            // frozen snapshots when a source card was deleted.
            const transformedChats: CharacterChatSession[] = asArray(loadedChats)
                .map((chat: any) => normalizeCharacterChat(chat, transformedCharacters))
                .filter((chat) => isGroupChatsFeatureEnabled() || chat.kind !== 'character_group')
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
            // Silent refresh never touches isLoading (would unmount the page), but
            // it does keep `error` truthful so the data-load banner appears during
            // an outage and clears once a background refresh succeeds. The bail-out
            // (returning `prev`) keeps no-change polls render-free.
            const nextError = failures.length ? 'Some content failed to load — try refreshing.' : undefined
            setLoadingState((prev) => {
                if (silent) {
                    return prev.error === nextError ? prev : { ...prev, error: nextError }
                }
                return { isLoading: false, error: nextError }
            })
            if (opts?.automatic && !silent && failures.length === 0) {
                const bootstrap = bootstrapLoadRef.current
                if (bootstrap && !bootstrap.consumed && bootstrap.authEpoch === authEpoch
                    && bootstrap.accountKey === accountKey && currentPageRef.current === bootstrap.page) {
                    skipNextEntryRef.current = {
                        authEpoch,
                        accountKey,
                        page: bootstrap.page,
                    }
                }
            }
            hasLoadedOnceRef.current = true
            dataOwnerRef.current = { accountKey, workspaceId }
            authExpiredEventRef.current = false
            expiredAccountKeyRef.current = null
        } catch (error) {
            if (!ownerIsCurrent()) return
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

    useEffect(() => {
        const markExpired = () => {
            authExpiredEventRef.current = true
            expiredAccountKeyRef.current = accountKey
        }
        window.addEventListener('auth:expired', markExpired)
        return () => window.removeEventListener('auth:expired', markExpired)
    }, [accountKey])

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
    // After the first completed load, auth transitions refresh silently — a
    // non-silent load flips `isLoading`, which unmounts the current page and
    // destroys any in-progress editor state (creator forms, chapter drafts).
    // Restoring a saved login flips isAuthenticated without changing authEpoch:
    // the session coordinator already initialized that ownership from storage.
    useEffect(() => {
        if (!isAuthenticated) {
            if (signedOutHandledRef.current) return
            signedOutHandledRef.current = true
            startedAuthLoadRef.current = null
            bootstrapLoadRef.current = null
            skipNextEntryRef.current = null
            void loadData({ silent: hasLoadedOnceRef.current })
            return
        }
        signedOutHandledRef.current = false
        // Workspace R1: wait for the handshake. A non-ready status only releases
        // the spinner (unavailable/stale) or drops another account's lists.
        if (workspaceStatus !== 'ready' || !workspaceId) {
            void loadData({ silent: true })
            return
        }
        const started = startedAuthLoadRef.current
        if (started?.authEpoch === authEpoch && started.accountKey === accountKey && started.workspaceEpoch === workspaceEpoch) return
        // Keep the initial spinner in place while a background tab waits for focus.
        if (!pageFocused || !isPageFocused()) return
        startedAuthLoadRef.current = { authEpoch, accountKey, workspaceEpoch }
        // A committed workspace switch replaces the lists outright (blocking load);
        // a same-workspace auth transition refreshes silently as before.
        const dataOwner = dataOwnerRef.current
        const switchedWorkspace = dataOwner !== null && (dataOwner.accountKey !== accountKey || dataOwner.workspaceId !== workspaceId)

        // An older session's blocking request can no longer finish after ownership
        // changes. Release its spinner before starting this session's silent load.
        if (hasLoadedOnceRef.current) {
            setLoadingState((prev) => prev.isLoading ? { ...prev, isLoading: false } : prev)
        }
        const bootstrap = {
            authEpoch,
            accountKey,
            page: currentPage,
            promise: null as Promise<void> | null,
            consumed: false,
        }
        bootstrapLoadRef.current = bootstrap
        const promise = loadData({ silent: hasLoadedOnceRef.current && !switchedWorkspace, automatic: true })
        bootstrap.promise = promise
        void promise.finally(() => {
            if (bootstrapLoadRef.current === bootstrap) bootstrapLoadRef.current = null
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountKey, authEpoch, isAuthenticated, pageFocused, workspaceStatus, workspaceId, workspaceEpoch])
    
    // Extract isLoading and error from loadingState
    const { isLoading = false, error = null } = loadingState

    const value: DataContextValue = {
        characters,
        setCharacters,
        editingCharacter,
        setEditingCharacter,
        editCharacter,
        deleteCharacter,
        setDefaultPersona,

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
        ensureAdventureSession,
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
        setActiveStory: setOwnedActiveStory,
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
        ensureCharacterChatSession,
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
