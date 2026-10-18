import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import type { VoiceCallState } from '@/shared/types/voice.types'
import { installVoiceNarrationCopy } from '@/test-utils/voiceNarrationCopy'
import { CallScreenView, type CallScreenViewProps } from './CallScreen'
import type { LiveTranscriptLine } from '../liveTranscript'

function baseProps(overrides: Partial<CallScreenViewProps> = {}): CallScreenViewProps {
    return {
        name: 'Lyra',
        imageUrl: null,
        state: 'listening' as VoiceCallState,
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

describe('CallScreenView', () => {
    it('shows the character identity and the state-driven status label', () => {
        render(<CallScreenView {...baseProps({ state: 'listening' })} />)

        expect(screen.getByRole('heading', { name: 'Lyra' })).toBeInTheDocument()
        expect(screen.getByText('Listening')).toBeInTheDocument()
        // Timer is shown while the call is active.
        expect(screen.getByText('0:00')).toBeInTheDocument()
    })

    it('labels the call header as an AI voice (D26 item 7), during and after the call', () => {
        const { rerender } = render(<CallScreenView {...baseProps({ state: 'assistant_speaking' })} />)
        expect(screen.getByTestId('call-ai-voice')).toHaveTextContent('AI voice')

        rerender(<CallScreenView {...baseProps({ state: 'ended', endReason: 'user' })} />)
        expect(screen.getByTestId('call-ai-voice')).toHaveTextContent('AI voice')
    })

    it.each([
        ['voice_unavailable', /voice can’t take calls right now/i],
        ['moderation_unavailable', /briefly unavailable/i],
    ] as const)('explains a tts_unavailable voice_error by its %s code, not as a provider failure', (code, copy) => {
        render(<CallScreenView {...baseProps({ state: 'listening', error: { category: 'tts_unavailable', code, message: 'raw', fatal: false } })} />)

        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent(copy)
        expect(alert).not.toHaveTextContent(/voice provider could not complete/i)
    })

    it('shows the call setup in the start dialog and holds the start until it is ready', () => {
        const onAcceptConsent = vi.fn()
        const setup = <section data-testid="call-setup">setup</section>
        const { rerender } = render(<CallScreenView {...baseProps({ state: 'idle', consentOpen: true, setup, setupBlocked: true, onAcceptConsent })} />)

        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByTestId('call-setup')).toBeInTheDocument()
        const start = within(dialog).getByRole('button', { name: /consent and start/i })
        expect(start).toBeDisabled()

        rerender(<CallScreenView {...baseProps({ state: 'idle', consentOpen: true, setup, setupBlocked: false, onAcceptConsent })} />)
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /consent and start/i }))
        expect(onAcceptConsent).toHaveBeenCalledTimes(1)
    })

    it.each(['voice_unavailable', 'call_model_unavailable'])('leads a %s refusal to the call settings instead of a redial', (code) => {
        const onOpenSetup = vi.fn()
        render(<CallScreenView {...baseProps({
            state: 'error',
            error: { category: 'provider_submission', code, message: 'raw', fatal: true },
            setup: <section>setup</section>,
            onOpenSetup,
            onCallAgain: vi.fn(),
        })} />)

        expect(screen.queryByRole('button', { name: 'Call again' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Call settings' }))
        expect(onOpenSetup).toHaveBeenCalledTimes(1)
    })

    it('offers both a redial and the call settings after an ordinary end', () => {
        render(<CallScreenView {...baseProps({ state: 'ended', endReason: 'user', setup: <section>setup</section>, onOpenSetup: vi.fn(), onCallAgain: vi.fn() })} />)

        expect(screen.getByRole('button', { name: 'Call again' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Call settings' })).toBeInTheDocument()
    })

    it('renders live captions for both the character and the user', () => {
        render(<CallScreenView {...baseProps({ state: 'assistant_speaking', assistantText: 'Welcome back.', transcript: 'Hello there.' })} />)

        expect(screen.getByText('Speaking')).toBeInTheDocument()
        expect(screen.getByText(/Welcome back\./)).toBeInTheDocument()
        expect(screen.getByText(/Hello there\./)).toBeInTheDocument()
    })

    it('only offers Interrupt while the character is speaking', () => {
        const onBargeIn = vi.fn()
        const { rerender } = render(<CallScreenView {...baseProps({ state: 'listening', onBargeIn })} />)
        expect(screen.queryByRole('button', { name: 'Interrupt' })).not.toBeInTheDocument()

        rerender(<CallScreenView {...baseProps({ state: 'assistant_speaking', onBargeIn })} />)
        fireEvent.click(screen.getByRole('button', { name: 'Interrupt' }))
        expect(onBargeIn).toHaveBeenCalledTimes(1)
    })

    it('toggles mute and disables it when the call is not active', () => {
        const onMute = vi.fn()
        const onUnmute = vi.fn()
        const { rerender } = render(<CallScreenView {...baseProps({ state: 'listening', isMuted: false, onMute, onUnmute })} />)

        fireEvent.click(screen.getByRole('button', { name: 'Mute microphone' }))
        expect(onMute).toHaveBeenCalledTimes(1)

        rerender(<CallScreenView {...baseProps({ state: 'listening', isMuted: true, onMute, onUnmute })} />)
        fireEvent.click(screen.getByRole('button', { name: 'Unmute microphone' }))
        expect(onUnmute).toHaveBeenCalledTimes(1)

        rerender(<CallScreenView {...baseProps({ state: 'idle', isMuted: false, onMute, onUnmute })} />)
        expect(screen.getByRole('button', { name: 'Mute microphone' })).toBeDisabled()
    })

    it('ends the call and switches to text through the controls', () => {
        const onEnd = vi.fn()
        const onSwitchToText = vi.fn()
        render(<CallScreenView {...baseProps({ onEnd, onSwitchToText })} />)

        fireEvent.click(screen.getByRole('button', { name: 'End call' }))
        expect(onEnd).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByRole('button', { name: /switch to text/i }))
        expect(onSwitchToText).toHaveBeenCalledTimes(1)
    })

    it('surfaces a traceable error code alongside the human copy', () => {
        const onDismissError = vi.fn()
        render(
            <CallScreenView
                {...baseProps({
                    state: 'listening',
                    error: { category: 'provider_submission', code: 'VOICE_PROVIDER_SUBMISSION', message: 'raw secret leak', fatal: false },
                    onDismissError,
                })}
            />,
        )

        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent(/voice provider could not complete/i)
        expect(alert).toHaveTextContent('VOICE_PROVIDER_SUBMISSION')
        // The raw provider message (which may carry secrets) is never shown.
        expect(alert).not.toHaveTextContent('raw secret leak')
        // A transient notice keeps the call controls and can be dismissed.
        expect(screen.getByRole('button', { name: 'Mute microphone' })).toBeEnabled()
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
        expect(onDismissError).toHaveBeenCalledTimes(1)
    })

    it('never shows raw rejection codes for a rejected segment', () => {
        render(<CallScreenView {...baseProps({ error: { category: 'unsupported_media', code: 'VOICE_SEGMENT_UNSUPPORTED_MEDIA', message: 'call_not_active', fatal: false } })} />)
        expect(screen.getByRole('alert')).toHaveTextContent(/could not be processed/i)
        expect(screen.getByRole('alert')).not.toHaveTextContent('call_not_active')
    })

    it.each([
        ['quota', /used all of your voice time/i],
        ['idle_timeout', /after a long silence/i],
        ['max_duration', /maximum length/i],
        ['disconnected', /connection dropped/i],
        ['superseded', /another tab or device/i],
    ] as const)('explains a call ended with reason %s and offers to call again', (endReason, copy) => {
        const onCallAgain = vi.fn()
        const onSwitchToText = vi.fn()
        render(<CallScreenView {...baseProps({ state: 'ended', endReason, onCallAgain, onSwitchToText })} />)

        const panel = screen.getByRole('status')
        expect(within(panel).getByText('Call ended')).toBeInTheDocument()
        expect(within(panel).getByText(copy)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Mute microphone' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Call again' }))
        expect(onCallAgain).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByRole('button', { name: 'Back to chat' }))
        expect(onSwitchToText).toHaveBeenCalledTimes(1)
    })

    it('shows a fatal error on the end panel with its code', () => {
        render(<CallScreenView {...baseProps({ state: 'error', error: { category: 'internal', code: 'VOICE_CONNECTION_LOST', message: 'lost', fatal: true } })} />)
        expect(screen.getByText(/connection was lost/i)).toBeInTheDocument()
        expect(screen.getByText('VOICE_CONNECTION_LOST')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'End call' })).not.toBeInTheDocument()
    })

    it('warns in the final minute of the call', () => {
        const { rerender } = render(<CallScreenView {...baseProps({ elapsedSeconds: 500, remainingSeconds: 100 })} />)
        expect(screen.queryByText(/left$/)).not.toBeInTheDocument()
        rerender(<CallScreenView {...baseProps({ elapsedSeconds: 552, remainingSeconds: 48 })} />)
        expect(screen.getByText('0:48 left')).toBeInTheDocument()
    })

    it('offers a tap-to-listen fallback when autoplay is blocked', () => {
        const onResumePlayback = vi.fn()
        render(<CallScreenView {...baseProps({ state: 'assistant_speaking', autoplayBlocked: true, onResumePlayback })} />)
        fireEvent.click(screen.getByRole('button', { name: 'Tap to hear Lyra' }))
        expect(onResumePlayback).toHaveBeenCalledTimes(1)
    })

    it('suggests headphones when echo cancellation is off', () => {
        render(<CallScreenView {...baseProps({ echoCancellationOff: true })} />)
        expect(screen.getByText(/use headphones/i)).toBeInTheDocument()
    })

    it('gates on the consent modal and runs the accept handler', () => {
        const onAcceptConsent = vi.fn()
        render(<CallScreenView {...baseProps({ state: 'idle', consentOpen: true, onAcceptConsent })} />)

        // Before consent the status reads as "Calling <name>…".
        expect(screen.getByText('Calling Lyra…')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'I consent and start call' }))
        expect(onAcceptConsent).toHaveBeenCalledTimes(1)
    })
})

describe('CallScreenView R1 voice UX (R1-FE-05)', () => {
    beforeAll(() => {
        installVoiceNarrationCopy()
    })

    it('shows the call voice next to the AI voice badge (P-10)', () => {
        render(<CallScreenView {...baseProps({ state: 'assistant_speaking', voiceNote: { kind: 'call_voice', name: 'Ava' } })} />)
        expect(screen.getByTestId('call-ai-voice')).toHaveTextContent('AI voice')
        const note = screen.getByTestId('call-voice-note')
        expect(note).toHaveTextContent('Call voice: Ava')
        expect(note).toHaveAttribute('title', 'This character’s voice isn’t available in calls.')
    })

    it('shows a replaced voice with its tooltip', () => {
        render(<CallScreenView {...baseProps({ voiceNote: { kind: 'replaced', name: 'Ava', original: 'Mia' } })} />)
        const note = screen.getByTestId('call-voice-note')
        expect(note).toHaveTextContent('Voice replaced: Ava')
        expect(note).toHaveAttribute('title', 'Mia isn’t available; using Ava')
    })

    it('shows no voice note when the call speaks with the card’s own voice', () => {
        render(<CallScreenView {...baseProps({ state: 'assistant_speaking' })} />)
        expect(screen.getByTestId('call-ai-voice')).toBeInTheDocument()
        expect(screen.queryByTestId('call-voice-note')).toBeNull()
    })

    it('offers the voice refresh on the end panel only once the call is over', async () => {
        const onRefreshVoice = vi.fn(async () => ({}))
        const note = { kind: 'replaced' as const, name: 'Ava', original: 'Mia' }
        const { rerender } = render(<CallScreenView {...baseProps({ state: 'listening', voiceNote: note, onRefreshVoice })} />)
        expect(screen.queryByTestId('call-voice-refresh')).toBeNull()

        rerender(<CallScreenView {...baseProps({ state: 'ended', endReason: 'user', voiceNote: note, onRefreshVoice })} />)
        expect(screen.getByText('Applies from your next call.')).toBeInTheDocument()
        const button = screen.getByRole('button', { name: 'Use the card’s current voice' })
        fireEvent.click(button)
        expect(onRefreshVoice).toHaveBeenCalledTimes(1)
        // Disabled while busy and once done: wait for the done state, not just the disable.
        await waitFor(() => {
            expect(button).toBeDisabled()
            expect(screen.getByText('Applies from your next call.')).toBeInTheDocument()
            expect(screen.queryByText('Updating voice…')).toBeNull()
        })
    })

    it('shows the refusal copy when the refresh is refused', async () => {
        const onRefreshVoice = vi.fn(async () => { throw new ApiError(409, 'busy', { code: 'voice_refresh_busy' }) })
        render(<CallScreenView {...baseProps({ state: 'ended', endReason: 'user', voiceNote: { kind: 'replaced', name: 'Ava', original: null }, onRefreshVoice })} />)
        fireEvent.click(screen.getByRole('button', { name: 'Use the card’s current voice' }))
        expect(await screen.findByText('Finish the current reply or call first.')).toBeInTheDocument()
    })

    it('offers no refresh without the handler (read-only) and points a call voice at the card', () => {
        const { rerender } = render(<CallScreenView {...baseProps({ state: 'ended', endReason: 'user', voiceNote: { kind: 'replaced', name: 'Ava', original: null } })} />)
        expect(screen.queryByTestId('call-voice-refresh')).toBeNull()
        rerender(<CallScreenView {...baseProps({ state: 'ended', endReason: 'user', voiceNote: { kind: 'call_voice', name: 'Ava' }, onRefreshVoice: vi.fn() })} />)
        expect(screen.queryByTestId('call-voice-refresh')).toBeNull()
        expect(screen.getByTestId('call-pick-call-ready')).toHaveTextContent('Pick a call-ready voice on the character card.')
    })

    it('always strips speech markup from the live captions, a token cut mid-way included', () => {
        const assistantText = 'Well <#0.5#> fine (sighs). Then (lau'
        render(<CallScreenView {...baseProps({ state: 'assistant_speaking', assistantText })} />)
        expect(screen.getByText(/Well fine\. Then$/)).toBeInTheDocument()
        expect(screen.queryByText(/<#/)).toBeNull()
    })

    it('says when a reply’s audio could not play', () => {
        render(<CallScreenView {...baseProps({ state: 'listening', audioUnsupported: true })} />)
        expect(screen.getByTestId('call-audio-unsupported')).toHaveTextContent('This reply’s audio couldn’t play. The text is shown instead.')
    })

    it('shows the voice-v2 consent copy with consent possible at once', () => {
        render(<CallScreenView {...baseProps({ consentOpen: true })} />)
        expect(screen.getByText(/spoken by an AI voice generated by ElevenLabs/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'I consent and start call' })).toBeEnabled()
    })
})

describe('CallScreenView redial after a terminal voice refusal (R1/R2)', () => {
    const callAgain = () => screen.queryByRole('button', { name: 'Call again' })

    it.each([
        ['error', 'voice_safety_pause'],
        ['error', 'voice_region_unavailable'],
        ['ended', 'voice_safety_pause'],
        ['ended', 'voice_region_unavailable'],
    ] as const)('hides the redial in the %s state for %s', (state, code) => {
        render(<CallScreenView {...baseProps({ state, endReason: state === 'ended' ? 'disconnected' : null, error: { category: 'tts_unavailable', code, message: 'raw', fatal: true }, onCallAgain: vi.fn() })} />)
        expect(screen.getByRole('button', { name: 'Back to chat' })).toBeInTheDocument()
        expect(callAgain()).toBeNull()
    })

    it('hides the redial for a voice_restricted end', () => {
        render(<CallScreenView {...baseProps({ state: 'ended', endReason: 'voice_restricted', onCallAgain: vi.fn() })} />)
        expect(screen.getByRole('button', { name: 'Back to chat' })).toBeInTheDocument()
        expect(callAgain()).toBeNull()
    })

    it.each(['user', 'idle_timeout'] as const)('keeps the redial for a %s end (R0 unchanged)', (endReason) => {
        const onCallAgain = vi.fn()
        render(<CallScreenView {...baseProps({ state: 'ended', endReason, onCallAgain })} />)
        fireEvent.click(screen.getByRole('button', { name: 'Call again' }))
        expect(onCallAgain).toHaveBeenCalledTimes(1)
    })

    it('keeps the redial for a generic error (R0 unchanged)', () => {
        render(<CallScreenView {...baseProps({ state: 'error', error: { category: 'internal', code: 'VOICE_CONNECTION_LOST', message: 'lost', fatal: true }, onCallAgain: vi.fn() })} />)
        expect(screen.getByRole('button', { name: 'Call again' })).toBeInTheDocument()
    })
})

describe('CallScreenView live transcript', () => {
    const line = (role: 'user' | 'assistant', turnId: string, text: string, extra: Partial<LiveTranscriptLine> = {}): LiveTranscriptLine => ({
        id: `${role}:${turnId}`, turnId, role, text, streaming: false, interrupted: false, ...extra,
    })
    const conversation = [
        line('user', 't1', 'Who are you?'),
        line('assistant', 't1', 'A keeper of maps (laughs).'),
        line('user', 't2', 'Show me the road.'),
        line('assistant', 't2', 'The northern', { interrupted: true }),
    ]

    it('captions the last exchange in order, user first, without speech markup', () => {
        render(<CallScreenView {...baseProps({ state: 'listening', transcriptLines: conversation })} />)
        const captions = screen.getByTestId('call-captions')
        const texts = within(captions).getAllByText(/road|northern/).map((node) => node.textContent)
        expect(texts[0]).toContain('Show me the road.')
        expect(texts[1]).toContain('The northern')
        expect(captions).toHaveTextContent('(interrupted)')
        expect(captions).not.toHaveTextContent('Who are you?')
    })

    it('opens the whole transcript from the header and announces complete lines only', () => {
        const streaming = [...conversation, line('assistant', 't3', 'Partial rep', { streaming: true })]
        render(<CallScreenView {...baseProps({ state: 'assistant_thinking', transcriptLines: streaming })} />)
        expect(screen.queryByTestId('call-live-transcript')).toBeNull()

        const toggle = screen.getByRole('button', { name: 'Show transcript' })
        fireEvent.click(toggle)
        const panel = screen.getByTestId('call-live-transcript')
        expect(screen.getByRole('button', { name: 'Hide transcript' })).toHaveAttribute('aria-pressed', 'true')
        const log = within(panel).getByRole('log')
        expect(within(log).getAllByRole('listitem')).toHaveLength(5)
        expect(log).toHaveTextContent('A keeper of maps.')
        expect(log).not.toHaveTextContent('(laughs)')
        // The live region reads the newest complete line, never the streaming reply.
        expect(screen.getByTestId('call-live-announcement')).toHaveTextContent('Lyra: The northern')
    })

    it('invites the user to speak first on a fresh call', () => {
        render(<CallScreenView {...baseProps({ state: 'listening', transcriptLines: [] })} />)
        expect(screen.getByTestId('call-first-turn-hint')).toHaveTextContent('Lyra is listening')
    })

    it('offers the transcript on the end panel once the call is over', () => {
        render(<CallScreenView {...baseProps({ state: 'ended', endReason: 'user', transcriptLines: conversation })} />)
        // The header toggle and the end panel both offer it; the end panel's is the labelled button.
        const buttons = screen.getAllByRole('button', { name: 'Show transcript' })
        expect(buttons).toHaveLength(2)
        fireEvent.click(buttons[1])
        expect(screen.getByTestId('call-live-transcript')).toBeInTheDocument()
    })

    it('toggles the microphone with M during a call, but not while typing', () => {
        const onMute = vi.fn()
        const onUnmute = vi.fn()
        const { rerender } = render(<CallScreenView {...baseProps({ state: 'listening', onMute, onUnmute })} />)
        fireEvent.keyDown(document.body, { key: 'm' })
        expect(onMute).toHaveBeenCalledTimes(1)
        rerender(<CallScreenView {...baseProps({ state: 'listening', isMuted: true, onMute, onUnmute })} />)
        fireEvent.keyDown(document.body, { key: 'M' })
        expect(onUnmute).toHaveBeenCalledTimes(1)
        const input = document.createElement('input')
        document.body.appendChild(input)
        fireEvent.keyDown(input, { key: 'm' })
        expect(onUnmute).toHaveBeenCalledTimes(1)
        input.remove()
        rerender(<CallScreenView {...baseProps({ state: 'ended', onMute, onUnmute })} />)
        fireEvent.keyDown(document.body, { key: 'm' })
        expect(onMute).toHaveBeenCalledTimes(1)
    })
})
