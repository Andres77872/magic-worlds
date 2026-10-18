import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceCallState } from '@/shared/types/voice.types'
import { apiService } from '@/infrastructure/api'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { CallScreen } from './CallScreen'

const controller = vi.hoisted(() => ({
    state: 'idle' as VoiceCallState,
    startCall: vi.fn(async () => true),
}))

vi.mock('@/features/interaction/hooks/useVoiceCallController', () => ({
    useVoiceCallController: () => ({
        state: controller.state,
        isMuted: false,
        elapsedSeconds: 0,
        remainingSeconds: null,
        inputLevel: 0,
        transcript: null,
        assistantText: '',
        error: null,
        endReason: null,
        autoplayBlocked: false,
        echoCancellationOff: false,
        startCall: controller.startCall,
        endCall: vi.fn(async () => undefined),
        resumePlayback: vi.fn(),
        dismissError: vi.fn(),
        mute: vi.fn(),
        unmute: vi.fn(),
        bargeIn: vi.fn(),
    }),
}))

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, token: 'token' }),
    useData: () => ({ refreshCharacterChatVoice: vi.fn() }),
}))

vi.mock('@/features/llmProfiles/LlmFeatureControl', () => ({
    LlmFeatureControl: () => null,
}))

vi.mock('@/shared/voiceFeatureFlag', () => ({
    isFrontendVoiceModeEnabled: () => true,
}))

function renderCall(archived: boolean) {
    const workspace = createWorkspaceTestState({
        workspaces: [
            testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
            testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', archived ? { archived_at: '2026-10-02T00:00:00Z' } : {}),
        ],
    })
    return render(
        <WorkspaceTestProvider state={workspace}>
            <CallScreen sessionId={7} workspaceId={OTHER_WORKSPACE_ID} onSwitchToText={vi.fn()} />
        </WorkspaceTestProvider>,
    )
}

describe('CallScreen (Workspace R1)', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        controller.state = 'idle'
        controller.startCall.mockClear()
        // Call availability reads the capabilities; offline reads fail open.
        vi.spyOn(apiService, 'getVoiceCapabilities').mockRejectedValue(new Error('offline'))
    })

    it('explains an archived chat workspace up front instead of opening the call', () => {
        renderCall(true)

        expect(screen.queryByRole('button', { name: /I consent and start call/i })).toBeNull()
        expect(screen.getByText('This workspace is archived. Restore it to call again.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Call again' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Back to chat' })).toBeInTheDocument()
        expect(controller.startCall).not.toHaveBeenCalled()
    })

    it('opens the consent gate for an active workspace', async () => {
        renderCall(false)

        // The consent is always the voice-v2 copy (D25, I-68): no version read gates it.
        const accept = screen.getByRole('button', { name: /I consent and start call/i })
        await waitFor(() => expect(accept).toBeEnabled())
        fireEvent.click(accept)
        expect(controller.startCall).toHaveBeenCalledOnce()
        expect(screen.queryByText('This workspace is archived. Restore it to call again.')).toBeNull()
    })

    it('leaves a call that is already running alone', () => {
        controller.state = 'listening'
        renderCall(true)

        expect(screen.getByText('Listening')).toBeInTheDocument()
        expect(screen.queryByText('This workspace is archived. Restore it to call again.')).toBeNull()
    })
})

describe('CallScreen call availability (09 §7)', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        controller.state = 'idle'
        controller.startCall.mockClear()
    })

    function capabilities(status?: Record<string, boolean>) {
        return toVoiceCapabilities({ surfaces: { calls: {} }, ...(status ? { status } : {}) })!
    }

    it('blocks the start with copy while calls_available is false', async () => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities({ calls_available: false, narration_available: true }))
        renderCall(false)

        expect(await screen.findByText('Voice calls are unavailable right now. Try again later.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /I consent and start call/i })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Call again' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Back to chat' })).toBeInTheDocument()
        expect(controller.startCall).not.toHaveBeenCalled()
    })

    it('fails open on a capabilities response without calls_available', async () => {
        const read = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities({ narration_available: false }))
        renderCall(false)

        await waitFor(() => expect(read).toHaveBeenCalled())
        const accept = await screen.findByRole('button', { name: /I consent and start call/i })
        await waitFor(() => expect(accept).toBeEnabled())
        fireEvent.click(accept)
        expect(controller.startCall).toHaveBeenCalledOnce()
        expect(screen.queryByText('Voice calls are unavailable right now. Try again later.')).toBeNull()
    })

    it('leaves a running call alone when calls switch off', async () => {
        const read = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities({ calls_available: false }))
        controller.state = 'listening'
        renderCall(false)

        await waitFor(() => expect(read).toHaveBeenCalled())
        expect(screen.getByText('Listening')).toBeInTheDocument()
        expect(screen.queryByText('Voice calls are unavailable right now. Try again later.')).toBeNull()
    })
})
