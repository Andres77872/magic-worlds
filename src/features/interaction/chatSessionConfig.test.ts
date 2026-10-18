import { describe, expect, it } from 'vitest'
import type { StoredConversationMessage } from '../../shared'
import { storedMessagesToTurns } from './chatSessionConfig'

function message(overrides: Partial<StoredConversationMessage>): StoredConversationMessage {
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

describe('storedMessagesToTurns', () => {
    it('orders stored rows and projects assistant metadata', () => {
        const turns = storedMessagesToTurns([
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
        })
        // A row from an older server: its one metadata slot becomes one generation.
        expect(turns[1].imageGenerations).toEqual([expect.objectContaining({
            job_id: 'image-1',
            status: 'completed',
            assistant_message_id: 2,
            trigger: 'auto',
            prompt: 'An ancient gate opening at dusk.',
            assets: [{ asset_id: 'asset-1', url: '/images/assets/asset-1.webp', content_type: 'image/webp' }],
        })])
        expect(turns[1].segments).toEqual([{ kind: 'narrator', content: 'The gate opens.' }])
        expect(turns[1].ttsSegments).toEqual([
            { segment_index: 0, status: 'completed', url: '/tts/assets/asset-1.mp3' },
        ])
    })

    it('maps every image job of a reply from image_generations, oldest first, over the legacy slot', () => {
        const [turn] = storedMessagesToTurns([message({
            message_id: 5,
            role: 'assistant',
            content: 'The lantern flares.',
            metadata: {
                image_job: { job_id: 'legacy-job' },
                image_job_status: 'completed',
                image_assets: [{ asset_id: 'legacy', url: '/images/assets/legacy.webp', content_type: 'image/webp' }],
            },
            image_generations: [
                { job_id: 'job-2', status: 'in_progress', assets: [], trigger: 'regenerate', created_at: '2026-07-12T00:02:00Z',
                    prompt: 'A lantern flaring in a secret archive.', model_display_name: 'Flux schnell', credit_cost: 1 },
                { job_id: 'job-1', status: 'completed', trigger: 'auto', created_at: '2026-07-12T00:01:00Z',
                    assets: [
                        { asset_id: 'a1', url: '/images/assets/a1.webp', content_type: 'image/webp' },
                        { asset_id: 'leak', url: 'https://v3.fal.media/files/raw.png', content_type: 'image/png' },
                    ] },
                { status: 'completed', assets: [] },
            ] as never,
        })])

        expect(turn.imageGenerations?.map((generation) => generation.job_id)).toEqual(['job-1', 'job-2'])
        expect(turn.imageGenerations?.[0].assets).toEqual([{ asset_id: 'a1', url: '/images/assets/a1.webp', content_type: 'image/webp' }])
        // Prompts are shown as written; the error-text filter never touches them.
        expect(turn.imageGenerations?.[1]).toMatchObject({ prompt: 'A lantern flaring in a secret archive.', model_display_name: 'Flux schnell', credit_cost: 1, assistant_message_id: 5 })
    })

    it('leaves a reply without image jobs without generations', () => {
        const [turn] = storedMessagesToTurns([message({ role: 'assistant', content: 'Quiet.', image_generations: [] })])
        expect(turn.imageGenerations).toBeUndefined()
        const [legacy] = storedMessagesToTurns([message({ role: 'assistant', content: 'Quiet.', metadata: { image_job_status: 'quota_exceeded' } })])
        expect(legacy.imageGenerations).toBeUndefined()
    })

    it('falls back to the legacy slot when the server sends an empty image list', () => {
        // The server sends empty lists when it cannot read the image jobs; the automatic image is still in the metadata.
        const [turn] = storedMessagesToTurns([message({
            message_id: 5,
            role: 'assistant',
            content: 'The lantern flares.',
            metadata: { image_job: { job_id: 'legacy-job' }, image_job_status: 'in_progress' },
            image_generations: [],
        })])
        expect(turn.imageGenerations).toEqual([expect.objectContaining({ job_id: 'legacy-job', status: 'in_progress', trigger: 'auto' })])
    })

    it('marks only pending and streaming rows as streaming', () => {
        const turns = storedMessagesToTurns([
            message({ message_id: 1, sequence_no: 1, status: 'pending' }),
            message({ message_id: 2, sequence_no: 2, status: 'interrupted' }),
        ])

        expect(turns[0].isStreaming).toBe(true)
        expect(turns[1].isStreaming).toBe(false)
    })
})


it('restores interrupted narrative without exposing incomplete XML or restarting its spinner', () => {
    const [turn] = storedMessagesToTurns([message({ role: 'assistant', status: 'interrupted',
        content: '<response><say speaker_id="aria">The door listens', metadata: { partial: true } })])
    expect(turn.content).toBe('The door listens')
    expect(turn.isStreaming).toBe(false)
    expect(turn.metadata?.interrupted).toBe(true)
    expect(turn.segments?.[0].content).toBe('The door listens')
})
