import type { Meta, StoryObj } from '@storybook/react-vite'
import { EFFECTIVE_BY_REASON, effectiveVoice } from '@/features/voices/fixtures'
import { V2_VOICE } from '@/features/voices/fixtures'
import { Badge } from '@/ui/primitives'
import { callVoiceNote } from '../callVoiceNote'
import type { LiveTranscriptLine } from '../liveTranscript'
import { CallScreenView } from './CallScreen'
import { CallSetup } from './CallSetup'

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
                    'The immersive, hands-free voice-call surface. The portrait pulses while listening, glows while the character speaks, and shows a thinking ring between turns. Turn-taking is automatic (VAD) — there is no push-to-talk. When the call ends it explains why and offers to call again. The header always labels the voice as AI; on the new voice engine it adds a note when the call speaks with a call voice or a replacement. These stories drive the pure `CallScreenView`; the live `CallScreen` container wires it to `useVoiceCallController`.',
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
        transcript: null,
        assistantText: '',
        error: null,
        consentOpen: false,
        isAccepting: false,
        onAcceptConsent: noop,
        onCallAgain: noop,
        onResumePlayback: noop,
        onDismissError: noop,
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

/** The call setup as the live container passes it (a stand-in replaces the callbot model control). */
function setupFor(options: { voiceUnavailable?: boolean; model?: 'set' | 'missing' } = {}) {
    return (
        <CallSetup
            name="Lyra Emberwick"
            characterVoice={V2_VOICE}
            pick={null}
            onPick={noop}
            voiceUnavailable={options.voiceUnavailable}
            model={options.model === 'missing' ? <Badge tone="danger">Not set up</Badge> : <Badge tone="arcane">Claude Haiku 5.5</Badge>}
        />
    )
}

export const ConsentWithSetup: Story = {
    name: 'Start dialog with the call setup',
    args: { state: 'idle', consentOpen: true, elapsedSeconds: 0, inputLevel: 0, setup: setupFor() },
}

export const SetupBlocksStart: Story = {
    name: 'Start waits for the setup (voice cannot call)',
    args: { state: 'idle', consentOpen: true, elapsedSeconds: 0, inputLevel: 0, setup: setupFor({ voiceUnavailable: true }), setupBlocked: true },
}

export const EndedNoCallModel: Story = {
    name: 'Ended (no conversation model: call settings lead)',
    args: {
        state: 'error',
        inputLevel: 0,
        error: { category: 'provider_submission', code: 'call_model_unavailable', message: 'No conversation model is set up for voice calls.', fatal: true },
        setup: setupFor({ model: 'missing' }),
        onOpenSetup: noop,
    },
}

export const FishDevelopmentConsent: Story = {
    name: 'Fish processing disclosure (development draft)',
    args: { state: 'idle', consentOpen: true, consentVersion: 'voice-v3', elapsedSeconds: 0, inputLevel: 0 },
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

export const NoEchoCancellation: Story = {
    name: 'Echo cancellation off',
    args: { state: 'listening', echoCancellationOff: true },
}

export const AutoplayBlocked: Story = {
    args: { state: 'assistant_speaking', autoplayBlocked: true, assistantText: 'Are you still there? The bells are ringing again.' },
}

export const FinalMinute: Story = {
    name: 'Final minute',
    args: { state: 'listening', elapsedSeconds: 552, remainingSeconds: 48 },
}

export const TransientNotice: Story = {
    name: 'Transient notice',
    args: {
        state: 'listening',
        error: { category: 'unsupported_media', code: 'VOICE_SEGMENT_UNSUPPORTED_MEDIA', message: 'unsupported_media', fatal: false },
    },
}

export const EndedByQuota: Story = {
    name: 'Ended (voice time used)',
    args: { state: 'ended', endReason: 'quota', inputLevel: 0 },
}

export const EndedAfterSilence: Story = {
    name: 'Ended (long silence)',
    args: { state: 'ended', endReason: 'idle_timeout', inputLevel: 0 },
}

export const FatalError: Story = {
    args: {
        state: 'error',
        inputLevel: 0,
        error: { category: 'internal', code: 'VOICE_CONNECTION_LOST', message: 'The voice connection was lost.', fatal: true },
    },
}

const TRANSCRIPT: LiveTranscriptLine[] = [
    { id: 'user:t1', turnId: 't1', role: 'user', text: 'Did you find the letter in the archive?', streaming: false, interrupted: false },
    { id: 'assistant:t1', turnId: 't1', role: 'assistant', text: 'I did. It was folded inside the map case, sealed with green wax.', streaming: false, interrupted: false },
    { id: 'user:t2', turnId: 't2', role: 'user', text: 'What does it say?', streaming: false, interrupted: false },
    { id: 'assistant:t2', turnId: 't2', role: 'assistant', text: 'Only a few lines. Someone wanted us to reach the bell tower before', streaming: false, interrupted: true },
    { id: 'user:t3', turnId: 't3', role: 'user', text: 'Wait, before what?', streaming: false, interrupted: false },
    { id: 'assistant:t3', turnId: 't3', role: 'assistant', text: 'Before the last light fades. That part is underlined twice', streaming: true, interrupted: false },
]

export const TranscriptOpen: Story = {
    name: 'Live transcript (open)',
    args: {
        state: 'assistant_speaking',
        transcriptLines: TRANSCRIPT,
        defaultTranscriptOpen: true,
        transcript: 'Wait, before what?',
        assistantText: 'Before the last light fades. That part is underlined twice',
    },
}

export const EndedWithTranscript: Story = {
    name: 'Ended (transcript available)',
    args: { state: 'ended', endReason: 'user', inputLevel: 0, transcriptLines: TRANSCRIPT.slice(0, 4), setup: setupFor(), onOpenSetup: noop },
}

export const Reconnecting: Story = { args: { state: 'reconnecting', inputLevel: 0 } }
export const Muted: Story = { args: { state: 'listening', isMuted: true, inputLevel: 0 } }
export const LongCaptions: Story = { args: { state: 'assistant_speaking', transcript: 'Tell me everything you found in the archive, including the letter and the map.', assistantText: 'The archive holds an account of the city before the flood. Every street and garden has been carefully marked on the old map. Someone circled the bell tower and wrote a warning beside it: return before the last light fades. I think whoever left that letter expected us to follow the route tonight.' } }

/** The card's own voice is "Eldrin"; the notes below come from the same helper the live container uses. */
const CARD_VOICE = 'Eldrin'

/** Header: the "AI voice" label alone, as on every call that speaks with the card's own voice. */
export const HeaderAiVoice: Story = {
    name: 'Header: AI voice',
    args: { state: 'assistant_speaking', inputLevel: 0, assistantText: 'Come closer. The lantern is the only light left in the archive.', voiceNote: null },
}

/** Header: the card's voice is not call-ready, so the call speaks with a call voice. */
export const HeaderCallVoice: Story = {
    name: 'Header: call voice',
    args: { state: 'listening', voiceNote: callVoiceNote(EFFECTIVE_BY_REASON.not_call_eligible, CARD_VOICE) },
}

/** Header: the card's voice was replaced before the call; the tooltip names both voices. */
export const HeaderVoiceReplaced: Story = {
    name: 'Header: voice replaced',
    args: { state: 'listening', voiceNote: callVoiceNote(EFFECTIVE_BY_REASON.voice_removed, CARD_VOICE) },
}

/** Header: the voice was swapped mid-call; no substitute is named, so the note reads "Voice replaced". */
export const HeaderVoiceReplacedMidCall: Story = {
    name: 'Header: voice replaced mid-call',
    args: {
        state: 'assistant_speaking',
        inputLevel: 0,
        assistantText: 'Forgive the change in my voice. The storm is loud tonight.',
        voiceNote: callVoiceNote(effectiveVoice({ display_name: CARD_VOICE }), CARD_VOICE, 'voice_unavailable'),
    },
}

/** Ended with a replaced voice: the end panel offers the card's current voice for the next call. */
export const EndedVoiceReplaced: Story = {
    name: 'Ended (voice replaced)',
    args: {
        state: 'ended',
        endReason: 'user',
        inputLevel: 0,
        voiceNote: callVoiceNote(EFFECTIVE_BY_REASON.voice_removed, CARD_VOICE),
        onRefreshVoice: async () => {},
    },
}

/** Ended on a call voice: the end panel suggests picking a call-ready voice. */
export const EndedCallVoice: Story = {
    name: 'Ended (call voice)',
    args: { state: 'ended', endReason: 'user', inputLevel: 0, voiceNote: callVoiceNote(EFFECTIVE_BY_REASON.not_call_eligible, CARD_VOICE) },
}
