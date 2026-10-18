import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceCallState } from '@/shared/types/voice.types'
import type { EffectiveVoice, VoiceCapabilities } from '@/shared/types'
import { apiService } from '@/infrastructure/api'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_EL_PLUS_BODY, BFF_R0_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { installVoiceNarrationCopy } from '@/test-utils/voiceNarrationCopy'
import { CallScreen } from './CallScreen'

const controller = vi.hoisted(() => ({
    state: 'idle' as VoiceCallState,
    startCall: vi.fn(async () => true),
    error: null as null | { category: string; code?: string; message: string; fatal?: boolean },
    endReason: null as string | null,
    assistantText: '',
    audioFormat: null as null | Record<string, unknown>,
    effectiveVoice: null as EffectiveVoice | null,
    originalVoiceName: null as string | null,
    substitutionReason: null as string | null,
    replacedVoiceName: null as string | null,
}))

const data = vi.hoisted(() => ({
    refreshCharacterChatVoice: vi.fn<(chatId: string, api?: unknown) => Promise<unknown>>(async () => ({})),
}))

vi.mock('@/features/interaction/hooks/useVoiceCallController', () => ({
    useVoiceCallController: () => ({
        state: controller.state,
        isMuted: false,
        elapsedSeconds: 0,
        remainingSeconds: null,
        inputLevel: 0,
        transcript: null,
        assistantText: controller.assistantText,
        error: controller.error,
        endReason: controller.endReason,
        autoplayBlocked: false,
        echoCancellationOff: false,
        audioFormat: controller.audioFormat,
        effectiveVoice: controller.effectiveVoice,
        originalVoiceName: controller.originalVoiceName,
        substitutionReason: controller.substitutionReason,
        replacedVoiceName: controller.replacedVoiceName,
        audioUnsupported: false,
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
    useData: () => ({ refreshCharacterChatVoice: data.refreshCharacterChatVoice }),
}))

vi.mock('@/features/llmProfiles/LlmFeatureControl', () => ({
    LlmFeatureControl: () => null,
}))

vi.mock('@/shared/voiceFeatureFlag', () => ({
    isFrontendVoiceModeEnabled: () => true,
}))

const caps = (body: unknown) => toVoiceCapabilities(body) as VoiceCapabilities
const ava: EffectiveVoice = { voice_key: 'el:ava', display_name: 'Ava', provider_route: 'elevenlabs', substitution_reason: 'voice_removed', badges: [] }

function renderCall(archived = false) {
    const workspace = createWorkspaceTestState({
        workspaces: [
            testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
            testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', archived ? { archived_at: '2026-10-02T00:00:00Z' } : {}),
        ],
    })
    const view = render(
        <WorkspaceTestProvider state={workspace}>
            <CallScreen sessionId={7} workspaceId={OTHER_WORKSPACE_ID} onSwitchToText={vi.fn()} />
        </WorkspaceTestProvider>,
    )
    return {
        ...view,
        rerenderCall: () => view.rerender(
            <WorkspaceTestProvider state={workspace}>
                <CallScreen sessionId={7} workspaceId={OTHER_WORKSPACE_ID} onSwitchToText={vi.fn()} />
            </WorkspaceTestProvider>,
        ),
    }
}

beforeAll(() => {
    installVoiceNarrationCopy()
})

beforeEach(() => {
    vi.restoreAllMocks()
    Object.assign(controller, {
        state: 'idle',
        error: null,
        endReason: null,
        assistantText: '',
        audioFormat: null,
        effectiveVoice: null,
        originalVoiceName: null,
        substitutionReason: null,
        replacedVoiceName: null,
    })
    controller.startCall.mockClear()
    data.refreshCharacterChatVoice.mockClear()
})

afterEach(() => {
    vi.useRealTimers()
})

const acceptButton = () => screen.getByRole('button', { name: 'I consent and start call' })

describe('CallScreen consent copy (R1-FE-05; always voice-v2, I-68)', () => {
    it('shows the voice-v2 copy without a version read, and consent is possible at once', async () => {
        const read = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(caps(BFF_EL_PLUS_BODY))
        renderCall()
        expect(await screen.findByText(/spoken by an AI voice generated by ElevenLabs/)).toBeInTheDocument()
        expect(acceptButton()).toBeEnabled()
        expect(read).not.toHaveBeenCalledWith({ fresh: true })
        // Consent is saved by the controller: accepting only starts the call.
        fireEvent.click(acceptButton())
        await waitFor(() => expect(controller.startCall).toHaveBeenCalledTimes(1))
    })

    it('shows the voice-v2 copy to every caller, a Free plan included', async () => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(caps(BFF_R0_BODY))
        renderCall()
        expect(await screen.findByText(/spoken by an AI voice generated by ElevenLabs/)).toBeInTheDocument()
        expect(acceptButton()).toBeEnabled()
    })

    it('shows the voice-v2 copy when the capabilities read fails or never answers', async () => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockRejectedValue(new Error('offline'))
        const failed = renderCall()
        expect(await screen.findByText(/spoken by an AI voice generated by ElevenLabs/)).toBeInTheDocument()
        expect(acceptButton()).toBeEnabled()
        failed.unmount()

        vi.spyOn(apiService, 'getVoiceCapabilities').mockImplementation(() => new Promise<VoiceCapabilities>(() => undefined))
        renderCall()
        expect(screen.getByText(/spoken by an AI voice generated by ElevenLabs/)).toBeInTheDocument()
        expect(acceptButton()).toBeEnabled()
    })

    it('reopens the consent in its review state on consent_stale (a stored older consent)', async () => {
        const read = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(caps(BFF_EL_PLUS_BODY))
        const view = renderCall()
        fireEvent.click(acceptButton())
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

        Object.assign(controller, { state: 'error', error: { category: 'consent_stale', code: 'VOICE_CONSENT_STALE', message: 'stale', fatal: true } })
        act(() => view.rerenderCall())
        expect(await screen.findByRole('dialog', { name: 'Review voice consent' })).toBeInTheDocument()
        expect(screen.getByText(/spoken by an AI voice generated by ElevenLabs/)).toBeInTheDocument()
        expect(acceptButton()).toBeEnabled()
        expect(read).not.toHaveBeenCalledWith({ fresh: true })
    })
})

describe('CallScreen voice note and refresh (R1-FE-05)', () => {
    beforeEach(() => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(caps(BFF_EL_PLUS_BODY))
    })

    it('refreshes a replaced voice through the data layer, on the chat’s workspace client, after the call', async () => {
        Object.assign(controller, { state: 'ended', endReason: 'user', audioFormat: { content_type: 'audio/mpeg' }, effectiveVoice: ava, originalVoiceName: 'Mia' })
        renderCall()
        fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))
        expect(screen.getByTestId('call-voice-note')).toHaveTextContent('Voice replaced: Ava')
        fireEvent.click(screen.getByRole('button', { name: 'Use the card’s current voice' }))
        // DataProvider upserts the returned chat, so the text chat shows the new voice.
        await waitFor(() => expect(data.refreshCharacterChatVoice).toHaveBeenCalledTimes(1))
        const [chatId, api] = data.refreshCharacterChatVoice.mock.calls[0]
        expect(chatId).toBe('7')
        expect((api as { workspaceScope?: { workspaceId: string } }).workspaceScope?.workspaceId).toBe(OTHER_WORKSPACE_ID)
    })

    it('labels a mid-call swap without naming the voice that went away', async () => {
        Object.assign(controller, {
            state: 'listening',
            audioFormat: { content_type: 'audio/mpeg' },
            effectiveVoice: { ...ava, substitution_reason: null },
            substitutionReason: 'voice_unavailable',
        })
        renderCall()
        const note = await screen.findByTestId('call-voice-note')
        expect(note).toHaveTextContent(/^Voice replaced$/)
        expect(note).toHaveAttribute('title', 'The chosen voice isn’t available, so a similar voice is used.')
    })

    it('names the substitute the chunks name after a mid-call swap (R1-BE-04)', async () => {
        Object.assign(controller, {
            state: 'listening',
            audioFormat: { content_type: 'audio/mpeg' },
            effectiveVoice: ava,
            originalVoiceName: 'Mia',
            substitutionReason: 'voice_unavailable',
            replacedVoiceName: 'Other',
        })
        renderCall()
        const note = await screen.findByTestId('call-voice-note')
        expect(note).toHaveTextContent(/^Voice replaced: Other$/)
        expect(note).toHaveAttribute('title', 'Mia isn’t available; using Other')
    })

    it('offers no refresh in an archived workspace', async () => {
        Object.assign(controller, { state: 'ended', endReason: 'user', audioFormat: { content_type: 'audio/mpeg' }, effectiveVoice: ava, originalVoiceName: 'Mia' })
        renderCall(true)
        expect(await screen.findByTestId('call-voice-note')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Use the card’s current voice' })).toBeNull()
    })

    it('shows no voice note without an effective voice and still strips the captions', async () => {
        Object.assign(controller, { state: 'assistant_speaking', assistantText: 'Hi <#0.5#> there', substitutionReason: 'voice_unavailable' })
        renderCall()
        expect(await screen.findByText(/Hi there/)).toBeInTheDocument()
        expect(screen.queryByText(/<#0\.5#>/)).toBeNull()
        expect(screen.queryByTestId('call-voice-note')).toBeNull()
    })

    it('strips markup from the captions', async () => {
        Object.assign(controller, { state: 'assistant_speaking', assistantText: 'Hi <#0.5#> there', audioFormat: { content_type: 'audio/mpeg' }, effectiveVoice: { ...ava, substitution_reason: null } })
        renderCall()
        expect(await screen.findByText(/Hi there/)).toBeInTheDocument()
        expect(screen.queryByTestId('call-voice-note')).toBeNull()
    })
})
