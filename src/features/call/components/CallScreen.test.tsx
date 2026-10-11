import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VoiceCallState } from '@/shared/types/voice.types'
import { CallScreenView, type CallScreenViewProps } from './CallScreen'

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
