import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Adventure, Character, CharacterChatSession, Lorebook, Story, World } from '@/shared'
import { LandingPage } from './LandingPage'

const setPage = vi.fn()
const editCharacter = vi.fn()
const setEditingCharacter = vi.fn()
const deleteCharacter = vi.fn().mockResolvedValue(undefined)
const editWorld = vi.fn()
const setEditingWorld = vi.fn()
const deleteWorld = vi.fn().mockResolvedValue(undefined)
const editItem = vi.fn()
const setEditingItem = vi.fn()
const deleteItem = vi.fn().mockResolvedValue(undefined)
const editTemplate = vi.fn()
const setEditingTemplate = vi.fn()
const startTemplate = vi.fn().mockResolvedValue(undefined)
const deleteTemplate = vi.fn()
const editInProgress = vi.fn()
const deleteInProgress = vi.fn().mockResolvedValue(undefined)
const startCharacterChat = vi.fn().mockResolvedValue(undefined)
const resumeCharacterChat = vi.fn()
const deleteCharacterChat = vi.fn().mockResolvedValue(undefined)
const openStory = vi.fn().mockResolvedValue(undefined)
const createStory = vi.fn().mockResolvedValue(undefined)
const editLorebook = vi.fn()
const setEditingLorebook = vi.fn()
const deleteLorebook = vi.fn().mockResolvedValue(undefined)
const loadData = vi.fn().mockResolvedValue(undefined)
let authed = true

// GalleryCard reaches usePlaylist through a deep import that bypasses the
// barrel, so it needs its own mock alongside @/app/hooks.
vi.mock('@/app/hooks/usePlaylist', () => ({
    usePlaylist: () => ({
        currentTrack: null,
        isPlaying: false,
        playNow: vi.fn(),
        enqueue: vi.fn(),
        isQueued: () => false,
    }),
}))

// LandingFooter reaches useCookieConsent through a deep import too.
vi.mock('@/app/hooks/useCookieConsent', () => ({
    useCookieConsent: () => ({ reopen: vi.fn() }),
}))

const CHARACTERS: Character[] = [
    { id: 'p1', name: 'Aria', race: 'Human', stats: {}, role: 'persona', is_default_persona: true },
    { id: 'c1', name: 'Lyra', race: 'Half-elf', stats: {}, role: 'character', triggers: ['innkeeper'] },
] as Character[]

const TEMPLATES: Adventure[] = [
    {
        id: 't1',
        scenario: 'The Tavern at the Edge of Sleep',
        characters: [],
        turns: [],
        triggers: ['Mystery'],
    },
    { id: 't2', scenario: 'A Letter Never Sent', characters: [], turns: [], triggers: ['Romance'] },
] as unknown as Adventure[]

const IN_PROGRESS: Adventure[] = [
    {
        id: 'a1',
        scenario: 'The Hollow Wood Vigil',
        characters: [],
        turns: [],
        updatedAt: '2026-06-12 09:00:00',
    },
] as unknown as Adventure[]

const CHATS: CharacterChatSession[] = [
    {
        id: 'chat1',
        character_id: 'c1',
        character: CHARACTERS[1],
        turns: [],
        updatedAt: '2026-06-11 09:00:00',
    },
] as CharacterChatSession[]

const STORIES: Story[] = [
    { id: 's1', title: 'The Long Night', scenes: [], activeCardRefs: [], activeContext: {} },
] as unknown as Story[]

const WORLDS: World[] = [{ id: 'w1', name: 'The Ember Coast', type: 'Region', details: {} }] as unknown as World[]
const LOREBOOKS: Lorebook[] = [
    { id: 'lb1', name: 'The Ember Codex', entries: [], attachments: [], tags: [], enabled: true, settings: {} },
] as unknown as Lorebook[]

let inProgressAdventures = IN_PROGRESS
let characterChats = CHATS
let stories = STORIES

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal: vi.fn() }),
    useNavigation: () => ({ setPage }),
    useData: () => ({
        characters: CHARACTERS,
        worlds: WORLDS,
        items: [],
        templateAdventures: TEMPLATES,
        inProgressAdventures,
        isLoading: false,
        editCharacter,
        setEditingCharacter,
        deleteCharacter,
        editWorld,
        setEditingWorld,
        deleteWorld,
        editItem,
        setEditingItem,
        deleteItem,
        editTemplate,
        setEditingTemplate,
        startTemplate,
        deleteTemplate,
        editInProgress,
        deleteInProgress,
        startCharacterChat,
        characterChats,
        resumeCharacterChat,
        deleteCharacterChat,
        stories,
        openStory,
        createStory,
        lorebooks: LOREBOOKS,
        editLorebook,
        setEditingLorebook,
        deleteLorebook,
        loadData,
        loadingState: { isLoading: false },
    }),
}))

beforeEach(() => {
    authed = true
    inProgressAdventures = IN_PROGRESS
    characterChats = CHATS
    stories = STORIES
    vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
    vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', 'true')
    vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
    vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
    vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'true')
    vi.stubEnv('VITE_FEATURE_GROUP_CHATS_ENABLED', 'true')
})

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
})

describe('LandingPage (returning dashboard)', () => {
    it('renders the section stack in order: carousel, create band, active rails, begin zone, cast, library', () => {
        render(<LandingPage />)

        expect(screen.getByTestId('hero-session-gallery')).toBeTruthy()
        expect(screen.getByTestId('create-band')).toBeTruthy()
        expect(screen.getByTestId('active-adventures')).toBeTruthy()
        expect(screen.getByTestId('active-chats')).toBeTruthy()
        expect(screen.getByTestId('active-novels')).toBeTruthy()
        expect(screen.getByTestId('begin-zone')).toBeTruthy()
        expect(screen.getByTestId('cast-rail')).toBeTruthy()
        expect(screen.getByTestId('worlds-rail')).toBeTruthy()
        expect(screen.getByTestId('lorebook-rail')).toBeTruthy()
        // items collection is empty in this fixture → its rail folds away.
        expect(screen.queryByTestId('items-rail')).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: 'Open chatroom' }))
        expect(setPage).toHaveBeenCalledWith('chatroom')
    })

    it('uses the begin-mode hero when the user has no resumable threads', () => {
        inProgressAdventures = []
        characterChats = []
        stories = []

        render(<LandingPage />)

        expect(screen.queryByTestId('hero-session-gallery')).toBeNull()
        expect(screen.getByTestId('hero-scene')).toBeTruthy()
    })

    it('swaps the sections for grouped results while searching, and restores them on clear', () => {
        render(<LandingPage />)
        const input = screen.getByLabelText('Search your library')

        fireEvent.change(input, { target: { value: 'lyra' } })
        expect(screen.getByTestId('search-results')).toBeTruthy()
        expect(screen.queryByTestId('begin-zone')).toBeNull()
        expect(screen.queryByTestId('create-band')).toBeNull()

        fireEvent.keyDown(input, { key: 'Escape' })
        expect(screen.queryByTestId('search-results')).toBeNull()
        expect(screen.getByTestId('begin-zone')).toBeTruthy()
    })

    it('offers a clear-search empty state when nothing matches', () => {
        render(<LandingPage />)
        fireEvent.change(screen.getByLabelText('Search your library'), { target: { value: 'zzz-no-match' } })

        expect(screen.getByText('Nothing matches "zzz-no-match"')).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
        expect(screen.getByTestId('begin-zone')).toBeTruthy()
    })

    it('starts a fresh character chat from the cast rail', async () => {
        render(<LandingPage />)

        fireEvent.click(within(screen.getByTestId('cast-rail')).getByRole('button', { name: 'Start chat' }))
        const dialog = await screen.findByRole('dialog', { name: 'Choose your persona' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Start chat' }))

        await waitFor(() => expect(startCharacterChat).toHaveBeenCalledWith(CHARACTERS[1], CHARACTERS[0]))
        expect(resumeCharacterChat).not.toHaveBeenCalled()
        expect(setPage).toHaveBeenCalledWith('character-chat')
    })

    it('starts a fresh character chat from search character results', async () => {
        render(<LandingPage />)

        fireEvent.change(screen.getByLabelText('Search your library'), { target: { value: 'lyra' } })
        fireEvent.click(within(screen.getByTestId('search-results')).getByRole('button', { name: 'Start chat' }))
        const dialog = await screen.findByRole('dialog', { name: 'Choose your persona' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Start chat' }))

        await waitFor(() => expect(startCharacterChat).toHaveBeenCalledWith(CHARACTERS[1], CHARACTERS[0]))
        expect(resumeCharacterChat).not.toHaveBeenCalled()
        expect(setPage).toHaveBeenCalledWith('character-chat')
    })

    it('resumes saved chat cards from the continue rail', () => {
        render(<LandingPage />)

        fireEvent.click(within(screen.getByTestId('active-chats')).getByRole('button', { name: 'Resume chat' }))

        expect(resumeCharacterChat).toHaveBeenCalledWith(CHATS[0])
        expect(startCharacterChat).not.toHaveBeenCalled()
        expect(setPage).toHaveBeenCalledWith('character-chat')
    })
})

describe('LandingPage (guest)', () => {
    it('keeps the marketing front door for signed-out visitors', () => {
        authed = false
        render(<LandingPage />)

        expect(screen.getByText('Worlds that talk back.')).toBeTruthy()
        expect(screen.queryByTestId('hero-scene')).toBeNull()
        expect(screen.queryByTestId('active-adventures')).toBeNull()
    })

    it('renders footer policy links and navigates through app state', () => {
        authed = false
        render(<LandingPage />)

        expect(screen.getByText('andres@arz.ai')).toBeTruthy()
        expect(screen.getByText('No illegal or NSFW content')).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: 'Privacy Policy' }))

        expect(setPage).toHaveBeenCalledWith('privacy')
    })
})
