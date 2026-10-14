/**
 * D23 (10 §2.4 #16-#17): the chat shows saved voice-call replies without
 * speech markup, the rows stored before the voice purge included, as the
 * Calls page transcript does (`CallTranscriptView`). Text replies and the
 * player's own call turns still render exactly as stored.
 */
import { useState } from 'react'
import { render, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatResponseSegment, TurnEntry, VoiceCapabilities } from '../../../shared'
import type { ChatSessionConfig } from '../chatSessionConfig'
import { apiService } from '../../../infrastructure/api'
import { createWorkspaceTestState, TEST_WORKSPACE_ID, WorkspaceTestProvider } from '@/shared/hooks/testing/workspaceTestUtils'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_EL_PLUS_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import { LEGACY_CALL_TTS_PROVIDER } from '@/test/fixtures/legacyMinimax'
import { installVoiceNarrationCopy } from '@/test-utils/voiceNarrationCopy'
import { ELEVENLABS_CALL_TTS_PROVIDER } from '../utils/callTurnMarkup'
import { InteractionCenterPanel } from './InteractionCenterPanel'

vi.mock('../../../infrastructure/api/useAuthenticatedMediaUrl', () => ({
    useAuthenticatedMediaUrl: (url?: string | null) => ({ src: url ?? undefined, loading: false, error: null }),
}))

const mocks = vi.hoisted(() => ({ useAdventureChatSocket: vi.fn() }))

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

const LEGACY_SPOKEN = 'Hold on. <#0.4#> (sighs) The door is open.'
const LEGACY_SHOWN = 'Hold on. The door is open.'
const EL_SPOKEN = 'Wait. <#0.6#> (laughs) The bridge is up.'
const EL_SHOWN = 'Wait. The bridge is up.'
const TEXT_REPLY = 'The scribe writes <#0.2#> on the page.'
const PLAYER_CALL_TURN = 'Is it (sighs) open?'

function callMetadata(ttsProvider: string): Record<string, unknown> {
    return {
        conversation_mode: 'voice_call',
        voice: { voice_session_id: 7, segment_seq: 2, stt_provider: 'groq', tts_provider: ttsProvider, partial: false },
    }
}

const speech = (content: string): ChatResponseSegment[] => [{ kind: 'speech', content, speaker_id: 'c1', speaker_name: 'Lyra' }]

const TURNS: TurnEntry[] = [
    { id: '100', type: 'user', content: PLAYER_CALL_TURN, timestamp: '2026-10-14T10:00:00Z', metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER) },
    { id: '101', type: 'ai', content: LEGACY_SPOKEN, timestamp: '2026-10-14T10:00:01Z', assistantMessageId: 101, turnId: 'turn-1', metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER), segments: speech(LEGACY_SPOKEN) },
    { id: '102', type: 'user', content: 'And now?', timestamp: '2026-10-14T10:00:02Z' },
    { id: '103', type: 'ai', content: EL_SPOKEN, timestamp: '2026-10-14T10:00:03Z', assistantMessageId: 103, turnId: 'turn-2', metadata: callMetadata(ELEVENLABS_CALL_TTS_PROVIDER) },
    { id: '104', type: 'user', content: 'Write it down.', timestamp: '2026-10-14T10:00:04Z' },
    { id: '105', type: 'ai', content: TEXT_REPLY, timestamp: '2026-10-14T10:00:05Z', assistantMessageId: 105, turnId: 'turn-3' },
]

function makeConfig(): ChatSessionConfig {
    return {
        kind: 'character',
        basePath: 'character-chats',
        workspaceId: TEST_WORKSPACE_ID,
        api: apiService,
        loadTurns: vi.fn(async () => []),
        updateMessage: vi.fn(async () => []),
        deleteMessage: vi.fn(async () => []),
        selectReply: vi.fn(async () => []),
        clearMessages: vi.fn(async () => []),
        aiLabel: 'Lyra',
        showForwardOptions: false,
        showImages: false,
        autoNarrateKeyPrefix: 'test:callMarkup:',
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

function renderPanel(turns: TurnEntry[]) {
    function Harness() {
        const [current, setCurrent] = useState<TurnEntry[]>(turns)
        return <InteractionCenterPanel sessionId={7} turns={current} setTurns={setCurrent} config={makeConfig()} />
    }
    return render(<WorkspaceTestProvider state={createWorkspaceTestState({ api: apiService })}><Harness /></WorkspaceTestProvider>)
}

beforeAll(() => {
    installVoiceNarrationCopy()
})

beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    mocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat: vi.fn(), sendTts: vi.fn(), cancel: vi.fn() })
    vi.spyOn(apiService, 'listLorebookAttachments').mockResolvedValue([])
    vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(toVoiceCapabilities(BFF_EL_PLUS_BODY) as VoiceCapabilities)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

describe('InteractionCenterPanel: saved call replies (D23, 10 §2.4 #16-#17)', () => {
    it('shows a call reply stored before the voice purge without speech markup', async () => {
        const { container } = renderPanel(TURNS)
        await waitFor(() => expect(container.textContent).toContain(LEGACY_SHOWN))
        expect(container.textContent).not.toContain('<#0.4#>')
        expect(container.textContent).not.toContain('(sighs) The door')
    })

    it('shows an ElevenLabs call reply without speech markup', async () => {
        const { container } = renderPanel(TURNS)
        await waitFor(() => expect(container.textContent).toContain(EL_SHOWN))
        expect(container.textContent).not.toContain('<#0.6#>')
        expect(container.textContent).not.toContain('(laughs)')
    })

    it('leaves text replies and the player’s call turns exactly as stored', async () => {
        const { container } = renderPanel(TURNS)
        await waitFor(() => expect(container.textContent).toContain(TEXT_REPLY))
        expect(container.textContent).toContain(PLAYER_CALL_TURN)
        // Display only: the stored turns keep what was spoken.
        expect(TURNS[1].content).toBe(LEGACY_SPOKEN)
        expect(TURNS[1].segments?.[0].content).toBe(LEGACY_SPOKEN)
    })
})
