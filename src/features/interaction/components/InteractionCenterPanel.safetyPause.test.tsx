import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TurnEntry, VoiceCapabilities, VoiceSafetyNoticeFrame } from '../../../shared'
import type { ChatSessionConfig } from '../chatSessionConfig'
import { apiService } from '../../../infrastructure/api'
import { createWorkspaceTestState, TEST_WORKSPACE_ID, WorkspaceTestProvider } from '@/shared/hooks/testing/workspaceTestUtils'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_EL_PLUS_BODY, BFF_R0_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import { InteractionCenterPanel } from './InteractionCenterPanel'

/**
 * A pause the server already reports (`safeguards.paused_until`, EP-11) seeds
 * the safety pause: narration controls stay disabled until then, without the
 * pause notice. With the all-off safeguards nothing changes.
 */

vi.mock('../../../infrastructure/api/useAuthenticatedMediaUrl', () => ({
    useAuthenticatedMediaUrl: (url?: string | null) => ({ src: url ?? undefined, loading: false, error: null }),
}))

const mocks = vi.hoisted(() => ({
    useAdventureChatSocket: vi.fn(),
    sendTts: vi.fn(),
}))

vi.mock('../../../app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn(), token: 'token' }),
    useData: () => ({ lorebooks: [], refreshAdventureVoices: vi.fn(), refreshCharacterChatVoice: vi.fn() }),
}))

vi.mock('../hooks/useAdventureChatSocket', () => ({
    useAdventureChatSocket: mocks.useAdventureChatSocket,
}))

vi.mock('@/app/hooks/usePageFocus', () => ({
    usePageFocus: () => true,
    isPageFocused: () => true,
}))

const PLAY = 'Play narration'
const BLOCKED = 'Narration is unavailable right now'

const seed: TurnEntry[] = [
    { id: '100', type: 'user', content: 'Open the door', timestamp: '2026-06-04T00:00:00' },
    { id: '101', type: 'ai', content: 'The door opens.', timestamp: '2026-06-04T00:00:01', assistantMessageId: 101, turnId: 'turn-1' },
]

function makeConfig(api: ChatSessionConfig['api'] = apiService): ChatSessionConfig {
    return {
        kind: 'adventure',
        basePath: 'adventure-sessions',
        workspaceId: TEST_WORKSPACE_ID,
        api,
        loadTurns: vi.fn(async () => []),
        updateMessage: vi.fn(async () => []),
        deleteMessage: vi.fn(async () => []),
        selectReply: vi.fn(async () => []),
        clearMessages: vi.fn(async () => []),
        aiLabel: 'Game Master',
        showForwardOptions: true,
        showImages: true,
        autoNarrateKeyPrefix: 'test:safety:',
        copy: {
            emptyTitle: 'No turns',
            emptyBody: 'Start writing.',
            emptyHint: 'Begin.',
            waitingTitle: 'Waiting',
            waitingHint: 'Generate.',
            placeholder: 'What next?',
            loadingHint: 'Loading.',
            resetConfirm: 'Clear messages?',
        },
    }
}

function renderPanel(config: ChatSessionConfig) {
    function Harness() {
        const [current, setCurrent] = useState<TurnEntry[]>(seed)
        return <InteractionCenterPanel sessionId={7} turns={current} setTurns={setCurrent} config={config} />
    }
    return render(<WorkspaceTestProvider state={createWorkspaceTestState({ api: apiService })}><Harness /></WorkspaceTestProvider>)
}

const caps = (body: unknown) => toVoiceCapabilities(body) as VoiceCapabilities
const elWithPause = (pausedUntil: string | null) => caps({
    ...BFF_EL_PLUS_BODY,
    safeguards: { ...BFF_EL_PLUS_BODY.safeguards, self_harm_pause: true, paused_until: pausedUntil },
})
/**
 * What the BFF actually sends during a pause: `paused_until` comes from the same
 * active restriction that switches narration and calls off (`status`).
 */
const elPausedByServer = (pausedUntil: string) => caps({
    ...BFF_EL_PLUS_BODY,
    status: { ...BFF_EL_PLUS_BODY.status, narration_available: false, calls_available: false },
    safeguards: { ...BFF_EL_PLUS_BODY.safeguards, self_harm_pause: true, paused_until: pausedUntil },
})
const SAFETY_CALLOUT = 'Narration is paused for now.'

/** Lets the capabilities read land and any zero-delay seed expiry run. */
async function settle() {
    for (let i = 0; i < 3; i += 1) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
    }
}

async function expectNarrateEnabled() {
    const play = screen.getByRole('button', { name: PLAY })
    expect(play).not.toBeDisabled()
    expect(screen.queryByRole('button', { name: BLOCKED })).toBeNull()
    fireEvent.click(play)
    await waitFor(() => expect(mocks.sendTts).toHaveBeenCalledWith(101, 'turn-1', expect.any(String)))
}

beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    localStorage.setItem('test:safety:7', '0')
    mocks.sendTts.mockReset()
    mocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat: vi.fn(), sendTts: mocks.sendTts, cancel: vi.fn() })
    vi.spyOn(apiService, 'listLorebookAttachments').mockResolvedValue([])
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

describe('InteractionCenterPanel seeded safety pause (EP-11 paused_until)', () => {
    it('the server’s pause body (narration off plus a future paused_until): disabled, safety copy, no notice', async () => {
        const getCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(elPausedByServer(new Date(Date.now() + 10 * 60_000).toISOString()))
        renderPanel(makeConfig())

        expect(await screen.findByTestId('narration-safety-paused')).toHaveTextContent(SAFETY_CALLOUT)
        expect(getCapabilities).toHaveBeenCalled()
        const blocked = screen.getByRole('button', { name: BLOCKED })
        expect(blocked).toBeDisabled()
        expect(screen.queryByRole('button', { name: PLAY })).toBeNull()
        expect(screen.queryByRole('dialog')).toBeNull()
        // The generic account-level switch-off copy gives way to the pause's own.
        expect(screen.queryByTestId('narration-unavailable')).toBeNull()
        fireEvent.click(blocked)
        expect(mocks.sendTts).not.toHaveBeenCalled()
    })

    it('narration comes back when the seeded pause ends: availability is read again', async () => {
        const until = Date.now() + 400
        // The server lifts the pause at its end (a little early here, so the re-read never races it).
        const getCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities').mockImplementation(async () => (
            Date.now() < until - 100 ? elPausedByServer(new Date(until).toISOString()) : caps(BFF_EL_PLUS_BODY)
        ))
        renderPanel(makeConfig())

        expect(await screen.findByRole('button', { name: BLOCKED })).toBeDisabled()
        const play = await screen.findByRole('button', { name: PLAY }, { timeout: 3000 })
        expect(play).not.toBeDisabled()
        expect(getCapabilities.mock.calls.length).toBeGreaterThanOrEqual(3)
        expect(screen.queryByTestId('narration-unavailable')).toBeNull()
        expect(screen.queryByTestId('narration-safety-paused')).toBeNull()
        expect(screen.queryByRole('dialog')).toBeNull()
        await expectNarrateEnabled()
    })

    it('a seed alone (even with narration reported available) disables narration, without the notice', async () => {
        const getCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(elWithPause(new Date(Date.now() + 10 * 60_000).toISOString()))
        renderPanel(makeConfig())

        const blocked = await screen.findByRole('button', { name: BLOCKED })
        expect(getCapabilities).toHaveBeenCalled()
        expect(blocked).toBeDisabled()
        expect(screen.queryByRole('button', { name: PLAY })).toBeNull()
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(screen.getByTestId('narration-safety-paused')).toHaveTextContent(SAFETY_CALLOUT)
        // The account-level switch-off callout is a different state.
        expect(screen.queryByTestId('narration-unavailable')).toBeNull()
        fireEvent.click(blocked)
        expect(mocks.sendTts).not.toHaveBeenCalled()
    })

    it('the socket’s voice_safety_notice opens the notice and disables narration (ER-H1)', async () => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(caps(BFF_EL_PLUS_BODY))
        renderPanel(makeConfig())
        await settle()
        expect(screen.getByRole('button', { name: PLAY })).not.toBeDisabled()

        const options = mocks.useAdventureChatSocket.mock.lastCall?.[1] as { onVoiceSafetyNotice: (frame: VoiceSafetyNoticeFrame) => void }
        act(() => {
            options.onVoiceSafetyNotice({ type: 'voice_safety_notice', kind: 'self_harm', retry_after_seconds: 600 })
        })

        expect(await screen.findByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: BLOCKED })).toBeDisabled()
        expect(screen.queryByRole('button', { name: PLAY })).toBeNull()
        expect(screen.getByTestId('narration-safety-paused')).toHaveTextContent(SAFETY_CALLOUT)
    })

    it('keeps narration enabled for a paused_until already past', async () => {
        const getCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(elWithPause(new Date(Date.now() - 60_000).toISOString()))
        renderPanel(makeConfig())

        await waitFor(() => expect(getCapabilities).toHaveBeenCalled())
        await settle()
        expect(screen.queryByRole('dialog')).toBeNull()
        await expectNarrateEnabled()
    })

    it('keeps narration enabled with the all-off safeguards (no pause reported)', async () => {
        const getCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(caps(BFF_R0_BODY))
        renderPanel(makeConfig())

        await waitFor(() => expect(getCapabilities).toHaveBeenCalled())
        await settle()
        expect(screen.queryByRole('dialog')).toBeNull()
        await expectNarrateEnabled()
    })

    it('keeps today’s behaviour for an api without getVoiceCapabilities', async () => {
        const api = Object.create(apiService) as typeof apiService
        Object.defineProperty(api, 'getVoiceCapabilities', { value: undefined })
        renderPanel(makeConfig(api))

        await settle()
        expect(screen.queryByRole('dialog')).toBeNull()
        await expectNarrateEnabled()
    })
})
