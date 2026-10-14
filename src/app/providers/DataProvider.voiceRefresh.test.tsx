import { useContext } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useData: () => ({}),
    useNavigation: () => ({}),
}))

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
}))

const workspaceMock = vi.hoisted(() => ({
    status: 'ready' as const,
    selectedWorkspaceId: '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b' as string | null,
    workspaceEpoch: 1,
    api: null as unknown,
}))
vi.mock('../hooks/useWorkspace', async () => {
    const { apiService } = await import('@/infrastructure')
    workspaceMock.api = apiService
    return { useWorkspace: () => ({ ...workspaceMock }) }
})

vi.mock('@/infrastructure', () => {
    class ApiError extends Error {
        isTransient = false
    }
    return {
        ApiError,
        apiService: {
            getCharacters: vi.fn().mockResolvedValue([]),
            getWorlds: vi.fn().mockResolvedValue([]),
            getItems: vi.fn().mockResolvedValue([]),
            getAdventureTemplates: vi.fn().mockResolvedValue([]),
            getAdventureSessions: vi.fn().mockResolvedValue([]),
            getCharacterChats: vi.fn().mockResolvedValue([]),
            getLorebooks: vi.fn().mockResolvedValue([]),
            getStories: vi.fn().mockResolvedValue([]),
            updateAdventureSnapshot: vi.fn().mockResolvedValue({}),
            refreshAdventureVoices: vi.fn(),
            refreshChatVoice: vi.fn(),
        },
    }
})

import { apiService } from '@/infrastructure'
import type { ApiService } from '@/infrastructure/api'
import { DataContext, DataProvider } from './DataProvider'

const OLD_VOICE = { voice_id: 'old-voice' }
const NEW_VOICE = { provider: 'elevenlabs', voice_key: 'el:new', model_tier: 'standard' }
const PROJECTION = { voice_key: 'el:new', display_name: 'Ava', provider_route: 'elevenlabs', substitution_reason: null, flags: [], badges: [] }

const snapshotWith = (voice: unknown, extra: Record<string, unknown> = {}) => ({
    schema_version: 2,
    source: 'resolved_library_clone',
    template_card_id: 'tpl-1',
    template: {
        id: 'tpl-1',
        description: 'A quest',
        characters: [{ id: 'c1', name: 'Rook', voice, ...extra }],
    },
})

const SESSION_ROW = { adventure_id: 7, adventure_template: 'tpl-1', template_snapshot: snapshotWith(OLD_VOICE) }
const CHAT_ROW = { chat_id: 9, character_id: 'c1', character: { id: 'c1', name: 'Lyra', voice: OLD_VOICE }, created_at: '2026-06-09T00:00:00' }

/** The session's workspace client: requests ride it, never the unscoped singleton. */
const scopedApi = {
    refreshAdventureVoices: vi.fn(),
    refreshChatVoice: vi.fn(),
}

function Probe() {
    const ctx = useContext(DataContext)
    const adventure = ctx?.inProgressAdventures.find((entry) => entry.id === '7')
    const voice = adventure?.snapshot?.template.characters?.[0]?.voice as { voice_key?: string; voice_id?: string } | undefined
    const chat = ctx?.characterChats.find((entry) => entry.id === '9')
    const chatVoice = chat?.character?.voice as { voice_key?: string; voice_id?: string } | undefined
    return (
        <div>
            <span data-testid="adventure-voice">{voice?.voice_key ?? voice?.voice_id ?? 'none'}</span>
            <span data-testid="chat-voice">{chatVoice?.voice_key ?? chatVoice?.voice_id ?? 'none'}</span>
            <button onClick={() => void ctx?.refreshAdventureVoices('7', ['c1'], scopedApi as unknown as ApiService)}>refresh adventure</button>
            <button onClick={() => void ctx?.refreshCharacterChatVoice('9', scopedApi as unknown as ApiService)}>refresh chat</button>
            <button onClick={() => adventure?.snapshot && void ctx?.saveInProgressSnapshot('7', adventure.snapshot, scopedApi as unknown as ApiService)}>echo</button>
        </div>
    )
}

describe('DataProvider voice refresh (EP-2)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'true')
        vi.mocked(apiService.getAdventureSessions).mockResolvedValue([SESSION_ROW])
        vi.mocked(apiService.getCharacterChats).mockResolvedValue([CHAT_ROW])
        scopedApi.refreshAdventureVoices.mockResolvedValue({ ...SESSION_ROW, template_snapshot: snapshotWith(NEW_VOICE, { effective_voice: PROJECTION }) })
        scopedApi.refreshChatVoice.mockResolvedValue({ ...CHAT_ROW, character: { id: 'c1', name: 'Lyra', voice: NEW_VOICE, effective_voice: PROJECTION } })
        ;(scopedApi as Record<string, unknown>).updateAdventureSnapshot = vi.fn().mockResolvedValue({})
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('targets the speaker card on the session client and stores the returned snapshot', async () => {
        render(<DataProvider><Probe /></DataProvider>)
        await waitFor(() => expect(screen.getByTestId('adventure-voice')).toHaveTextContent('old-voice'))
        fireEvent.click(screen.getByText('refresh adventure'))
        await waitFor(() => expect(screen.getByTestId('adventure-voice')).toHaveTextContent('el:new'))
        expect(scopedApi.refreshAdventureVoices).toHaveBeenCalledWith(7, ['c1'])
        expect(apiService.refreshAdventureVoices).not.toHaveBeenCalled()
    })

    it('never echoes the read-only projections of a refreshed snapshot', async () => {
        render(<DataProvider><Probe /></DataProvider>)
        await waitFor(() => expect(screen.getByTestId('adventure-voice')).toHaveTextContent('old-voice'))
        fireEvent.click(screen.getByText('refresh adventure'))
        await waitFor(() => expect(screen.getByTestId('adventure-voice')).toHaveTextContent('el:new'))
        fireEvent.click(screen.getByText('echo'))
        const update = (scopedApi as unknown as { updateAdventureSnapshot: ReturnType<typeof vi.fn> }).updateAdventureSnapshot
        await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
        const body = JSON.stringify(update.mock.calls[0][1])
        expect(body).toContain('el:new')
        expect(body).not.toContain('effective_voice')
    })

    it('refreshes a 1:1 chat on the session client and stores the normalised chat', async () => {
        render(<DataProvider><Probe /></DataProvider>)
        await waitFor(() => expect(screen.getByTestId('chat-voice')).toHaveTextContent('old-voice'))
        fireEvent.click(screen.getByText('refresh chat'))
        await waitFor(() => expect(screen.getByTestId('chat-voice')).toHaveTextContent('el:new'))
        expect(scopedApi.refreshChatVoice).toHaveBeenCalledWith(9)
        expect(apiService.refreshChatVoice).not.toHaveBeenCalled()
    })

    it('leaves the stored session untouched when the refresh is refused', async () => {
        scopedApi.refreshAdventureVoices.mockRejectedValue(Object.assign(new Error('busy'), { status: 409, code: 'voice_refresh_busy' }))
        const outcomes: Array<Promise<unknown>> = []
        function Runner() {
            const ctx = useContext(DataContext)
            return <button onClick={() => { if (ctx) outcomes.push(ctx.refreshAdventureVoices('7', null, scopedApi as unknown as ApiService)) }}>run</button>
        }
        render(<DataProvider><Probe /><Runner /></DataProvider>)
        await waitFor(() => expect(screen.getByTestId('adventure-voice')).toHaveTextContent('old-voice'))
        fireEvent.click(screen.getByText('run'))
        await expect(outcomes[0]).rejects.toThrow('busy')
        expect(scopedApi.refreshAdventureVoices).toHaveBeenCalledWith(7, null)
        expect(screen.getByTestId('adventure-voice')).toHaveTextContent('old-voice')
    })
})
