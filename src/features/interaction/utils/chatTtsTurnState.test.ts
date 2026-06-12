import { describe, expect, it } from 'vitest'
import type { ChatSocketServerMessage, TurnEntry } from '../../../shared'
import { hasNonTerminalTtsJob, mergeHydratedTtsTurns, upsertChatTtsFrame, upsertTtsJobResult } from './chatTtsTurnState'

const baseTurn: TurnEntry = {
  id: 'local-ai-1',
  type: 'ai',
  content: 'The gate opens.',
  timestamp: '2026-06-07T00:00:00.000Z',
}

const audioAsset = {
  asset_id: 'asset-1',
  url: '/tts/assets/asset-1.mp3',
  content_type: 'audio/mpeg' as const,
  duration_ms: 4200,
}

describe('chatTtsTurnState', () => {
  it('attaches tts_job by assistant message id and keeps the synthesizing state', () => {
    const frame: ChatSocketServerMessage = {
      type: 'tts_job',
      adventure_id: 7,
      assistant_message_id: 101,
      turn_id: 'turn-1',
      job_id: 'tts-1',
      status: 'synthesizing',
      status_url: '/tts/jobs/tts-1',
      result_url: '/tts/jobs/tts-1/result',
    }

    const next = upsertChatTtsFrame([{ ...baseTurn, assistantMessageId: 101 }], frame)

    expect(next[0]).toMatchObject({
      ttsJobId: 'tts-1',
      ttsStatus: 'synthesizing',
      ttsStatusUrl: '/tts/jobs/tts-1',
      ttsResultUrl: '/tts/jobs/tts-1/result',
    })
    // `synthesizing` must count as non-terminal so polling keeps going.
    expect(hasNonTerminalTtsJob(next[0])).toBe(true)
  })

  it('handles tts_complete before a late tts_job and refuses terminal downgrade', () => {
    const complete: ChatSocketServerMessage = {
      type: 'tts_complete',
      adventure_id: 7,
      assistant_message_id: 101,
      turn_id: 'turn-1',
      job_id: 'tts-1',
      status: 'completed',
      url: '/tts/assets/asset-1.mp3',
      status_url: '/tts/jobs/tts-1',
      result_url: '/tts/jobs/tts-1/result',
      assets: [audioAsset],
    }
    const lateJob: ChatSocketServerMessage = {
      type: 'tts_job',
      adventure_id: 7,
      assistant_message_id: 101,
      turn_id: 'turn-1',
      job_id: 'tts-1',
      status: 'in_progress',
      status_url: '/tts/jobs/tts-1',
      result_url: '/tts/jobs/tts-1/result',
    }

    const completed = upsertChatTtsFrame([{ ...baseTurn, assistantMessageId: 101 }], complete)
    const next = upsertChatTtsFrame(completed, lateJob)

    expect(next[0].ttsStatus).toBe('completed')
    expect(next[0].ttsAssets).toHaveLength(1)
    expect(next[0].ttsUrl).toBe('/tts/assets/asset-1.mp3')
    expect(hasNonTerminalTtsJob(next[0])).toBe(false)
  })

  it('falls back to the top-level url when assets are empty', () => {
    const complete: ChatSocketServerMessage = {
      type: 'tts_complete',
      adventure_id: 7,
      assistant_message_id: 101,
      turn_id: 'turn-1',
      job_id: 'tts-1',
      status: 'completed',
      url: '/tts/assets/asset-1.mp3',
      assets: [],
    }

    const next = upsertChatTtsFrame([{ ...baseTurn, assistantMessageId: 101 }], complete)

    expect(next[0].ttsStatus).toBe('completed')
    expect(next[0].ttsUrl).toBe('/tts/assets/asset-1.mp3')
  })

  it('maps a rate_limited failure with retry_after_seconds by turn id', () => {
    const failed: ChatSocketServerMessage = {
      type: 'tts_failed',
      adventure_id: 7,
      assistant_message_id: 101,
      turn_id: 'turn-1',
      job_id: 'tts-1',
      status: 'rate_limited',
      error: { category: 'rate_limited', detail: 'Too many requests.', retry_after_seconds: 30 },
    }

    const next = upsertChatTtsFrame([{ ...baseTurn, turnId: 'turn-1' }], failed)

    expect(next[0].ttsStatus).toBe('rate_limited')
    expect(next[0].ttsError?.detail).toBe('Too many requests.')
    expect(next[0].ttsError?.retry_after_seconds).toBe(30)
    expect(hasNonTerminalTtsJob(next[0])).toBe(false)
  })

  it('upserts terminal HTTP polling results by job id', () => {
    const next = upsertTtsJobResult(
      [{ ...baseTurn, ttsJobId: 'tts-1', ttsStatus: 'synthesizing' }],
      {
        job_id: 'tts-1',
        status: 'completed',
        status_url: '/tts/jobs/tts-1',
        result_url: '/tts/jobs/tts-1/result',
        assets: [audioAsset],
      },
    )

    expect(next[0].ttsStatus).toBe('completed')
    expect(next[0].ttsUrl).toBe('/tts/assets/asset-1.mp3')
  })

  it('never folds hydrated TTS state into key-less turns (user / still-streaming)', () => {
    const userTurn: TurnEntry = { id: 'local-user-1', type: 'user', content: 'I open the gate.', timestamp: '2026-06-07T00:00:00.000Z' }
    const streamingAiTurn: TurnEntry = { ...baseTurn, id: 'local-ai-2', content: '' }
    const hydratedAi: TurnEntry = {
      ...baseTurn,
      id: '101',
      assistantMessageId: 101,
      turnId: 'turn-1',
      ttsJobId: 'tts-1',
      ttsStatus: 'completed',
      ttsAssets: [audioAsset],
      ttsUrl: audioAsset.url,
    }

    const next = mergeHydratedTtsTurns([userTurn, streamingAiTurn], [hydratedAi])

    // Neither turn carries any id key, so neither may adopt the hydrated AI
    // turn's narration (the old last-AI fallback polluted both).
    expect(next[0]).toEqual(userTurn)
    expect(next[1]).toEqual(streamingAiTurn)
  })

  it('still folds hydrated TTS state into the matching turn by assistant message id', () => {
    const userTurn: TurnEntry = { id: 'local-user-1', type: 'user', content: 'I open the gate.', timestamp: '2026-06-07T00:00:00.000Z' }
    const aiTurn: TurnEntry = { ...baseTurn, assistantMessageId: 101, turnId: 'turn-1' }
    const hydratedAi: TurnEntry = {
      ...aiTurn,
      id: '101',
      ttsJobId: 'tts-1',
      ttsStatus: 'completed',
      ttsAssets: [audioAsset],
      ttsUrl: audioAsset.url,
    }

    const next = mergeHydratedTtsTurns([userTurn, aiTurn], [hydratedAi])

    expect(next[0]).toEqual(userTurn)
    expect(next[1].ttsStatus).toBe('completed')
    expect(next[1].ttsUrl).toBe(audioAsset.url)
  })

  it('still attaches a live frame with unmatched ids to the newest AI turn', () => {
    const frame: ChatSocketServerMessage = {
      type: 'tts_failed',
      adventure_id: 7,
      assistant_message_id: 999,
      turn_id: 'turn-unknown',
      job_id: null,
      status: 'unavailable',
      error: { category: 'unavailable', detail: 'TTS generation is unavailable.' },
    }

    const next = upsertChatTtsFrame([{ ...baseTurn, assistantMessageId: 101 }], frame)

    expect(next[0].ttsStatus).toBe('unavailable')
  })

  it('deduplicates duplicate terminal assets by asset id', () => {
    const complete: ChatSocketServerMessage = {
      type: 'tts_complete',
      adventure_id: 7,
      assistant_message_id: 101,
      turn_id: 'turn-1',
      job_id: 'tts-1',
      status: 'completed',
      assets: [audioAsset],
    }

    const once = upsertChatTtsFrame([{ ...baseTurn, assistantMessageId: 101 }], complete)
    const twice = upsertChatTtsFrame(once, complete)

    expect(twice[0].ttsAssets).toHaveLength(1)
  })
})
