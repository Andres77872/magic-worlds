import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { StoredConversationMessage, TurnEntry } from '@/shared'
import { storedMessagesToTurns } from '../chatSessionConfig'
import { CallDivider } from '../components/CallDivider'
import { ChatTurn } from '../components/ChatTurn'
import { mergeHydratedTtsTurns } from './chatTtsTurnState'
import { narrationErrorKey } from './narrationQueue'
import { buildCallTranscriptHash, readCallIdFromLocation } from '@/features/call/callLinks'

vi.mock('@/infrastructure/api/useAuthenticatedMediaUrl', () => ({
    useAuthenticatedMediaUrl: (url?: string | null) => ({
        src: url ? `blob:${url}` : undefined,
        loading: false,
        error: null,
        retry: vi.fn(),
    }),
}))

describe('call-to-chat integration', () => {
    it('storedMessagesToTurns maps audio_url to url and preserves call.voiceSessionId', () => {
        const stored: StoredConversationMessage[] = [
            {
                message_id: 10,
                turn_id: 'turn-1',
                sequence_no: 1,
                role: 'user',
                status: 'completed',
                content: 'Are you there?',
                metadata: { source: 'voice', voice: { voice_session_id: 'vs-42', segment_seq: 0 } },
                call: { voice_session_id: 'vs-42' },
                created_at: '2026-10-17T12:00:00Z',
                updated_at: '2026-10-17T12:00:00Z',
                completed_at: '2026-10-17T12:00:00Z',
            },
            {
                message_id: 11,
                turn_id: 'turn-1',
                sequence_no: 2,
                role: 'assistant',
                status: 'completed',
                content: 'I am right here.',
                metadata: {
                    conversation_mode: 'voice_call',
                    voice: { voice_session_id: 'vs-42', segment_seq: 1 },
                    tts_segments: {
                        '0': {
                            segment_index: 0,
                            status: 'completed',
                            asset_id: 'asset-99',
                            audio_url: '/tts/assets/asset-99',
                            duration_ms: 1800,
                            source: 'voice_call',
                        },
                    },
                },
                call: { voice_session_id: 'vs-42' },
                created_at: '2026-10-17T12:00:01Z',
                updated_at: '2026-10-17T12:00:02Z',
                completed_at: '2026-10-17T12:00:02Z',
            },
        ]

        const turns = storedMessagesToTurns(stored)
        expect(turns).toHaveLength(2)
        expect(turns[0].call).toEqual({ voiceSessionId: 'vs-42' })
        expect(turns[1].call).toEqual({ voiceSessionId: 'vs-42' })
        expect(turns[1].ttsSegments).toHaveLength(1)
        expect(turns[1].ttsSegments?.[0].url).toBe('/tts/assets/asset-99')
    })

    it('hydrated clip states fall back to clip.audio_url when clip.url is omitted', () => {
        const turn: TurnEntry = {
            id: 'hydrated', type: 'ai', timestamp: '2026-10-17T12:00:00Z', assistantMessageId: 11,
            content: 'Hello from a call',
            ttsSegments: [
                {
                    segment_index: 0,
                    status: 'completed',
                    audio_url: '/tts/assets/call-clip-1.mp3',
                },
            ],
        }
        const clips = mergeHydratedTtsTurns([turn], [turn])[0].ttsSegments!
        expect(clips).toHaveLength(1)
        expect(clips[0].url).toBe('/tts/assets/call-clip-1.mp3')
        expect(clips[0].status).toBe('completed')
    })

    it('maps call_reply_not_narratable to the replay-only i18n key', () => {
        expect(narrationErrorKey({ code: 'call_reply_not_narratable', category: 'invalid', detail: 'Replay the stored call audio.' })).toBe('interaction.narration.callReplyReplayOnly')
    })

    it('builds and parses #/calls?call=<id> deep links', () => {
        const hash = buildCallTranscriptHash('vs-abc-123')
        expect(hash).toBe('#/calls?call=vs-abc-123')
        expect(readCallIdFromLocation(hash)).toBe('vs-abc-123')
    })

    it('renders CallDivider and fires onViewTranscript when clicked', () => {
        const onView = vi.fn()
        render(<CallDivider voiceSessionId="vs-55" onViewTranscript={onView} />)

        expect(screen.getByTestId('chat-call-divider')).toBeInTheDocument()
        const link = screen.getByTestId('chat-call-divider-link')
        link.click()
        expect(onView).toHaveBeenCalledWith('vs-55')
    })

    it('renders ChatTurn for a completed call reply with call badge, replay button, and no Edit button', () => {
        const onEdit = vi.fn()
        const onOpenCall = vi.fn()
        const callReplyTurn: TurnEntry = {
            id: '11',
            type: 'ai',
            assistantMessageId: 11,
            turnId: 'turn-1',
            content: 'Hold on. <#0.4#> The door is open.',
            timestamp: '2026-10-17T12:00:02Z',
            call: { voiceSessionId: 'vs-42' },
            metadata: {
                conversation_mode: 'voice_call',
                voice: { voice_session_id: 'vs-42' },
            },
            ttsSegments: [
                {
                    segment_index: 0,
                    status: 'completed',
                    url: '/tts/assets/asset-99.mp3',
                },
            ],
        }

        render(
            <ChatTurn
                turn={callReplyTurn}
                onForwardOptionClick={vi.fn()}
                aiLabel="Mira"
                onEditClick={onEdit}
                onDeleteClick={vi.fn()}
                onRequestNarration={vi.fn()}
                onOpenCallTranscript={onOpenCall}
            />,
        )

        // Provenance badge is rendered and clickable
        const badge = screen.getByTestId('chat-turn-call-badge')
        expect(badge).toBeInTheDocument()
        badge.click()
        expect(onOpenCall).toHaveBeenCalledWith('vs-42')

        // Speech markup v1 is stripped in chat view
        expect(screen.getByText('Hold on. The door is open.')).toBeInTheDocument()

        // Edit button is hidden on call replies even when onEditClick is passed
        expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()

        // TurnNarration renders in call replay mode ("Play call audio")
        expect(screen.getByRole('button', { name: 'Play call audio' })).toBeInTheDocument()
    })

    it('hides both Edit and Narrate buttons on an interrupted call reply without saved audio', () => {
        const interruptedCallTurn: TurnEntry = {
            id: '12',
            type: 'ai',
            assistantMessageId: 12,
            turnId: 'turn-2',
            content: 'Wait a sec—',
            timestamp: '2026-10-17T12:01:00Z',
            metadata: {
                conversation_mode: 'voice_call',
                interrupted: true,
                voice: { voice_session_id: 'vs-42', partial: true },
            },
        }

        render(
            <ChatTurn
                turn={interruptedCallTurn}
                onForwardOptionClick={vi.fn()}
                aiLabel="Mira"
                onEditClick={vi.fn()}
                onRequestNarration={vi.fn()}
            />,
        )

        expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /play narration/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /play call audio/i })).not.toBeInTheDocument()
    })

    it('hides Edit on user call turns while keeping Edit on normal text turns', () => {
        const userCallTurn: TurnEntry = {
            id: '20',
            type: 'user',
            content: 'Spoken during call',
            timestamp: '2026-10-17T12:00:00Z',
            metadata: { source: 'voice', voice: { voice_session_id: 'vs-42' } },
        }

        const { unmount } = render(
            <ChatTurn
                turn={userCallTurn}
                onForwardOptionClick={vi.fn()}
                aiLabel="Mira"
                onEditClick={vi.fn()}
            />,
        )
        expect(screen.getByTestId('chat-turn-call-badge')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
        unmount()

        const normalUserTurn: TurnEntry = {
            id: '21',
            type: 'user',
            content: 'Typed in chat',
            timestamp: '2026-10-17T12:02:00Z',
        }
        render(
            <ChatTurn
                turn={normalUserTurn}
                onForwardOptionClick={vi.fn()}
                aiLabel="Mira"
                onEditClick={vi.fn()}
            />,
        )
        expect(screen.queryByTestId('chat-turn-call-badge')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })
})
