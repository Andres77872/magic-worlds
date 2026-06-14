import type { Meta, StoryObj } from '@storybook/react-vite'
import { CallScreenView } from './CallScreen'

const noop = () => {}

const meta = {
    title: 'Features/Call/CallScreen',
    component: CallScreenView,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'The immersive, hands-free voice-call surface. The portrait pulses while listening, glows while the character speaks, and shows a thinking ring between turns. Turn-taking is automatic (VAD) — there is no push-to-talk. These stories drive the pure `CallScreenView`; the live `CallScreen` container wires it to `useVoiceCallController`.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="h-[680px] w-full overflow-hidden rounded-xl border border-parchment-50/10">
                <Story />
            </div>
        ),
    ],
    args: {
        name: 'Lyra Emberwick',
        imageUrl: null,
        state: 'listening',
        isMuted: false,
        elapsedSeconds: 74,
        inputLevel: 0.4,
        vadActive: true,
        transcript: null,
        assistantText: '',
        error: null,
        consentOpen: false,
        isAccepting: false,
        onAcceptConsent: noop,
        onDeclineConsent: noop,
        onMute: noop,
        onUnmute: noop,
        onBargeIn: noop,
        onEnd: noop,
        onSwitchToText: noop,
    },
} satisfies Meta<typeof CallScreenView>

export default meta
type Story = StoryObj<typeof meta>

export const ConsentGate: Story = {
    name: 'Consent gate (entry)',
    args: { state: 'idle', consentOpen: true, elapsedSeconds: 0, inputLevel: 0 },
}

export const Listening: Story = {
    args: { state: 'listening', inputLevel: 0.3, transcript: null },
}

export const UserSpeaking: Story = {
    args: { state: 'user_speaking', inputLevel: 0.78, transcript: 'So what happened after the gate closed?' },
}

export const Thinking: Story = {
    args: { state: 'assistant_thinking', inputLevel: 0.05, transcript: 'So what happened after the gate closed?' },
}

export const CharacterSpeaking: Story = {
    args: {
        state: 'assistant_speaking',
        inputLevel: 0,
        transcript: 'So what happened after the gate closed?',
        assistantText: 'The gate did not close on its own — someone wanted us trapped inside.',
    },
}

export const DegradedVad: Story = {
    name: 'Degraded VAD',
    args: { state: 'listening', vadActive: false },
}

export const ProviderError: Story = {
    args: {
        state: 'error',
        error: { category: 'provider_submission', code: 'VOICE_PROVIDER_SUBMISSION', message: 'provider failed', fatal: false },
    },
}
