import { describe, expect, it } from 'vitest'
import type { ChatSocketServerMessage, TurnEntry } from '../../../shared'
import { upsertChatImageFrame, upsertImageJobResult } from './chatImageTurnState'

const baseTurn: TurnEntry = {
  id: 'local-ai-1',
  type: 'ai',
  content: 'The gate opens.',
  timestamp: '2026-06-07T00:00:00.000Z',
}

describe('chatImageTurnState', () => {
  it('attaches image_job by assistant message id and keeps pending state', () => {
    const frame: ChatSocketServerMessage = {
      type: 'image_job',
      adventure_id: 7,
      assistant_message_id: 101,
      turn_id: 'turn-1',
      job_id: 'img-1',
      status: 'in_progress',
      status_url: '/images/jobs/img-1',
      result_url: '/images/jobs/img-1/result',
    }

    const next = upsertChatImageFrame([{ ...baseTurn, assistantMessageId: 101 }], frame)

    expect(next[0]).toMatchObject({
      imageJobId: 'img-1',
      imageStatus: 'in_progress',
      imageStatusUrl: '/images/jobs/img-1',
      imageResultUrl: '/images/jobs/img-1/result',
    })
  })

  it('handles image_complete before image_job and refuses terminal downgrade', () => {
    const complete: ChatSocketServerMessage = {
      type: 'image_complete',
      adventure_id: 7,
      assistant_message_id: 101,
      turn_id: 'turn-1',
      job_id: 'img-1',
      status: 'completed',
      status_url: '/images/jobs/img-1',
      result_url: '/images/jobs/img-1/result',
      assets: [{ asset_id: 'asset-1', url: '/generated-images/img-1.png', content_type: 'image/png' }],
    }
    const lateJob: ChatSocketServerMessage = {
      type: 'image_job',
      adventure_id: 7,
      assistant_message_id: 101,
      turn_id: 'turn-1',
      job_id: 'img-1',
      status: 'in_progress',
      status_url: '/images/jobs/img-1',
      result_url: '/images/jobs/img-1/result',
    }

    const completed = upsertChatImageFrame([{ ...baseTurn, assistantMessageId: 101 }], complete)
    const next = upsertChatImageFrame(completed, lateJob)

    expect(next[0].imageStatus).toBe('completed')
    expect(next[0].imageAssets).toHaveLength(1)
    expect(next[0].imageUrl).toBe('/generated-images/img-1.png')
  })

  it('deduplicates duplicate terminal assets by asset id', () => {
    const complete: ChatSocketServerMessage = {
      type: 'image_complete',
      adventure_id: 7,
      assistant_message_id: 101,
      turn_id: 'turn-1',
      job_id: 'img-1',
      status: 'completed',
      assets: [{ asset_id: 'asset-1', url: '/generated-images/img-1.png', content_type: 'image/png' }],
    }

    const once = upsertChatImageFrame([{ ...baseTurn, assistantMessageId: 101 }], complete)
    const twice = upsertChatImageFrame(once, complete)

    expect(twice[0].imageAssets).toHaveLength(1)
  })

  it('maps failed frames with null job id by turn id', () => {
    const failed: ChatSocketServerMessage = {
      type: 'image_failed',
      adventure_id: 7,
      assistant_message_id: 101,
      turn_id: 'turn-1',
      job_id: null,
      status: 'unavailable',
      error: { category: 'unavailable', detail: 'Image generation is unavailable.' },
    }

    const next = upsertChatImageFrame([{ ...baseTurn, turnId: 'turn-1' }], failed)

    expect(next[0].imageStatus).toBe('unavailable')
    expect(next[0].imageError?.detail).toBe('Image generation is unavailable.')
  })

  it('upserts terminal HTTP polling results by job id', () => {
    const next = upsertImageJobResult(
      [{ ...baseTurn, imageJobId: 'img-1', imageStatus: 'in_progress' }],
      {
        job_id: 'img-1',
        status: 'completed',
        status_url: '/images/jobs/img-1',
        result_url: '/images/jobs/img-1/result',
        assets: [{ asset_id: 'asset-1', url: '/generated-images/img-1.png', content_type: 'image/png' }],
      },
    )

    expect(next[0].imageStatus).toBe('completed')
    expect(next[0].imageUrl).toBe('/generated-images/img-1.png')
  })
})
