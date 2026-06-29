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

let authed = true
let characters: Character[] = []

const PERSONA: Character = { id: 'p1', name: 'Aria', stats: {}, role: 'persona', is_default_persona: true } as Character
const MIRA: Character = { id: 'c1', name: 'Mira', race: 'Elf', stats: {}, role: 'character', voice: { voice_id: 'EN-1' } } as Character

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal }),
    useNavigation: () => ({ setPage }),
    useData: () => ({ characters, startCharacterChat, resumeCharacterChat }),
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
    getRecentVoiceCalls.mockResolvedValue({ items: [] })
    getVoiceCallTranscript.mockResolvedValue({ call: {}, segments: [] })
    startCharacterChat.mockResolvedValue({ id: 'chat-1', character: MIRA } as CharacterChatSession)
})

afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
})

describe('CallsPage', () => {
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

        fireEvent.click(screen.getByRole('button', { name: 'Call' }))

        await waitFor(() => expect(startCharacterChat).toHaveBeenCalledWith(MIRA, PERSONA))
        await waitFor(() => expect(resumeCharacterChat).toHaveBeenCalledWith({ id: 'chat-1', character: MIRA }, { mode: 'voice' }))
        expect(setPage).toHaveBeenCalledWith('character-chat')
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

    it('renders signed-out visitors and gates only starting a call', () => {
        authed = false
        render(<CallsPage />)

        expect(screen.getByTestId('calls-page')).toBeInTheDocument()
        expect(openLoginModal).not.toHaveBeenCalled()
        expect(setPage).not.toHaveBeenCalledWith('landing')
        expect(getRecentVoiceCalls).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Call' }))
        expect(openLoginModal).toHaveBeenCalledTimes(1)
    })
})
