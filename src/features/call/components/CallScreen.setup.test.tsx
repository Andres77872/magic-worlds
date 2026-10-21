import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character, CharacterVoiceV2, CharacterVoiceV3, StoredCharacterVoice, VoiceCapabilities } from '@/shared/types'
import type { VoiceCallState } from '@/shared/types/voice.types'
import { apiService } from '@/infrastructure/api'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_EL_PLUS_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import { createWorkspaceTestState, TEST_WORKSPACE_ID, testWorkspace, WorkspaceTestProvider } from '@/shared/hooks/testing/workspaceTestUtils'
import { installVoiceNarrationCopy } from '@/test-utils/voiceNarrationCopy'
import { readCallVoicePick } from '../callVoicePick'
import { CallScreen } from './CallScreen'

const controller = vi.hoisted(() => ({
    state: 'idle' as VoiceCallState,
    error: null as null | { category: string; code?: string; message: string; fatal?: boolean },
    startCall: vi.fn(async () => true),
    options: null as null | { callVoice?: unknown },
}))
const model = vi.hoisted(() => ({ unassigned: false, disabled: false }))
const picker = vi.hoisted(() => ({ onSelect: null as null | ((voice: StoredCharacterVoice | null) => void) }))

vi.mock('@/features/interaction/hooks/useVoiceCallController', () => ({
    useVoiceCallController: (options: { callVoice?: unknown }) => {
        controller.options = options
        return {
            state: controller.state, isMuted: false, elapsedSeconds: 0, remainingSeconds: null, inputLevel: 0,
            transcript: null, assistantText: '', transcriptLines: [], error: controller.error, endReason: null,
            autoplayBlocked: false, echoCancellationOff: false, audioFormat: null, effectiveVoice: null,
            originalVoiceName: null, substitutionReason: null, replacedVoiceName: null, audioUnsupported: false,
            startCall: controller.startCall, endCall: vi.fn(async () => undefined), resumePlayback: vi.fn(),
            dismissError: vi.fn(), mute: vi.fn(), unmute: vi.fn(), bargeIn: vi.fn(),
        }
    },
}))

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, token: 'token', userHash: 'user-a' }),
    useData: () => ({ refreshCharacterChatVoice: vi.fn() }),
}))

// The callbot control reports whether a conversation model is assigned.
vi.mock('@/features/llmProfiles/LlmFeatureControl', () => ({
    LlmFeatureControl: ({ onUnassignedChange, disabled = false }: { onUnassignedChange?: (unassigned: boolean) => void; disabled?: boolean }) => {
        model.disabled = disabled
        useEffect(() => onUnassignedChange?.(model.unassigned), [onUnassignedChange])
        return <span>{model.unassigned ? 'No model' : 'Haiku'}</span>
    },
}))

vi.mock('@/features/voices/components/VoicePickerDialog', () => ({
    VoicePickerDialog: ({ open, onSelect }: { open: boolean; onSelect: (voice: StoredCharacterVoice | null) => void }) => {
        picker.onSelect = onSelect
        return open ? <div role="dialog" aria-label="Voice picker" /> : null
    },
}))

vi.mock('@/shared/voiceFeatureFlag', () => ({
    isFrontendVoiceModeEnabled: () => true,
}))

const FISH: CharacterVoiceV3 = {
    schema_version: 3, provider: 'fish_audio', voice_key: 'vk_fish', voice_name: 'Marisol',
    settings: null, language_code: 'es', preset_id: null, preset_name: null,
}
const ELEVEN: CharacterVoiceV2 = {
    schema_version: 2, provider: 'elevenlabs', voice_key: 'vk_eleven', voice_name: 'Rowan',
    settings: null, emotion: null, language_code: null, preset_id: null, preset_name: null,
}

function renderCall(voice: StoredCharacterVoice | null) {
    const character = { id: 'char-1', name: 'Lyra', role: 'character', image_url: null, voice } as unknown as Character
    return render(
        <WorkspaceTestProvider state={createWorkspaceTestState({ workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library')] })}>
            <CallScreen character={character} sessionId={7} workspaceId={TEST_WORKSPACE_ID} onSwitchToText={vi.fn()} />
        </WorkspaceTestProvider>,
    )
}

const startButton = () => screen.getByRole('button', { name: 'I consent and start call' })

beforeAll(() => installVoiceNarrationCopy())

beforeEach(() => {
    // ElevenLabs calls are on; Fish has no call surface in this reading (fail closed).
    vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(toVoiceCapabilities(BFF_EL_PLUS_BODY) as VoiceCapabilities)
    Object.assign(controller, { state: 'idle', error: null, options: null })
    controller.startCall.mockClear()
    model.unassigned = false
    model.disabled = false
})

afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
})

describe('CallScreen call setup', () => {
    it('holds a call whose voice cannot take calls until another voice is picked, then sends and remembers it', async () => {
        renderCall(FISH)

        const dialog = screen.getByRole('dialog', { name: /voice call/i })
        expect(within(dialog).getByTestId('call-setup-voice')).toHaveTextContent('Marisol')
        expect(await within(dialog).findByTestId('call-setup-voice-unavailable')).toBeInTheDocument()
        expect(startButton()).toBeDisabled()

        fireEvent.click(within(dialog).getByRole('button', { name: 'Change voice' }))
        act(() => picker.onSelect!(ELEVEN))

        await waitFor(() => expect(startButton()).toBeEnabled())
        expect(screen.getByTestId('call-setup-voice')).toHaveTextContent('Rowan')
        expect(controller.options?.callVoice).toEqual(ELEVEN)
        expect(readCallVoicePick('user-a', 'char-1')).toEqual(ELEVEN)

        fireEvent.click(startButton())
        await waitFor(() => expect(controller.startCall).toHaveBeenCalledTimes(1))
    })

    it('starts the next call with the remembered pick', async () => {
        const first = renderCall(FISH)
        act(() => picker.onSelect!(ELEVEN))
        first.unmount()

        renderCall(FISH)
        expect(screen.getByTestId('call-setup-voice')).toHaveTextContent('Rowan')
        expect(controller.options?.callVoice).toEqual(ELEVEN)
    })

    it('waits for a conversation model before the call can start', async () => {
        model.unassigned = true
        renderCall(ELEVEN)

        expect(await screen.findByText('No model')).toBeInTheDocument()
        await waitFor(() => expect(startButton()).toBeDisabled())
        expect(controller.startCall).not.toHaveBeenCalled()
    })

    it('locks profile changes while the call is starting', async () => {
        let finish!: (started: boolean) => void
        controller.startCall.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve }))
        renderCall(ELEVEN)
        expect(model.disabled).toBe(false)
        fireEvent.click(startButton())
        await waitFor(() => expect(model.disabled).toBe(true))
        await act(async () => { finish(true) })
    })

    it('reopens the setup from the end panel after a refusal it can fix, and "Not now" stays on the call screen', async () => {
        const onSwitchToText = vi.fn()
        const character = { id: 'char-1', name: 'Lyra', role: 'character', image_url: null, voice: ELEVEN } as unknown as Character
        const workspace = createWorkspaceTestState({ workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library')] })
        const view = render(
            <WorkspaceTestProvider state={workspace}>
                <CallScreen character={character} sessionId={7} workspaceId={TEST_WORKSPACE_ID} onSwitchToText={onSwitchToText} />
            </WorkspaceTestProvider>,
        )
        fireEvent.click(startButton())
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

        Object.assign(controller, { state: 'error', error: { category: 'provider_submission', code: 'call_model_unavailable', message: 'raw', fatal: true } })
        view.rerender(
            <WorkspaceTestProvider state={workspace}>
                <CallScreen character={character} sessionId={7} workspaceId={TEST_WORKSPACE_ID} onSwitchToText={onSwitchToText} />
            </WorkspaceTestProvider>,
        )
        expect(screen.queryByRole('button', { name: 'Call again' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Call settings' }))
        expect(within(screen.getByRole('dialog', { name: /voice call/i })).getByTestId('call-setup')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(onSwitchToText).not.toHaveBeenCalled()
    })
})
