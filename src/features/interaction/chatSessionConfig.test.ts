import { describe, expect, it } from 'vitest'
import type { CanonicalConversationMessage } from '../../shared'
import { canonicalMessagesToTurns } from './chatSessionConfig'

function message(overrides: Partial<CanonicalConversationMessage>): CanonicalConversationMessage {
    return {
        message_id: 1,
        turn_id: 'turn-1',
        sequence_no: 1,
        role: 'user',
        status: 'completed',
        content: 'Open the gate.',
        metadata: {},
        created_at: '2026-07-12T00:00:00Z',
        updated_at: '2026-07-12T00:00:01Z',
        completed_at: '2026-07-12T00:00:01Z',
        ...overrides,
    }
}

describe('canonicalMessagesToTurns', () => {
    it('orders canonical rows and projects assistant metadata', () => {
        const turns = canonicalMessagesToTurns([
            message({
                message_id: 2,
                sequence_no: 2,
                role: 'assistant',
                content: '<response><narrator>The gate opens.</narrator></response>',
                metadata: {
                    response_display_text: 'The gate opens.',
                    response_segments: [{ kind: 'narrator', content: 'The gate opens.' }],
                    turn_metadata: {
                        forwardOptions: [{ label: 'Enter', message: 'I enter.' }],
                        imagePrompt: 'An ancient gate opening at dusk.',
                    },
                    image_job: {
                        job_id: 'image-1',
                        status_url: '/images/jobs/image-1',
                        result_url: '/images/jobs/image-1/result',
                    },
                    image_job_status: 'completed',
                    image_assets: [{ asset_id: 'asset-1', url: '/images/assets/asset-1.webp', content_type: 'image/webp' }],
                    tts_segments: {
                        '0': { segment_index: 0, status: 'completed', url: '/tts/assets/asset-1.mp3' },
                    },
                },
            }),
            message({ message_id: 1, sequence_no: 1 }),
        ])

        expect(turns.map((turn) => turn.id)).toEqual(['1', '2'])
        expect(turns[1]).toMatchObject({
            type: 'ai',
            content: 'The gate opens.',
            assistantMessageId: 2,
            turnId: 'turn-1',
            imagePrompt: 'An ancient gate opening at dusk.',
            imageJobId: 'image-1',
            imageStatus: 'completed',
            imageUrl: '/images/assets/asset-1.webp',
        })
        expect(turns[1].segments).toEqual([{ kind: 'narrator', content: 'The gate opens.' }])
        expect(turns[1].ttsSegments).toEqual([
            { segment_index: 0, status: 'completed', url: '/tts/assets/asset-1.mp3' },
        ])
    })

    it('marks only pending and streaming rows as streaming', () => {
        const turns = canonicalMessagesToTurns([
            message({ message_id: 1, sequence_no: 1, status: 'pending' }),
            message({ message_id: 2, sequence_no: 2, status: 'interrupted' }),
        ])

        expect(turns[0].isStreaming).toBe(true)
        expect(turns[1].isStreaming).toBe(false)
    })
})
