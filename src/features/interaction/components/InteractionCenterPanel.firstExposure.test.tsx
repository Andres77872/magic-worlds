/**
 * R1-FE-03 wiring (D35, 03 §5.12, 05 §7.6): the chat surface mounts the
 * first-exposure notice for the session it plays, so every signed-in caller
 * sees it in a chat with a converted voice (I-68: no cohort).
 * The banner's own rules are covered by ChatFirstExposureBanner.test.tsx.
 */
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Adventure, CharacterChatSession, EffectiveVoice, TurnEntry, VoiceCapabilities } from '../../../shared'
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
    activeCharacterChat: null as unknown,
    editingInProgress: null as unknown,
}))

vi.mock('../../../app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn(), token: 'token', userHash: 'user-hash-1' }),
    useData: () => ({
        lorebooks: [],
        activeCharacterChat: mocks.activeCharacterChat,
        editingInProgress: mocks.editingInProgress,
        refreshAdventureVoices: vi.fn(),
        refreshCharacterChatVoice: vi.fn(),
    }),
}))

vi.mock('../hooks/useAdventureChatSocket', () => ({
    useAdventureChatSocket: mocks.useAdventureChatSocket,
}))

vi.mock('@/app/hooks/usePageFocus', () => ({
    usePageFocus: () => true,
    isPageFocused: () => true,
}))

const SESSION_ID = 7
const V1 = { voice_id: 'male-qn-qingse', preset_name: 'Calm' }
const EL: EffectiveVoice = {
    voice_key: `vk_${'a'.repeat(32)}`,
    display_name: 'Aria',
    provider_route: 'elevenlabs',
    substitution_reason: null,
    flags: [],
    badges: [],
}

const CHAT: CharacterChatSession = {
    id: String(SESSION_ID),
    kind: 'character',
    character_id: 'c1',
    characters: [{ id: 'c1', name: 'Lyra', race: '', stats: {}, voice: V1, effective_voice: EL }],
    turns: [],
}

const ADVENTURE: Adventure = {
    id: String(SESSION_ID),
    scenario: '',
    characters: [],
    snapshot: {
        template: { characters: [{ id: 'c1', name: 'Mirren', voice: V1, effective_voice: EL }] },
        narrator_voice: null,
        effective_narrator_voice: null,
    },
}

function makeConfig(kind: 'adventure' | 'character'): ChatSessionConfig {
    return {
        kind,
        basePath: kind === 'adventure' ? 'adventure-sessions' : 'character-chats',
        workspaceId: TEST_WORKSPACE_ID,
        api: apiService,
        loadTurns: vi.fn(async () => []),
        updateMessage: vi.fn(async () => []),
        deleteMessage: vi.fn(async () => []),
        selectReply: vi.fn(async () => []),
        clearMessages: vi.fn(async () => []),
        aiLabel: 'Game Master',
        showForwardOptions: kind === 'adventure',
        showImages: kind === 'adventure',
        autoNarrateKeyPrefix: 'test:exposure:',
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

function renderPanel(kind: 'adventure' | 'character') {
    function Harness() {
        const [turns, setTurns] = useState<TurnEntry[]>([])
        return <InteractionCenterPanel sessionId={SESSION_ID} turns={turns} setTurns={setTurns} config={makeConfig(kind)} />
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
    mocks.activeCharacterChat = CHAT
    mocks.editingInProgress = ADVENTURE
    mocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat: vi.fn(), sendTts: vi.fn(), cancel: vi.fn() })
    vi.spyOn(apiService, 'listLorebookAttachments').mockResolvedValue([])
    vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(caps(BFF_EL_PLUS_BODY))
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

describe('InteractionCenterPanel first-exposure mount (R1-FE-03)', () => {
    it.each(['character', 'adventure'] as const)('shows the notice in a %s session with a converted voice', async (kind) => {
        renderPanel(kind)
        expect(await screen.findByTestId('voice-first-exposure')).toBeInTheDocument()
    })

    it.each(['character', 'adventure'] as const)('shows it to a Free account too (%s, no cohort)', async (kind) => {
        vi.mocked(apiService.getVoiceCapabilities).mockResolvedValue(caps(BFF_R0_BODY))
        renderPanel(kind)
        expect(await screen.findByTestId('voice-first-exposure')).toBeInTheDocument()
    })

    it('reads the session the panel plays, not another chat', async () => {
        mocks.activeCharacterChat = { ...CHAT, id: '12' }
        renderPanel('character')
        await waitFor(() => expect(apiService.getVoiceCapabilities).toHaveBeenCalled())
        await screen.findByPlaceholderText('What next?')
        expect(screen.queryByTestId('voice-first-exposure')).toBeNull()
    })
})
