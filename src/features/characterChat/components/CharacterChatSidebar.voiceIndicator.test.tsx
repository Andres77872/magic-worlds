import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
/**
 * R1-FE-04 wiring (D36, AC-C6): the chat sidebar mounts `ChatVoiceIndicator`
 * for its own chat and workspace. The indicator's rules are covered by
 * ChatVoiceIndicator.test.tsx; this checks the mount passes the right chat id
 * and the session's workspace, and that an unaffected chat shows nothing.
 */
import { act, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataContext } from '@/app/providers/DataProvider'
import { apiService } from '@/infrastructure/api'
import type { Character, CharacterChatSession, EffectiveVoice, EffectiveVoiceResponse } from '@/shared'
import { CAPABILITIES_EL_PLUS } from '@/features/voices/fixtures'
import { clearSessionVoicesCache } from '@/features/interaction/components/voice/sessionVoiceCache'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { installVoiceNarrationCopy } from '@/test-utils/voiceNarrationCopy'
import { CharacterChatSidebar } from './CharacterChatSidebar'

vi.mock('@/features/lorebook', () => ({ SessionLorebookPanel: () => null }))

type DataValue = NonNullable<ComponentProps<typeof DataContext.Provider>['value']>

const KEY_A = `vk_${'a'.repeat(32)}`
const KEY_B = `vk_${'b'.repeat(32)}`

function el(voiceKey: string, overrides: Partial<EffectiveVoice> = {}): EffectiveVoice {
    return {
        voice_key: voiceKey,
        display_name: voiceKey === KEY_A ? 'Aria' : 'Bram',
        provider_route: 'elevenlabs',
        substitution_reason: null,
        badges: [],
        ...overrides,
    }
}

const lyra: Character = {
    id: 'card-1',
    name: 'Lyra',
    race: 'Elf',
    stats: {},
    voice: { schema_version: 2, provider: 'elevenlabs', voice_key: `vk_${'c'.repeat(32)}`, voice_name: 'Calm', preset_name: 'Calm' },
    effective_voice: el(KEY_B),
}

const CHAT: CharacterChatSession = { id: '9', kind: 'character', character_id: 'card-1', character_ids: ['card-1'], character: lyra, turns: [] }

const sessionVoices = (effective: EffectiveVoice): EffectiveVoiceResponse => ({
    ref_type: 'session',
    ref_id: '9',
    voices: [{ json_path: 'character.voice', effective_voice: effective }],
})

const getEffectiveVoice = vi.spyOn(apiService, 'getEffectiveVoice')
const getVoiceCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities')
const getSessionVoiceSettings = vi.spyOn(apiService, 'getSessionVoiceSettings')

beforeEach(() => {
    installVoiceNarrationCopy()
    clearSessionVoicesCache()
    getEffectiveVoice.mockReset()
    getVoiceCapabilities.mockReset().mockResolvedValue(CAPABILITIES_EL_PLUS)
    // The session tier toggle shares the sidebar; it is not under test here.
    getSessionVoiceSettings.mockReset().mockRejectedValue(new Error('not under test'))
})

afterEach(() => {
    getVoiceCapabilities.mockReset()
})

function renderSidebar(sessionWorkspaceId: string) {
    const data = { activeCharacterChat: CHAT, characters: [lyra], refreshCharacterChatVoice: vi.fn() } as unknown as DataValue
    const workspace = createWorkspaceTestState({
        workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library'), testWorkspace(OTHER_WORKSPACE_ID, 'Novel A')],
        selectedWorkspaceId: TEST_WORKSPACE_ID,
    })
    return render(
        <WorkspaceTestProvider state={workspace}>
            <DataContext.Provider value={data}>
                <CharacterChatSidebar
                    character={lyra}
                    sessionId="9"
                    sessionWorkspaceId={sessionWorkspaceId}
                    onBack={vi.fn()}
                    onEditCharacter={vi.fn()}
                />
            </DataContext.Provider>
        </WorkspaceTestProvider>,
    )
}

const readScope = () => (getEffectiveVoice.mock.contexts[0] as { workspaceScope?: { workspaceId: string } }).workspaceScope?.workspaceId

describe('CharacterChatSidebar chat voice indicator mount (R1-FE-04)', () => {
    it('shows the indicator and the refresh for its chat', async () => {
        getEffectiveVoice.mockResolvedValue(sessionVoices(el(KEY_A)))
        renderSidebar(TEST_WORKSPACE_ID)
        expect(await screen.findByRole('group', { name: 'Chat voice' })).toHaveTextContent('Card voice changed')
        expect(screen.getByRole('button', { name: 'Use the card’s current voice' })).toBeEnabled()
        expect(getEffectiveVoice).toHaveBeenCalledWith('session', '9')
        expect(readScope()).toBe(TEST_WORKSPACE_ID)
    })

    it('reads the chat in the session’s own workspace, not the committed one', async () => {
        getEffectiveVoice.mockResolvedValue(sessionVoices(el(KEY_A, { substitution_reason: 'voice_removed', badges: ['replaced'] })))
        renderSidebar(OTHER_WORKSPACE_ID)
        expect(await screen.findByText('Voice replaced')).toBeInTheDocument()
        expect(readScope()).toBe(OTHER_WORKSPACE_ID)
        // The committed workspace's library is not this chat's (D39 item 6): no comparison, no action.
        expect(screen.queryByRole('button', { name: 'Use the card’s current voice' })).toBeNull()
    })

    it('shows nothing when the chat already plays the card’s voice', async () => {
        getEffectiveVoice.mockResolvedValue(sessionVoices(el(KEY_B)))
        renderSidebar(TEST_WORKSPACE_ID)
        await waitFor(() => expect(getEffectiveVoice).toHaveBeenCalledWith('session', '9'))
        await act(async () => {})
        expect(screen.queryByRole('group', { name: 'Chat voice' })).toBeNull()
        expect(screen.queryByTestId('chat-voice-indicator')).toBeNull()
    })
})
