import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character, CharacterChatSession } from '@/shared'
import { CallsPage } from './CallsPage'

const setPage = vi.fn()
const openLoginModal = vi.fn()
const resumeCharacterChat = vi.fn()
const startCharacterChat = vi.fn<(character: Character, persona: Character) => Promise<CharacterChatSession>>()
const getRecentVoiceCalls = vi.fn()
const getVoiceCallTranscript = vi.fn()
const loadData = vi.fn()

let authed = true
let characters: Character[] = []
let characterChats: CharacterChatSession[] = []
let libraryState: { isLoading: boolean; error: string | null } = { isLoading: false, error: null }

const PERSONA: Character = { id: 'p1', name: 'Aria', stats: {}, role: 'persona', is_default_persona: true } as Character
const CARD_PERSONA: Character = { id: 'p2', name: 'Sera', stats: {}, role: 'persona' } as Character
const MIRA: Character = { id: 'c1', name: 'Mira', race: 'Elf', stats: {}, role: 'character', voice: { voice_id: 'EN-1' } } as Character
const MIRA_WITH_DEFAULT: Character = { ...MIRA, default_persona_id: 'p2' } as Character

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal }),
    useNavigation: () => ({ setPage }),
    useData: () => ({ characters, characterChats, startCharacterChat, resumeCharacterChat, loadingState: libraryState, loadData }),
}))

// GalleryCard reaches for the playlist (theme-song button); stub the deep import.
vi.mock('@/app/hooks/usePlaylist', () => ({ usePlaylist: () => ({}) }))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getRecentVoiceCalls: (...args: unknown[]) => getRecentVoiceCalls(...args),
        getVoiceCallTranscript: (...args: unknown[]) => getVoiceCallTranscript(...args),
    },
    resolveMediaUrl: (url?: string) => url,
}))

beforeEach(() => {
    vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
    authed = true
    characters = [MIRA, PERSONA]
    characterChats = []
    libraryState = { isLoading: false, error: null }
    getRecentVoiceCalls.mockResolvedValue({ items: [] })
    getVoiceCallTranscript.mockResolvedValue({ call: {}, segments: [] })
    startCharacterChat.mockResolvedValue({ id: 'chat-1', character: MIRA } as CharacterChatSession)
})

afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
})

describe('CallsPage', () => {
    it('distinguishes an unavailable character library from an empty one', async () => {
        characters = []
        libraryState = { isLoading: false, error: 'Unavailable' }
        render(<CallsPage />)
        expect(screen.queryByText('No characters yet')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(loadData).toHaveBeenCalledWith({ silent: true })
        await screen.findByText('No calls yet')
    })

    it('announces the initial character library load', async () => {
        characters = []
        libraryState = { isLoading: true, error: null }
        render(<CallsPage />)
        expect(screen.getByRole('status')).toHaveTextContent('Loading…')
        expect(screen.queryByText('No characters yet')).not.toBeInTheDocument()
        await screen.findByText('No calls yet')
    })
    it('offers recovery after a failed history load instead of showing a false empty state', async () => {
        getRecentVoiceCalls.mockRejectedValueOnce(new Error('Service unavailable'))
        render(<CallsPage />)
        expect(await screen.findByRole('alert')).toHaveTextContent('Some content failed to load.')
        expect(screen.queryByText('No calls yet')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(await screen.findByText('No calls yet')).toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('renders the launch gallery and recent-calls sections', async () => {
        render(<CallsPage />)
        expect(screen.getByTestId('calls-page')).toBeInTheDocument()
        expect(screen.getByText('Call a character')).toBeInTheDocument()
        expect(screen.getByText('Recent calls')).toBeInTheDocument()
        expect(screen.getByText('Mira')).toBeInTheDocument()
        // A character with a configured voice is badged.
        expect(screen.getByText('Voice set')).toBeInTheDocument()
        await waitFor(() => expect(getRecentVoiceCalls).toHaveBeenCalled())
    })

    it('starts a voice call from a character card (default persona present)', async () => {
        render(<CallsPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Call Mira' }))

        await waitFor(() => expect(startCharacterChat).toHaveBeenCalledWith(MIRA, PERSONA))
        await waitFor(() => expect(resumeCharacterChat).toHaveBeenCalledWith({ id: 'chat-1', character: MIRA }, { mode: 'voice' }))
        expect(setPage).toHaveBeenCalledWith('character-chat')
    })

    it('starts a voice call with the character card default persona before the global default', async () => {
        characters = [MIRA_WITH_DEFAULT, PERSONA, CARD_PERSONA]
        render(<CallsPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Call Mira' }))

        await waitFor(() => expect(startCharacterChat).toHaveBeenCalledWith(MIRA_WITH_DEFAULT, CARD_PERSONA))
        await waitFor(() => expect(resumeCharacterChat).toHaveBeenCalledWith({ id: 'chat-1', character: MIRA }, { mode: 'voice' }))
    })

    it('opens a saved call transcript from the recent list', async () => {
        getRecentVoiceCalls.mockResolvedValue({
            items: [{ voice_session_id: 'vs-1', chat_id: 1, character_card_id: 'c1', character_name: 'Mira', duration_seconds: 42, segment_count: 4 }],
        })
        render(<CallsPage />)

        const viewButton = await screen.findByRole('button', { name: 'Transcript' })
        fireEvent.click(viewButton)

        expect(await screen.findByTestId('call-transcript-view')).toBeInTheDocument()
        await waitFor(() => expect(getVoiceCallTranscript).toHaveBeenCalledWith('vs-1'))
    })

    it('calls again inside the same chat when it is still available', async () => {
        const savedChat = { id: '1', kind: 'character', character: MIRA } as CharacterChatSession
        characterChats = [savedChat]
        getRecentVoiceCalls.mockResolvedValue({
            items: [{ voice_session_id: 'vs-1', chat_id: 1, character_card_id: 'c1', character_name: 'Mira', duration_seconds: 42 }],
        })
        render(<CallsPage />)

        fireEvent.click(await screen.findByRole('button', { name: /call again/i }))

        expect(resumeCharacterChat).toHaveBeenCalledWith(savedChat, { mode: 'voice' })
        expect(startCharacterChat).not.toHaveBeenCalled()
        expect(setPage).toHaveBeenCalledWith('character-chat')
    })

    it('starts a new chat to call again when the original chat is gone', async () => {
        getRecentVoiceCalls.mockResolvedValue({
            items: [{ voice_session_id: 'vs-1', chat_id: 99, character_card_id: 'c1', character_name: 'Mira', duration_seconds: 42 }],
        })
        render(<CallsPage />)

        fireEvent.click(await screen.findByRole('button', { name: /call again/i }))

        await waitFor(() => expect(startCharacterChat).toHaveBeenCalledWith(MIRA, PERSONA))
    })

    it('pages through older calls with load more', async () => {
        const page = (start: number, count: number) => Array.from({ length: count }, (_, index) => ({
            voice_session_id: `vs-${start + index}`, chat_id: 1, character_card_id: 'c1', character_name: 'Mira', duration_seconds: 10,
        }))
        getRecentVoiceCalls.mockResolvedValueOnce({ items: page(0, 30) }).mockResolvedValueOnce({ items: page(30, 2) })
        render(<CallsPage />)

        fireEvent.click(await screen.findByRole('button', { name: 'Load more calls' }))

        await waitFor(() => expect(screen.getAllByRole('button', { name: 'Transcript' })).toHaveLength(32))
        expect(getRecentVoiceCalls).toHaveBeenLastCalledWith({ skip: 30, limit: 30 })
        expect(screen.queryByRole('button', { name: 'Load more calls' })).not.toBeInTheDocument()
    })

    it('renders signed-out visitors and gates only starting a call', () => {
        authed = false
        render(<CallsPage />)

        expect(screen.getByTestId('calls-page')).toBeInTheDocument()
        expect(openLoginModal).not.toHaveBeenCalled()
        expect(setPage).not.toHaveBeenCalledWith('landing')
        expect(getRecentVoiceCalls).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Call Mira' }))
        expect(openLoginModal).toHaveBeenCalledTimes(1)
    })
})
