import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
/**
 * R2-BE-01 on the call screen (09 §4.7; 13 §2.7):
 * - a `voice_safety_pause` shows the crisis-resources panel (the approved generic
 *   lines), never for any other error, and offers no redial;
 * - the break nudge is mounted with `readSafeguards(capabilities).break_nudge_minutes`:
 *   it appears after that much call time, and never when the safeguards set no
 *   interval (the default) or the capabilities carry none (R-19).
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '@/infrastructure/api'
import type { VoiceCapabilities } from '@/shared/types'
import type { VoiceCallState } from '@/shared/types/voice.types'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_EL_PLUS_BODY, BFF_R0_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { CallScreen, CallScreenView, type CallScreenViewProps } from './CallScreen'

const controller = vi.hoisted(() => ({ state: 'idle' as VoiceCallState }))

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
        audioFormat: null,
        effectiveVoice: null,
        originalVoiceName: null,
        substitutionReason: null,
        audioUnsupported: false,
        startCall: vi.fn(async () => true),
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

vi.mock('@/features/llmProfiles/LlmFeatureControl', () => ({ LlmFeatureControl: () => null }))
vi.mock('@/shared/voiceFeatureFlag', () => ({ isFrontendVoiceModeEnabled: () => true }))

const MINUTE = 60_000
/** A capabilities body without the safeguards key (an older BFF build): every safeguard off. */
const WITHOUT_SAFEGUARDS: Record<string, unknown> = { ...BFF_R0_BODY }
delete WITHOUT_SAFEGUARDS.safeguards
const PAUSED = 'Voice is paused for now. Text chat keeps working.'
const EMERGENCY = /contact your local emergency services now/

function baseProps(overrides: Partial<CallScreenViewProps> = {}): CallScreenViewProps {
    return {
        name: 'Lyra',
        imageUrl: null,
        state: 'listening',
        isMuted: false,
        elapsedSeconds: 0,
        inputLevel: 0,
        transcript: null,
        assistantText: '',
        error: null,
        consentOpen: false,
        isAccepting: false,
        onAcceptConsent: vi.fn(),
        onDeclineConsent: vi.fn(),
        onMute: vi.fn(),
        onUnmute: vi.fn(),
        onBargeIn: vi.fn(),
        onEnd: vi.fn(),
        onSwitchToText: vi.fn(),
        ...overrides,
    }
}

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('CallScreenView crisis resources (09 §4.7)', () => {
    it('shows the crisis-resources panel when a safety pause ends the call, with no redial', () => {
        render(
            <CallScreenView
                {...baseProps({
                    state: 'error',
                    error: { category: 'disabled', code: 'voice_safety_pause', message: 'raw', fatal: true, retryAfterSeconds: 600 },
                    onCallAgain: vi.fn(),
                })}
            />,
        )
        const panel = screen.getByTestId('call-safety-pause')
        expect(panel).toHaveTextContent(PAUSED)
        expect(panel).toHaveTextContent('Voice comes back in about 10 minutes.')
        expect(panel).toHaveTextContent(EMERGENCY)
        expect(panel).not.toHaveTextContent('raw')
        expect(screen.queryByRole('button', { name: 'Call again' })).toBeNull()
    })

    it.each([
        ['a generic failure', { category: 'internal', code: 'X', message: 'raw', fatal: true }],
        ['the region block', { category: 'disabled', code: 'voice_region_unavailable', message: 'raw', fatal: true }],
        ['a voice error', { category: 'tts_unavailable', code: 'voice_unavailable', message: 'raw', fatal: false }],
    ] as const)('shows no crisis panel for %s', (_name, error) => {
        render(<CallScreenView {...baseProps({ state: 'error', error })} />)
        expect(screen.queryByTestId('call-safety-pause')).toBeNull()
        expect(screen.queryByText(EMERGENCY)).toBeNull()
    })
})

describe('CallScreenView break nudge mount', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    it('appears after the interval of live call time and dismisses without ending the call', () => {
        const onEnd = vi.fn()
        render(<CallScreenView {...baseProps({ state: 'listening', breakNudgeMinutes: 30, onEnd })} />)
        act(() => vi.advanceTimersByTime(29 * MINUTE))
        expect(screen.queryByTestId('break-nudge')).toBeNull()
        act(() => vi.advanceTimersByTime(MINUTE))
        expect(screen.getByTestId('break-nudge')).toHaveTextContent('Time for a break?')
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
        expect(screen.queryByTestId('break-nudge')).toBeNull()
        expect(onEnd).not.toHaveBeenCalled()
    })

    it('never appears without an interval or outside a live call', () => {
        const { unmount } = render(<CallScreenView {...baseProps({ state: 'listening', breakNudgeMinutes: null })} />)
        act(() => vi.advanceTimersByTime(24 * 60 * MINUTE))
        expect(screen.queryByTestId('break-nudge')).toBeNull()
        unmount()
        render(<CallScreenView {...baseProps({ state: 'idle', breakNudgeMinutes: 30 })} />)
        act(() => vi.advanceTimersByTime(60 * MINUTE))
        expect(screen.queryByTestId('break-nudge')).toBeNull()
    })
})

describe('CallScreen break nudge from the capabilities safeguards (R2-BE-01)', () => {
    const caps = (body: unknown) => toVoiceCapabilities(body) as VoiceCapabilities

    function renderCall() {
        const workspace = createWorkspaceTestState({
            workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library'), testWorkspace(OTHER_WORKSPACE_ID, 'Novel A')],
        })
        return render(
            <WorkspaceTestProvider state={workspace}>
                <CallScreen sessionId={7} workspaceId={OTHER_WORKSPACE_ID} onSwitchToText={vi.fn()} />
            </WorkspaceTestProvider>,
        )
    }

    async function settle(ms = 0) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(ms)
        })
    }

    beforeEach(() => {
        vi.useFakeTimers()
        controller.state = 'listening'
    })

    it('nudges after break_nudge_minutes of a live call', async () => {
        const body = { ...BFF_EL_PLUS_BODY, safeguards: { ...BFF_EL_PLUS_BODY.safeguards, break_nudge_minutes: 20 } }
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(caps(body))
        renderCall()
        await settle()
        await settle(19 * MINUTE)
        expect(screen.queryByTestId('break-nudge')).toBeNull()
        await settle(MINUTE)
        expect(screen.getByTestId('break-nudge')).toBeInTheDocument()
    })

    it.each([
        ['the default safeguards (all off)', BFF_R0_BODY],
        ['capabilities without a safeguards key', WITHOUT_SAFEGUARDS],
        ['a Plus plan with no interval', BFF_EL_PLUS_BODY],
    ] as const)('never nudges for %s', async (_name, body) => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(caps(body))
        renderCall()
        await settle()
        await settle(8 * 60 * MINUTE)
        expect(screen.queryByTestId('break-nudge')).toBeNull()
    })
})
