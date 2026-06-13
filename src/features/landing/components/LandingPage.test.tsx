import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Adventure, Character, CharacterChatSession, Story } from '@/shared'
import { LandingPage } from './LandingPage'

const setPage = vi.fn()
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

let inProgressAdventures = IN_PROGRESS
let characterChats = CHATS

const STORIES: Story[] = [
    { id: 's1', title: 'The Long Night', scenes: [], activeCardRefs: [], activeContext: {} },
] as unknown as Story[]

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal: vi.fn() }),
    useNavigation: () => ({ setPage }),
    useData: () => ({
        characters: CHARACTERS,
        worlds: [],
        items: [],
        templateAdventures: TEMPLATES,
        inProgressAdventures,
        isLoading: false,
        editCharacter: vi.fn(),
        setEditingCharacter: vi.fn(),
        deleteCharacter: vi.fn().mockResolvedValue(undefined),
        editWorld: vi.fn(),
        setEditingWorld: vi.fn(),
        deleteWorld: vi.fn().mockResolvedValue(undefined),
        editItem: vi.fn(),
        setEditingItem: vi.fn(),
        deleteItem: vi.fn().mockResolvedValue(undefined),
        editTemplate: vi.fn(),
        setEditingTemplate: vi.fn(),
        startTemplate: vi.fn().mockResolvedValue(undefined),
        deleteTemplate: vi.fn(),
        editInProgress: vi.fn(),
        deleteInProgress: vi.fn().mockResolvedValue(undefined),
        startCharacterChat: vi.fn().mockResolvedValue(undefined),
        characterChats,
        resumeCharacterChat: vi.fn(),
        deleteCharacterChat: vi.fn().mockResolvedValue(undefined),
        stories: STORIES,
        openStory: vi.fn().mockResolvedValue(undefined),
        loadData: vi.fn().mockResolvedValue(undefined),
    }),
}))

beforeEach(() => {
    authed = true
    inProgressAdventures = IN_PROGRESS
    characterChats = CHATS
})

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('LandingPage (returning dashboard)', () => {
    it('renders the zone stack: recent hero gallery, begin zone, cast rail, library, create band', () => {
        render(<LandingPage />)

        expect(screen.getByTestId('hero-session-gallery')).toBeTruthy()
        expect(screen.getByTestId('character-chat-shelf')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Continue the tale' })).toBeTruthy()
        expect(screen.queryByTestId('resume-band')).toBeNull()
        expect(screen.getByTestId('begin-zone')).toBeTruthy()
        expect(screen.getByTestId('cast-rail')).toBeTruthy()
        expect(screen.getByTestId('library-shelf')).toBeTruthy()
        expect(screen.getByTestId('create-band')).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: 'Open chatroom' }))
        expect(setPage).toHaveBeenCalledWith('chatroom')
    })

    it('uses the begin-mode hero when the user has no active sessions', () => {
        inProgressAdventures = []
        characterChats = []

        render(<LandingPage />)

        expect(screen.queryByTestId('hero-session-gallery')).toBeNull()
        expect(screen.getByTestId('hero-scene')).toBeTruthy()
    })

    it('swaps the zones for grouped results while searching, and restores them on clear', () => {
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
})

describe('LandingPage (guest)', () => {
    it('keeps the marketing front door for signed-out visitors', () => {
        authed = false
        render(<LandingPage />)

        expect(screen.getByText('Worlds that talk back.')).toBeTruthy()
        expect(screen.queryByTestId('hero-scene')).toBeNull()
        expect(screen.queryByTestId('library-shelf')).toBeNull()
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
