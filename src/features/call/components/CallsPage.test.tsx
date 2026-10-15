import { act, fireEvent, render as baseRender, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character, CharacterChatSession } from '@/shared'
import { apiService } from '@/infrastructure/api'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import contract from '@/shared/voice/fishAudioContract.fixture.json'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { CallsPage } from './CallsPage'

let workspace: WorkspaceTestState
/** Renders inside the committed workspace; `rerender` re-reads it after `workspace.switchTo`. */
function render(ui: ReactElement) {
    const view = baseRender(<WorkspaceTestProvider state={workspace}>{ui}</WorkspaceTestProvider>)
    return { ...view, rerender: (next: ReactElement) => view.rerender(<WorkspaceTestProvider state={workspace}>{next}</WorkspaceTestProvider>) }
}

const setPage = vi.fn()
const openLoginModal = vi.fn()
const resumeCharacterChat = vi.fn()
const startCharacterChat = vi.fn<(character: Character, persona: Character) => Promise<CharacterChatSession>>()
const getRecentVoiceCalls = vi.fn()
const getVoiceCallTranscript = vi.fn()
const loadData = vi.fn()
const getVoiceCapabilities = vi.fn()

let authed = true
let characters: Character[] = []
let characterChats: CharacterChatSession[] = []
let libraryState: { isLoading: boolean; error: string | null } = { isLoading: false, error: null }

const PERSONA: Character = { id: 'p1', name: 'Aria', stats: {}, role: 'persona', is_default_persona: true } as Character
const CARD_PERSONA: Character = { id: 'p2', name: 'Sera', stats: {}, role: 'persona' } as Character
const MIRA: Character = { id: 'c1', name: 'Mira', race: 'Elf', stats: {}, role: 'character', voice: { schema_version: 2, provider: 'elevenlabs', voice_key: `vk_${'e'.repeat(32)}`, voice_name: 'Mira' } } as Character
const MIRA_WITH_DEFAULT: Character = { ...MIRA, default_persona_id: 'p2' } as Character
const GABRIEL: Character = { id: 'c3', name: 'Gabriel', stats: {}, role: 'character', voice: { schema_version: 3, provider: 'fish_audio', voice_key: `vk_${'f'.repeat(32)}`, voice_name: 'Gabriel', settings: null } } as Character

/** Calls on for the account; Fish advertises its call surface only when `fishCalls`. */
function fishCapabilities(fishCalls: boolean) {
    const fish = contract.capabilities.providers[0]
    const provider = fishCalls
        ? { ...fish, operations: [...fish.operations, 'call'], surfaces: { ...fish.surfaces, call: fish.surfaces.narration } }
        : fish
    return toVoiceCapabilities({
        ...contract.capabilities, consent_version_required: 'voice-v3', providers: [provider],
        status: { calls_available: true, narration_available: true },
    })
}

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
        getVoiceCapabilities: (...args: unknown[]) => getVoiceCapabilities(...args),
    },
    resolveMediaUrl: (url?: string) => url,
}))

beforeEach(() => {
    vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
    // Call history and transcripts are private reads of the committed workspace.
    workspace = createWorkspaceTestState({ api: apiService })
    authed = true
    characters = [MIRA, PERSONA]
    characterChats = []
    libraryState = { isLoading: false, error: null }
    getRecentVoiceCalls.mockResolvedValue({ items: [] })
    getVoiceCallTranscript.mockResolvedValue({ call: {}, segments: [] })
    // Call availability (09 §7): an offline read fails open.
    getVoiceCapabilities.mockRejectedValue(new Error('offline'))
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

    it('disables call buttons with copy while calls_available is false; history stays readable', async () => {
        getVoiceCapabilities.mockResolvedValue(toVoiceCapabilities({ surfaces: { calls: {} }, status: { calls_available: false, narration_available: true } }))
        getRecentVoiceCalls.mockResolvedValue({
            items: [{ voice_session_id: 'vs-1', chat_id: 1, character_card_id: 'c1', character_name: 'Mira', duration_seconds: 42, segment_count: 4 }],
        })
        render(<CallsPage />)

        // The live region is mounted before the switch-off lands, so the copy is announced.
        const region = screen.getByTestId('calls-availability-status')
        expect(region).toHaveAttribute('aria-live', 'polite')
        expect(region).toBeEmptyDOMElement()
        expect(await screen.findByTestId('calls-unavailable')).toHaveTextContent('Voice calls are unavailable right now. Try again later.')
        expect(screen.getByTestId('calls-availability-status')).toBe(region)
        expect(region).toHaveTextContent('Voice calls are unavailable right now. Try again later.')
        const callButton = screen.getByRole('button', { name: 'Call Mira' })
        expect(callButton).toBeDisabled()
        fireEvent.click(callButton)
        expect(startCharacterChat).not.toHaveBeenCalled()
        expect(await screen.findByRole('button', { name: 'Transcript' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /call again/i })).toBeNull()
    })

    it('fails open on a capabilities response without calls_available', async () => {
        getVoiceCapabilities.mockResolvedValue(toVoiceCapabilities({ surfaces: { calls: {} }, status: { narration_available: false } }))
        render(<CallsPage />)

        await waitFor(() => expect(getVoiceCapabilities).toHaveBeenCalled())
        await act(async () => {})
        expect(screen.queryByTestId('calls-unavailable')).toBeNull()
        expect(screen.getByRole('button', { name: 'Call Mira' })).toBeEnabled()
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

    it('badges a V2 (ElevenLabs) voice too, and no badge without a voice (D35)', async () => {
        const sage: Character = {
            id: 'c2', name: 'Sage', race: 'Elf', stats: {}, role: 'character',
            voice: { schema_version: 2, provider: 'elevenlabs', voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f', voice_name: 'Eldrin' },
        }
        characters = [sage, PERSONA]
        const { unmount } = render(<CallsPage />)
        expect(screen.getByText('Sage')).toBeInTheDocument()
        expect(screen.getByText('Voice set')).toBeInTheDocument()
        await waitFor(() => expect(getRecentVoiceCalls).toHaveBeenCalled())
        unmount()

        characters = [{ ...sage, voice: undefined }, PERSONA]
        render(<CallsPage />)
        expect(screen.getByText('Sage')).toBeInTheDocument()
        expect(screen.queryByText('Voice set')).not.toBeInTheDocument()
        await waitFor(() => expect(getRecentVoiceCalls).toHaveBeenCalledTimes(2))
    })

    it('starts a voice call from a character card (default persona present)', async () => {
        render(<CallsPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Call Mira' }))

        await waitFor(() => expect(startCharacterChat).toHaveBeenCalledWith(MIRA, PERSONA))
        await waitFor(() => expect(resumeCharacterChat).toHaveBeenCalledWith({ id: 'chat-1', character: MIRA }, { mode: 'voice' }))
        expect(setPage).toHaveBeenCalledWith('character-chat')
    })

    it('says why a Fish-voiced character cannot be called while Fish calls are off', async () => {
        characters = [GABRIEL, PERSONA]
        getVoiceCapabilities.mockResolvedValue(fishCapabilities(false))
        render(<CallsPage />)
        await waitFor(() => expect(getVoiceCapabilities).toHaveBeenCalled())
        await act(async () => {})

        fireEvent.click(screen.getByRole('button', { name: 'Call Gabriel' }))

        const toast = await screen.findByRole('alert')
        expect(toast).toHaveTextContent('Call not started')
        expect(toast).toHaveTextContent('Fish Audio voices support narration and previews.')
        expect(startCharacterChat).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('starts a Fish-voiced call once the server advertises a healthy Fish call surface', async () => {
        characters = [GABRIEL, PERSONA]
        getVoiceCapabilities.mockResolvedValue(fishCapabilities(true))
        startCharacterChat.mockResolvedValue({ id: 'chat-2', character: GABRIEL } as CharacterChatSession)
        render(<CallsPage />)
        await waitFor(() => expect(getVoiceCapabilities).toHaveBeenCalled())
        await act(async () => {})

        fireEvent.click(screen.getByRole('button', { name: 'Call Gabriel' }))

        await waitFor(() => expect(startCharacterChat).toHaveBeenCalledWith(GABRIEL, PERSONA))
        await waitFor(() => expect(resumeCharacterChat).toHaveBeenCalledWith({ id: 'chat-2', character: GABRIEL }, { mode: 'voice' }))
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows a failed start instead of leaving the click silent', async () => {
        startCharacterChat.mockRejectedValueOnce(new Error('Chat service unavailable.'))
        render(<CallsPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Call Mira' }))

        const toast = await screen.findByRole('alert')
        expect(toast).toHaveTextContent('Call not started')
        expect(toast).toHaveTextContent('Chat service unavailable.')
        expect(resumeCharacterChat).not.toHaveBeenCalled()
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

    it.each([
        ['a capabilities read', () => getVoiceCapabilities.mockResolvedValue(toVoiceCapabilities({ surfaces: { calls: {} }, status: { calls_available: true, narration_available: true } }))],
        ['a failed capabilities read', () => getVoiceCapabilities.mockRejectedValue(new Error('offline'))],
    ] as const)('strips speech markup from saved character lines after %s (R1-FE-05)', async (_name, arrange) => {
        arrange()
        const shown = 'Well met, traveller.'
        getRecentVoiceCalls.mockResolvedValue({
            items: [{ voice_session_id: 'vs-1', chat_id: 1, character_card_id: 'c1', character_name: 'Mira', duration_seconds: 42, segment_count: 1 }],
        })
        getVoiceCallTranscript.mockResolvedValue({ call: {}, segments: [{ segment_id: 's1', seq: 0, role: 'assistant', text: 'Well <#0.5#> met, traveller.' }] })
        render(<CallsPage />)
        await waitFor(() => expect(getVoiceCapabilities).toHaveBeenCalled())

        fireEvent.click(await screen.findByRole('button', { name: 'Transcript' }))

        expect(await screen.findByText(shown)).toBeInTheDocument()
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

    it('closes the open transcript and reloads the history on a workspace switch', async () => {
        getRecentVoiceCalls.mockResolvedValueOnce({
            items: [{ voice_session_id: 'vs-1', chat_id: 1, character_card_id: 'c1', character_name: 'Mira', duration_seconds: 42 }],
        })
        const view = render(<CallsPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'Transcript' }))
        expect(await screen.findByTestId('call-transcript-view')).toBeInTheDocument()

        getRecentVoiceCalls.mockResolvedValueOnce({ items: [] })
        workspace.switchTo(OTHER_WORKSPACE_ID)
        view.rerender(<CallsPage />)

        expect(screen.queryByTestId('call-transcript-view')).not.toBeInTheDocument()
        expect(await screen.findByText('No calls yet')).toBeInTheDocument()
        expect(getRecentVoiceCalls).toHaveBeenCalledTimes(2)
    })

    it('drops a history page that arrives after a switch', async () => {
        let finish!: (value: unknown) => void
        getRecentVoiceCalls.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
        getRecentVoiceCalls.mockResolvedValueOnce({ items: [] })
        const view = render(<CallsPage />)
        await waitFor(() => expect(getRecentVoiceCalls).toHaveBeenCalledTimes(1))

        workspace.switchTo(OTHER_WORKSPACE_ID)
        view.rerender(<CallsPage />)
        finish({ items: [{ voice_session_id: 'vs-old', chat_id: 1, character_card_id: 'c1', character_name: 'Mira', duration_seconds: 5 }] })

        expect(await screen.findByText('No calls yet')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Transcript' })).not.toBeInTheDocument()
    })

    it('never opens a call whose chat finished creating after a workspace switch', async () => {
        let finish!: (chat: CharacterChatSession) => void
        startCharacterChat.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
        const view = render(<CallsPage />)
        fireEvent.click(screen.getByRole('button', { name: 'Call Mira' }))
        await waitFor(() => expect(startCharacterChat).toHaveBeenCalledWith(MIRA, PERSONA))

        workspace.switchTo(OTHER_WORKSPACE_ID)
        view.rerender(<CallsPage />)
        await act(async () => { finish({ id: 'chat-late', character: MIRA } as CharacterChatSession) })

        expect(resumeCharacterChat).not.toHaveBeenCalled()
        expect(setPage).not.toHaveBeenCalledWith('character-chat')
    })
})

describe('CallsPage in an archived workspace (Workspace R1)', () => {
    it('keeps the call history and transcripts readable but starts no new call', async () => {
        workspace = createWorkspaceTestState({
            api: apiService,
            workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library', { archived_at: '2026-10-10T00:00:00Z' })],
        })
        characterChats = [{ id: '1', kind: 'character', character: MIRA } as CharacterChatSession]
        getRecentVoiceCalls.mockResolvedValue({
            items: [{ voice_session_id: 'vs-1', chat_id: 1, character_card_id: 'c1', character_name: 'Mira', duration_seconds: 42, segment_count: 4 }],
        })
        render(<CallsPage />)

        expect(screen.getByRole('button', { name: 'Call Mira' })).toBeDisabled()
        fireEvent.click(await screen.findByRole('button', { name: 'Transcript' }))
        expect(await screen.findByTestId('call-transcript-view')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /call again/i })).not.toBeInTheDocument()
        expect(startCharacterChat).not.toHaveBeenCalled()
        expect(resumeCharacterChat).not.toHaveBeenCalled()
    })
})
