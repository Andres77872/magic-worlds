import { fireEvent, render, screen } from '@testing-library/react'
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
        vadActive: true,
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
        render(
            <CallScreenView
                {...baseProps({
                    state: 'error',
                    error: { category: 'provider_submission', code: 'VOICE_PROVIDER_SUBMISSION', message: 'raw secret leak', fatal: false },
                })}
            />,
        )

        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent(/voice provider could not complete/i)
        expect(alert).toHaveTextContent('VOICE_PROVIDER_SUBMISSION')
        // The raw provider message (which may carry secrets) is never shown.
        expect(alert).not.toHaveTextContent('raw secret leak')
    })

    it('warns when voice detection is degraded', () => {
        render(<CallScreenView {...baseProps({ vadActive: false })} />)
        expect(screen.getByText(/voice detection is degraded/i)).toBeInTheDocument()
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
