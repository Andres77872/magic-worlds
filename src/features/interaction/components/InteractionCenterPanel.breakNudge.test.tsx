/**
 * R2-BE-01 in the chat (13 §2.7): the break nudge counts narration play time
 * reported by the turns, with the interval from
 * `readSafeguards(capabilities).break_nudge_minutes`. It never shows when the
 * safeguards carry no interval (the all-off default) or are missing (an older
 * BFF build), never while nothing plays, never in a read-only (archived)
 * session, and it never stops playback.
 */
import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TurnEntry, VoiceCapabilities } from '../../../shared'
import type { ChatSessionConfig } from '../chatSessionConfig'
import { apiService } from '../../../infrastructure/api'
import { createWorkspaceTestState, TEST_WORKSPACE_ID, testWorkspace, WorkspaceTestProvider } from '@/shared/hooks/testing/workspaceTestUtils'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_EL_PLUS_BODY, BFF_R0_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import { InteractionCenterPanel } from './InteractionCenterPanel'

const mocks = vi.hoisted(() => ({ useAdventureChatSocket: vi.fn() }))

vi.mock('../../../infrastructure/api/useAuthenticatedMediaUrl', () => ({
    useAuthenticatedMediaUrl: (url?: string | null) => ({ src: url ?? undefined, loading: false, error: null }),
}))

vi.mock('../../../app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn(), token: 'token' }),
    useData: () => ({ lorebooks: [] }),
}))

vi.mock('../hooks/useAdventureChatSocket', () => ({ useAdventureChatSocket: mocks.useAdventureChatSocket }))

vi.mock('@/app/hooks/usePageFocus', () => ({ usePageFocus: () => true, isPageFocused: () => true }))

// The turn reports its narration playing stretches exactly as TurnNarration does,
// and holds a media element as TurnNarration's player does.
vi.mock('./ChatTurn', () => ({
    ChatTurn: ({ turn, onNarrationPlayingChange }: { turn: TurnEntry; onNarrationPlayingChange?: (turnId: string, playing: boolean) => void }) => (
        <div data-testid={`turn-${turn.id}`}>
            <audio data-testid={`audio-${turn.id}`} />
            <button type="button" onClick={() => onNarrationPlayingChange?.(turn.id, true)}>play {turn.id}</button>
            <button type="button" onClick={() => onNarrationPlayingChange?.(turn.id, false)}>stop {turn.id}</button>
        </div>
    ),
}))

const MINUTE = 60_000

const TURNS: TurnEntry[] = [
    { id: '100', type: 'user', content: 'Open the door', timestamp: '2026-06-04T00:00:00' },
    { id: '101', type: 'ai', content: 'The door opens.', timestamp: '2026-06-04T00:00:01', assistantMessageId: 101, turnId: 'turn-1' },
]

function makeConfig(): ChatSessionConfig {
    return {
        kind: 'adventure',
        basePath: 'adventure-sessions',
        workspaceId: TEST_WORKSPACE_ID,
        api: apiService,
        loadTurns: vi.fn(async () => []),
        updateMessage: vi.fn(async () => []),
        deleteMessage: vi.fn(async () => []),
        selectReply: vi.fn(async () => []),
        clearMessages: vi.fn(async () => []),
        aiLabel: 'Game Master',
        showForwardOptions: true,
        showImages: true,
        autoNarrateKeyPrefix: 'test:nudge:',
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

function renderPanel({ archived = false }: { archived?: boolean } = {}) {
    function Harness() {
        const [current, setCurrent] = useState<TurnEntry[]>(TURNS)
        return <InteractionCenterPanel sessionId={7} turns={current} setTurns={setCurrent} config={makeConfig()} />
    }
    // An archived session workspace makes the chat read-only (Workspace R1).
    const workspaces = archived ? [testWorkspace(TEST_WORKSPACE_ID, 'Main library', { archived_at: '2026-10-02T00:00:00Z' })] : undefined
    return render(<WorkspaceTestProvider state={createWorkspaceTestState({ api: apiService, workspaces })}><Harness /></WorkspaceTestProvider>)
}

const caps = (body: unknown) => toVoiceCapabilities(body) as VoiceCapabilities
const withInterval = (minutes: number | null) => caps({ ...BFF_EL_PLUS_BODY, safeguards: { ...BFF_EL_PLUS_BODY.safeguards, break_nudge_minutes: minutes } })

async function settle(ms = 0) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
    })
}

const nudge = () => screen.queryByTestId('break-nudge')

beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    mocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat: vi.fn(), sendTts: vi.fn(), cancel: vi.fn() })
    vi.spyOn(apiService, 'listLorebookAttachments').mockResolvedValue([])
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('InteractionCenterPanel break nudge (R2-BE-01)', () => {
    it('nudges after break_nudge_minutes of narration play, and a dismissal leaves playback alone', async () => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(withInterval(30))
        renderPanel()
        await settle()
        fireEvent.click(screen.getByRole('button', { name: 'play 101' }))
        await settle(29 * MINUTE)
        expect(nudge()).toBeNull()
        await settle(MINUTE)
        expect(nudge()).toHaveTextContent('Time for a break?')
        const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
        expect(nudge()).toBeNull()
        expect(pause).not.toHaveBeenCalled()
        // Nothing reported a stop, and the dismissal stopped nothing: the panel
        // still counts the same narration, and nudges again after a fresh interval only.
        await settle(29 * MINUTE)
        expect(nudge()).toBeNull()
        await settle(MINUTE)
        expect(nudge()).toHaveTextContent('Time for a break?')
        expect(pause).not.toHaveBeenCalled()
    })

    it('never nudges in a read-only (archived) session, though stored clips still play', async () => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(withInterval(30))
        renderPanel({ archived: true })
        await settle()
        expect(screen.getByTestId('chat-read-only')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'play 101' }))
        await settle(8 * 60 * MINUTE)
        expect(nudge()).toBeNull()
    })

    it('counts play time only: nothing playing, no nudge', async () => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(withInterval(30))
        renderPanel()
        await settle()
        fireEvent.click(screen.getByRole('button', { name: 'play 101' }))
        await settle(10 * MINUTE)
        fireEvent.click(screen.getByRole('button', { name: 'stop 101' }))
        await settle(60 * MINUTE)
        expect(nudge()).toBeNull()
    })

    const withoutSafeguards: Record<string, unknown> = { ...BFF_R0_BODY }
    delete withoutSafeguards.safeguards
    it.each([
        ['the all-off default safeguards', caps(BFF_R0_BODY)],
        ['capabilities without a safeguards key', caps(withoutSafeguards)],
        ['safeguards with no interval', withInterval(null)],
    ] as const)('never nudges for %s', async (_name, capabilities) => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities)
        renderPanel()
        await settle()
        fireEvent.click(screen.getByRole('button', { name: 'play 101' }))
        await settle(8 * 60 * MINUTE)
        expect(nudge()).toBeNull()
    })
})
