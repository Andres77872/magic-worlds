import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatTtsSegmentClip, TurnEntry, VoiceCapabilities } from '../../../shared'
import type { ChatSessionConfig } from '../chatSessionConfig'
import { apiService } from '../../../infrastructure/api'
import { createWorkspaceTestState, TEST_WORKSPACE_ID, WorkspaceTestProvider } from '@/shared/hooks/testing/workspaceTestUtils'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_EL_PLUS_BODY, BFF_R0_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import { installVoiceNarrationCopy } from '@/test-utils/voiceNarrationCopy'
import { InteractionCenterPanel } from './InteractionCenterPanel'

vi.mock('../../../infrastructure/api/useAuthenticatedMediaUrl', () => ({
    useAuthenticatedMediaUrl: (url?: string | null) => ({ src: url ?? undefined, loading: false, error: null }),
}))

const mocks = vi.hoisted(() => ({
    useAdventureChatSocket: vi.fn(),
    refreshAdventureVoices: vi.fn(),
    refreshCharacterChatVoice: vi.fn(),
}))

vi.mock('../../../app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn(), token: 'token' }),
    useData: () => ({
        lorebooks: [],
        refreshAdventureVoices: mocks.refreshAdventureVoices,
        refreshCharacterChatVoice: mocks.refreshCharacterChatVoice,
    }),
}))

vi.mock('../hooks/useAdventureChatSocket', () => ({
    useAdventureChatSocket: mocks.useAdventureChatSocket,
}))

vi.mock('@/app/hooks/usePageFocus', () => ({
    usePageFocus: () => true,
    isPageFocused: () => true,
}))

const replacedSpeaker: ChatTtsSegmentClip = {
    segment_index: 0,
    status: 'completed',
    url: '/tts/assets/a.mp3',
    kind: 'speech',
    speaker_id: 'card-1',
    speaker_name: 'Rook',
    substitution_reason: 'voice_removed',
    voice_name: 'Ava',
}
const replacedNarrator: ChatTtsSegmentClip = { segment_index: 1, status: 'completed', url: '/tts/assets/b.mp3', kind: 'narrator', substitution_reason: 'voice_unavailable' }

const seed = (clips: ChatTtsSegmentClip[]): TurnEntry[] => [
    { id: '100', type: 'user', content: 'Open the door', timestamp: '2026-06-04T00:00:00' },
    { id: '101', type: 'ai', content: 'The door opens.', timestamp: '2026-06-04T00:00:01', assistantMessageId: 101, turnId: 'turn-1', ttsSegments: clips },
]

function makeConfig(overrides: Partial<ChatSessionConfig> = {}): ChatSessionConfig {
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
        autoNarrateKeyPrefix: 'test:refresh:',
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
        ...overrides,
    }
}

function renderPanel(config: ChatSessionConfig, turns: TurnEntry[], extra: { onEditNarratorVoice?: () => void; isGroupChat?: boolean } = {}) {
    function Harness() {
        const [current, setCurrent] = useState<TurnEntry[]>(turns)
        return <InteractionCenterPanel sessionId={7} turns={current} setTurns={setCurrent} config={config} {...extra} />
    }
    return render(<WorkspaceTestProvider state={createWorkspaceTestState({ api: apiService })}><Harness /></WorkspaceTestProvider>)
}

const caps = (body: unknown) => toVoiceCapabilities(body) as VoiceCapabilities

beforeAll(() => {
    installVoiceNarrationCopy()
})

beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    mocks.refreshAdventureVoices.mockReset().mockResolvedValue(undefined)
    mocks.refreshCharacterChatVoice.mockReset().mockResolvedValue({})
    mocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat: vi.fn(), sendTts: vi.fn(), cancel: vi.fn() })
    vi.spyOn(apiService, 'listLorebookAttachments').mockResolvedValue([])
    vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(caps(BFF_EL_PLUS_BODY))
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

async function openReplacedMenu(name: RegExp = /Voice replaced/) {
    const triggers = await screen.findAllByRole('button', { name })
    fireEvent.click(triggers[0])
}

describe('InteractionCenterPanel voice refresh (R1-FE-04)', () => {
    it('refreshes an adventure speaker by its card id on the session client (R-30)', async () => {
        renderPanel(makeConfig(), seed([replacedSpeaker]))
        await openReplacedMenu()
        const item = screen.getByRole('menuitem', { name: 'Use the card’s current voice' })
        await waitFor(() => expect(item).not.toBeDisabled())
        fireEvent.click(item)
        await waitFor(() => expect(mocks.refreshAdventureVoices).toHaveBeenCalledWith('7', ['card-1'], apiService))
        expect(await screen.findByText('Voice updated. New replies use it.')).toBeInTheDocument()
    })

    it('refreshes a 1:1 character chat', async () => {
        renderPanel(makeConfig({ kind: 'character', basePath: 'character-chats' }), seed([replacedSpeaker]))
        await openReplacedMenu()
        const item = screen.getByRole('menuitem', { name: 'Use the card’s current voice' })
        await waitFor(() => expect(item).not.toBeDisabled())
        fireEvent.click(item)
        await waitFor(() => expect(mocks.refreshCharacterChatVoice).toHaveBeenCalledWith('7', apiService))
        expect(mocks.refreshAdventureVoices).not.toHaveBeenCalled()
    })

    it('offers no refresh in a group chat', async () => {
        renderPanel(makeConfig({ kind: 'character', basePath: 'character-chats' }), seed([replacedSpeaker]), { isGroupChat: true })
        expect(await screen.findByText('Voice replaced')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Voice replaced/ })).toBeNull()
    })

    it('offers the action to a Free account too (I-68: no cohort)', async () => {
        vi.mocked(apiService.getVoiceCapabilities).mockResolvedValue(caps(BFF_R0_BODY))
        renderPanel(makeConfig(), seed([replacedSpeaker]))
        await openReplacedMenu()
        const item = screen.getByRole('menuitem', { name: 'Use the card’s current voice' })
        await waitFor(() => expect(item).not.toBeDisabled())
        fireEvent.click(item)
        await waitFor(() => expect(mocks.refreshAdventureVoices).toHaveBeenCalledWith('7', ['card-1'], apiService))
    })

    it('keeps the action disabled when the capabilities read fails', async () => {
        vi.mocked(apiService.getVoiceCapabilities).mockRejectedValue(new Error('offline'))
        renderPanel(makeConfig(), seed([replacedSpeaker]))
        await openReplacedMenu()
        await waitFor(() => expect(apiService.getVoiceCapabilities).toHaveBeenCalled())
        const item = screen.getByRole('menuitem', { name: 'Use the card’s current voice' })
        expect(item).toBeDisabled()
        fireEvent.click(item)
        expect(mocks.refreshAdventureVoices).not.toHaveBeenCalled()
    })

    it('opens the narrator picker for a replaced adventure narrator', async () => {
        const onEditNarratorVoice = vi.fn()
        renderPanel(makeConfig(), seed([replacedNarrator]), { onEditNarratorVoice })
        await openReplacedMenu()
        const item = screen.getByRole('menuitem', { name: 'Change narrator voice' })
        await waitFor(() => expect(item).not.toBeDisabled())
        fireEvent.click(item)
        expect(onEditNarratorVoice).toHaveBeenCalledOnce()
    })

    it('keeps the AI voice label next to the notes (P-10)', async () => {
        renderPanel(makeConfig(), seed([replacedSpeaker]))
        expect(await screen.findByText('AI voice')).toBeInTheDocument()
    })
})
