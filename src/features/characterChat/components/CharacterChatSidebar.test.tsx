import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '@/infrastructure/api'
import type { Character, VoiceCapabilities } from '@/shared'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { installVoiceNarrationCopy } from '@/test-utils/voiceNarrationCopy'
import { CharacterChatSidebar } from './CharacterChatSidebar'

// The lorebook panel (mounted for saved chats) reads DataProvider; not under test here.
vi.mock('@/features/lorebook', () => ({ SessionLorebookPanel: () => null }))

const lyra = { id: 'char-1', name: 'Lyra', description: 'A wandering bard.' } as Character

function capabilitiesWith(callsAvailable: boolean): VoiceCapabilities {
    return {
        surfaces: [],
        provider_route: 'elevenlabs',
        tiers_allowed: ['standard'],
        narration_tier: 'standard',
        consent_version_required: 'voice-v2',
        status: { narration_available: true, calls_available: callsAvailable, auto_narration_paused: false },
    }
}

// The shared capabilities read (09 §7); no network in tests.
const getVoiceCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities')

beforeEach(() => {
    getVoiceCapabilities.mockReset()
    getVoiceCapabilities.mockResolvedValue(capabilitiesWith(true))
})

afterEach(() => {
    getVoiceCapabilities.mockReset()
})

function renderSidebar(sessionWorkspaceId: string, onSetMode = vi.fn()) {
    const workspace = createWorkspaceTestState({
        workspaces: [
            testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
            testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-02T00:00:00Z' }),
        ],
    })
    render(
        <WorkspaceTestProvider state={workspace}>
            <CharacterChatSidebar
                character={lyra}
                sessionWorkspaceId={sessionWorkspaceId}
                voiceEnabled
                onSetMode={onSetMode}
                onBack={vi.fn()}
                onEditCharacter={vi.fn()}
            />
        </WorkspaceTestProvider>,
    )
    return onSetMode
}

describe('CharacterChatSidebar call button (Workspace R1)', () => {
    it('starts a call from a chat in an active workspace', () => {
        const onSetMode = renderSidebar(TEST_WORKSPACE_ID)
        fireEvent.click(screen.getByRole('button', { name: 'Call Lyra' }))
        expect(onSetMode).toHaveBeenCalledWith('voice')
    })

    it('disables the call for a chat in an archived workspace', () => {
        const onSetMode = renderSidebar(OTHER_WORKSPACE_ID)
        const call = screen.getByRole('button', { name: 'Call Lyra' })
        expect(call).toBeDisabled()
        fireEvent.click(call)
        expect(onSetMode).not.toHaveBeenCalled()
    })
})

describe('CharacterChatSidebar call button (calls switched off, 09 §7)', () => {
    const copy = 'Voice calls are unavailable right now. Try again later.'

    it('disables the call with the Calls page copy while calls are unavailable', async () => {
        getVoiceCapabilities.mockResolvedValue(capabilitiesWith(false))
        const onSetMode = renderSidebar(TEST_WORKSPACE_ID)
        const call = screen.getByRole('button', { name: 'Call Lyra' })

        await waitFor(() => expect(call).toBeDisabled())
        expect(call).toHaveAttribute('title', copy)
        expect(call).toHaveAccessibleDescription(copy)
        fireEvent.click(call)
        expect(onSetMode).not.toHaveBeenCalled()
        // Editing the character stays available.
        expect(screen.getByRole('button', { name: 'Edit character' })).toBeEnabled()
    })

    it('fails open when capabilities carry no status or the read fails', async () => {
        getVoiceCapabilities.mockRejectedValue(new Error('offline'))
        const onSetMode = renderSidebar(TEST_WORKSPACE_ID)
        await waitFor(() => expect(getVoiceCapabilities).toHaveBeenCalled())
        const call = screen.getByRole('button', { name: 'Call Lyra' })
        expect(call).toBeEnabled()
        expect(call).not.toHaveAttribute('aria-describedby')
        fireEvent.click(call)
        expect(onSetMode).toHaveBeenCalledWith('voice')
    })

    it('does not read capabilities when no call is offered', () => {
        render(
            <WorkspaceTestProvider state={createWorkspaceTestState({ workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library')] })}>
                <CharacterChatSidebar character={lyra} sessionWorkspaceId={TEST_WORKSPACE_ID} voiceEnabled={false} onBack={vi.fn()} onEditCharacter={vi.fn()} />
            </WorkspaceTestProvider>,
        )
        expect(screen.queryByRole('button', { name: 'Call Lyra' })).toBeNull()
        expect(getVoiceCapabilities).not.toHaveBeenCalled()
    })
})

describe('CharacterChatSidebar narration tier (R1-FE-04)', () => {
    const elCapabilities = (): VoiceCapabilities => ({
        ...capabilitiesWith(true),
        tiers_allowed: ['standard', 'expressive'],
    })
    const getSessionVoiceSettings = vi.spyOn(apiService, 'getSessionVoiceSettings')

    beforeEach(() => {
        installVoiceNarrationCopy()
        getSessionVoiceSettings.mockReset()
        getSessionVoiceSettings.mockResolvedValue({
            session_id: 9,
            tier_override: null,
            effective_tier: 'standard',
            tier_fallback_reason: null,
            tiers_allowed: ['standard', 'expressive'],
            provider_route: 'elevenlabs',
            updated_at: null,
        })
    })

    function renderChat(sessionWorkspaceId: string, sessionId?: string) {
        render(
            <WorkspaceTestProvider state={createWorkspaceTestState({
                workspaces: [
                    testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                    testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-02T00:00:00Z' }),
                ],
            })}>
                <CharacterChatSidebar character={lyra} sessionId={sessionId} sessionWorkspaceId={sessionWorkspaceId} onBack={vi.fn()} onEditCharacter={vi.fn()} />
            </WorkspaceTestProvider>,
        )
    }

    it('reads the chat voice settings on the chat workspace client and shows the toggle', async () => {
        getVoiceCapabilities.mockResolvedValue(elCapabilities())
        renderChat(TEST_WORKSPACE_ID, '9')
        expect(await screen.findByRole('radiogroup', { name: 'Narration for this session' })).toBeInTheDocument()
        expect(getSessionVoiceSettings).toHaveBeenCalledWith('character-chats', 9)
        const scope = (getSessionVoiceSettings.mock.contexts[0] as { workspaceScope?: { workspaceId: string } }).workspaceScope
        expect(scope?.workspaceId).toBe(TEST_WORKSPACE_ID)
    })

    it('shows nothing when the capabilities read fails (fail closed)', async () => {
        getVoiceCapabilities.mockRejectedValue(new Error('offline'))
        renderChat(TEST_WORKSPACE_ID, '9')
        await waitFor(() => expect(getVoiceCapabilities).toHaveBeenCalled())
        await Promise.resolve()
        expect(screen.queryByRole('radiogroup', { name: 'Narration for this session' })).toBeNull()
    })

    it('is not offered for an unsaved draft', async () => {
        getVoiceCapabilities.mockResolvedValue(elCapabilities())
        renderChat(TEST_WORKSPACE_ID)
        await Promise.resolve()
        expect(screen.queryByRole('radiogroup', { name: 'Narration for this session' })).toBeNull()
        expect(getSessionVoiceSettings).not.toHaveBeenCalled()
    })

    it('is disabled in an archived workspace', async () => {
        getVoiceCapabilities.mockResolvedValue(elCapabilities())
        renderChat(OTHER_WORKSPACE_ID, '9')
        expect(await screen.findByRole('radio', { name: 'Standard' })).toBeDisabled()
    })
})
