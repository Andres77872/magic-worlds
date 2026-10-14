import { describe, expect, it } from 'vitest'
import type { ChatSocketServerMessage, TurnEntry } from '../../../shared'
import { hasNonTerminalTtsJob, isGeneratingClipStatus, isSettledClipStatus, mergeHydratedTtsTurns, nonTerminalTtsJobIds, upsertChatTtsFrame, upsertTtsJobResult, type ChatTtsFrame } from './chatTtsTurnState'

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

describe('chatTtsTurnState — per-segment multi-voice', () => {
  const turn: TurnEntry = { ...baseTurn, assistantMessageId: 202, turnId: 'turn-2' }

  const jobFrame = (segment_index: number, job_id: string, speaker_name: string): ChatTtsFrame => ({
    type: 'tts_job',
    adventure_id: 7,
    assistant_message_id: 202,
    turn_id: 'turn-2',
    job_id,
    status: 'synthesizing',
    status_url: `/tts/jobs/${job_id}`,
    result_url: `/tts/jobs/${job_id}/result`,
    segment_index,
    segment_count: 2,
    kind: segment_index === 0 ? 'narrator' : 'speech',
    speaker_name,
  })

  const completeFrame = (segment_index: number, job_id: string, asset_id: string): ChatTtsFrame => ({
    type: 'tts_complete',
    adventure_id: 7,
    assistant_message_id: 202,
    turn_id: 'turn-2',
    job_id,
    status: 'completed',
    assets: [{ asset_id, url: `/tts/assets/${asset_id}.mp3`, content_type: 'audio/mpeg' }],
    segment_index,
    segment_count: 2,
  })

  it('assembles an ordered ttsSegments playlist from per-segment frames', () => {
    let turns = upsertChatTtsFrame([turn], jobFrame(1, 'tts-seg-1', 'Aria'))
    turns = upsertChatTtsFrame(turns, jobFrame(0, 'tts-seg-0', 'Narrator'))
    const clips = turns[0].ttsSegments!
    expect(clips.map((c) => c.segment_index)).toEqual([0, 1])
    expect(clips[1].speaker_name).toBe('Aria')
    // No clobbering of the legacy single-clip fields.
    expect(turns[0].ttsJobId).toBeUndefined()
  })

  it('plays ready clips while later clips are still generating (partial completion)', () => {
    let turns = upsertChatTtsFrame([turn], jobFrame(0, 'tts-seg-0', 'Narrator'))
    turns = upsertChatTtsFrame(turns, jobFrame(1, 'tts-seg-1', 'Aria'))
    turns = upsertChatTtsFrame(turns, completeFrame(0, 'tts-seg-0', 'asset-0'))
    const clips = turns[0].ttsSegments!
    expect(clips[0].status).toBe('completed')
    expect(clips[0].url).toBe('/tts/assets/asset-0.mp3')
    expect(clips[1].status).toBe('synthesizing')
    // The turn still has a non-terminal clip → polling continues.
    expect(hasNonTerminalTtsJob(turns[0])).toBe(true)
    expect(nonTerminalTtsJobIds(turns[0])).toEqual(['tts-seg-1'])
  })

  it('aggregate goes terminal only when every clip is terminal', () => {
    let turns = upsertChatTtsFrame([turn], jobFrame(0, 'tts-seg-0', 'Narrator'))
    turns = upsertChatTtsFrame(turns, jobFrame(1, 'tts-seg-1', 'Aria'))
    turns = upsertChatTtsFrame(turns, completeFrame(0, 'tts-seg-0', 'asset-0'))
    turns = upsertChatTtsFrame(turns, completeFrame(1, 'tts-seg-1', 'asset-1'))
    expect(hasNonTerminalTtsJob(turns[0])).toBe(false)
    expect(nonTerminalTtsJobIds(turns[0])).toEqual([])
  })

  it('polled job results update the matching clip, not the legacy fields', () => {
    let turns = upsertChatTtsFrame([turn], jobFrame(0, 'tts-seg-0', 'Narrator'))
    turns = upsertTtsJobResult(turns, {
      job_id: 'tts-seg-0',
      status: 'completed',
      assets: [{ asset_id: 'asset-0', url: '/tts/assets/asset-0.mp3', content_type: 'audio/mpeg' }],
    })
    expect(turns[0].ttsSegments![0].status).toBe('completed')
    expect(turns[0].ttsSegments![0].url).toBe('/tts/assets/asset-0.mp3')
    expect(turns[0].ttsJobId).toBeUndefined()
  })

  it('folds hydrated ttsSegments by index with terminal precedence', () => {
    const live = upsertChatTtsFrame([turn], jobFrame(0, 'tts-seg-0', 'Narrator'))
    const hydrated: TurnEntry[] = [
      {
        ...turn,
        ttsSegments: [
          {
            segment_index: 0,
            kind: 'narrator',
            status: 'completed',
            job_id: 'tts-seg-0',
            assets: [{ asset_id: 'asset-0', url: '/tts/assets/asset-0.mp3', content_type: 'audio/mpeg' }],
            url: '/tts/assets/asset-0.mp3',
          },
        ],
      },
    ]
    const merged = mergeHydratedTtsTurns(live, hydrated)
    expect(merged[0].ttsSegments![0].status).toBe('completed')
    expect(merged[0].ttsSegments![0].url).toBe('/tts/assets/asset-0.mp3')
  })
})

describe('chatTtsTurnState — voice v2 fields (R0, expand-only)', () => {
  const turn: TurnEntry = { ...baseTurn, assistantMessageId: 303, turnId: 'turn-3' }

  const segmentJob = (job_id: string, extra: Record<string, unknown> = {}): ChatTtsFrame => ({
    type: 'tts_job',
    adventure_id: 7,
    assistant_message_id: 303,
    turn_id: 'turn-3',
    job_id,
    status: 'synthesizing',
    status_url: `/tts/jobs/${job_id}`,
    result_url: `/tts/jobs/${job_id}/result`,
    segment_index: 0,
    segment_count: 1,
    kind: 'thought',
    ...extra,
  } as ChatTtsFrame)

  const segmentFailed = (job_id: string, error: Record<string, unknown>): ChatTtsFrame => ({
    type: 'tts_failed',
    adventure_id: 7,
    assistant_message_id: 303,
    turn_id: 'turn-3',
    job_id,
    status: 'failed',
    error,
    segment_index: 0,
    segment_count: 1,
  } as unknown as ChatTtsFrame)

  it('carries tier, gain, substitution and voice names through frames and job results', () => {
    let turns = upsertChatTtsFrame([turn], segmentJob('tts-v-0', {
      tier: 'expressive',
      gain_db: -4.5,
      substitution_reason: 'voice_restricted',
      voice_name: 'Aria',
      original_voice_name: 'Lyra (cloned)',
    }))
    expect(turns[0].ttsSegments![0]).toMatchObject({
      tier: 'expressive',
      gain_db: -4.5,
      substitution_reason: 'voice_restricted',
      voice_name: 'Aria',
      original_voice_name: 'Lyra (cloned)',
    })

    // A later result without the fields never erases them.
    turns = upsertTtsJobResult(turns, {
      job_id: 'tts-v-0',
      status: 'completed',
      assets: [{ asset_id: 'asset-v', url: '/tts/assets/asset-v.mp3', content_type: 'audio/mpeg' }],
    })
    expect(turns[0].ttsSegments![0]).toMatchObject({ status: 'completed', tier: 'expressive', gain_db: -4.5, voice_name: 'Aria' })
  })

  it('clamps gain to [-24, 0] and drops invalid values', () => {
    expect(upsertChatTtsFrame([turn], segmentJob('a', { gain_db: 6 }))[0].ttsSegments![0].gain_db).toBe(0)
    expect(upsertChatTtsFrame([turn], segmentJob('b', { gain_db: -60 }))[0].ttsSegments![0].gain_db).toBe(-24)
    expect(upsertChatTtsFrame([turn], segmentJob('c', { gain_db: 'loud' }))[0].ttsSegments![0].gain_db).toBeUndefined()
    expect(upsertChatTtsFrame([turn], segmentJob('d', { tier: 'ultra' }))[0].ttsSegments![0].tier).toBeUndefined()
  })

  it('keeps retryable, action and a safe code on errors', () => {
    let turns = upsertChatTtsFrame([turn], segmentJob('tts-e-0'))
    turns = upsertChatTtsFrame(turns, segmentFailed('tts-e-0', {
      category: 'moderation_unavailable',
      detail: 'Try again shortly.',
      code: 'moderation_unavailable',
      retryable: true,
      action: 'attest',
    }))
    expect(turns[0].ttsSegments![0].error).toMatchObject({ code: 'moderation_unavailable', retryable: true, action: 'attest' })

    const unsafe = upsertChatTtsFrame([turn], segmentFailed('tts-e-1', {
      category: 'failed',
      detail: 'x',
      code: 'see https://example.test/trace',
      retryable: 'yes',
      action: 'delete',
    }))[0].ttsSegments![0].error!
    expect(unsafe.code).toBeUndefined()
    expect(unsafe).not.toHaveProperty('retryable')
    expect(unsafe).not.toHaveProperty('action')
  })

  it('records a turn-level refusal as a turn error, not a clip', () => {
    const turns = upsertChatTtsFrame([turn], {
      type: 'tts_failed',
      adventure_id: 7,
      assistant_message_id: 303,
      turn_id: 'turn-3',
      job_id: null,
      status: 'invalid',
      error: { category: 'invalid', detail: 'Workspace archived.', code: 'workspace_archived', retryable: false },
    })
    expect(turns[0].ttsSegments).toBeUndefined()
    expect(turns[0].ttsJobId).toBeUndefined()
    expect(turns[0].ttsError).toMatchObject({ code: 'workspace_archived', retryable: false })

    // A later admitted request clears the stale gate.
    const next = upsertChatTtsFrame(turns, segmentJob('tts-after'))
    expect(next[0].ttsError).toBeUndefined()
    expect(next[0].ttsSegments).toHaveLength(1)
  })

  it('settles a turn on a voice_safety_pause refusal, keeping the crisis action and retry (R2-BE-01, PC-1)', () => {
    const turns = upsertChatTtsFrame([turn], {
      type: 'tts_failed',
      adventure_id: 7,
      assistant_message_id: 303,
      turn_id: 'turn-3',
      job_id: null,
      status: 'unavailable',
      error: {
        category: 'unavailable',
        detail: 'Voice is paused.',
        code: 'voice_safety_pause',
        retryable: false,
        action: 'crisis_resources',
        retry_after_seconds: 600,
      },
    })
    expect(turns[0].ttsSegments).toBeUndefined()
    expect(turns[0].ttsJobId).toBeUndefined()
    expect(turns[0].ttsError).toEqual({
      category: 'unavailable',
      detail: 'Voice is paused.',
      code: 'voice_safety_pause',
      retryable: false,
      action: 'crisis_resources',
      retry_after_seconds: 600,
    })
    expect(hasNonTerminalTtsJob(turns[0])).toBe(false)
    expect(nonTerminalTtsJobIds(turns[0])).toEqual([])
  })

  it('settles a clip on a voice_region_unavailable refusal (R2-BE-03, PC-2)', () => {
    let turns = upsertChatTtsFrame([turn], segmentJob('tts-g-0'))
    turns = upsertChatTtsFrame(turns, segmentFailed('tts-g-0', {
      category: 'unavailable',
      detail: 'Voice is not available in your region.',
      code: 'voice_region_unavailable',
      retryable: false,
    }))
    expect(turns[0].ttsSegments![0]).toMatchObject({ status: 'failed', error: { code: 'voice_region_unavailable', retryable: false } })
    expect(hasNonTerminalTtsJob(turns[0])).toBe(false)
    // The crisis action survives a per-clip refusal too.
    const fresh = upsertChatTtsFrame(upsertChatTtsFrame([turn], segmentJob('tts-p-0')), segmentFailed('tts-p-0', { category: 'unavailable', detail: 'x', code: 'voice_safety_pause', action: 'crisis_resources' }))
    expect(fresh[0].ttsSegments![0].error).toMatchObject({ code: 'voice_safety_pause', action: 'crisis_resources' })
  })

  it('lets a newer job replace a failed clip (per-clip retry)', () => {
    let turns = upsertChatTtsFrame([turn], segmentJob('tts-r-0'))
    turns = upsertChatTtsFrame(turns, segmentFailed('tts-r-0', { category: 'failed', detail: 'x' }))
    expect(turns[0].ttsSegments![0].status).toBe('failed')

    // The same job never moves back from terminal.
    expect(upsertChatTtsFrame(turns, segmentJob('tts-r-0'))[0].ttsSegments![0].status).toBe('failed')

    turns = upsertChatTtsFrame(turns, segmentJob('tts-r-1'))
    expect(turns[0].ttsSegments![0]).toMatchObject({ job_id: 'tts-r-1', status: 'synthesizing' })
    expect(turns[0].ttsSegments![0].error).toBeUndefined()
  })

  it('treats display-only segment states as settled, never generating or polled', () => {
    expect(isSettledClipStatus('daily_limit_reached')).toBe(true)
    expect(isSettledClipStatus('not_narrated')).toBe(true)
    expect(isSettledClipStatus('synthesizing')).toBe(false)
    expect(isGeneratingClipStatus('daily_limit_reached')).toBe(false)
    expect(isGeneratingClipStatus('mirroring')).toBe(true)

    const hydrated: TurnEntry[] = [{
      ...turn,
      ttsSegments: [
        { segment_index: 0, status: 'completed', job_id: 'tts-h-0', url: '/tts/assets/asset-h.mp3', gain_db: -100 },
        { segment_index: 1, status: 'daily_limit_reached' },
        { segment_index: 2, status: 'not_narrated' },
      ],
    }]
    const merged = mergeHydratedTtsTurns([turn], hydrated)
    expect(hasNonTerminalTtsJob(merged[0])).toBe(false)
    expect(nonTerminalTtsJobIds(merged[0])).toEqual([])
    expect(merged[0].ttsSegments!.map((clip) => clip.status)).toEqual(['completed', 'daily_limit_reached', 'not_narrated'])
    expect(merged[0].ttsSegments![0].gain_db).toBe(-24)
  })
})
