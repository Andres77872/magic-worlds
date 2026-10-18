import { describe, expect, it } from 'vitest'
import type { ChatImageGeneration, TurnEntry } from '../../../shared'
import {
  applyFrame,
  applyJobResult,
  EMPTY_CHAT_IMAGES,
  hydratedGenerationsFromTurns,
  isSafeAssetUrl,
  legacyGenerationFromMetadata,
  markScheduled,
  mergeHydrated,
  nonTerminalJobIds,
  parseGenerations,
  putGeneration,
  scheduledWithoutJob,
  type ChatImageFrame,
} from './chatImageStore'

const asset = (id: string) => ({ asset_id: id, url: `/generated-images/${id}.png`, content_type: 'image/png' as const })

function jobFrame(messageId: number, jobId: string, status: 'pending' | 'in_progress' | 'mirroring' = 'pending'): ChatImageFrame {
  return { type: 'image_job', adventure_id: 7, assistant_message_id: messageId, turn_id: `turn-${messageId}`, job_id: jobId, status, status_url: `/images/jobs/${jobId}`, result_url: `/images/jobs/${jobId}/result` }
}

function completeFrame(messageId: number, jobId: string, assetId = jobId): ChatImageFrame {
  return { type: 'image_complete', adventure_id: 7, assistant_message_id: messageId, turn_id: `turn-${messageId}`, job_id: jobId, status: 'completed', assets: [asset(assetId)] }
}

describe('chatImageStore', () => {
  it('keeps a frame for an unknown message on that message, never on another turn', () => {
    const seeded = applyFrame(EMPTY_CHAT_IMAGES, completeFrame(101, 'img-1'))
    const next = applyFrame(seeded, jobFrame(202, 'img-2'))
    expect(next.get(101)?.generations.map((generation) => generation.job_id)).toEqual(['img-1'])
    expect(next.get(202)?.generations.map((generation) => generation.job_id)).toEqual(['img-2'])
  })

  it('ignores frames without a usable message id', () => {
    const frame = { ...jobFrame(101, 'img-1'), assistant_message_id: 0 }
    expect(applyFrame(EMPTY_CHAT_IMAGES, frame)).toBe(EMPTY_CHAT_IMAGES)
  })

  it('keeps and polls a second job after the first one completed', () => {
    let map = applyFrame(EMPTY_CHAT_IMAGES, jobFrame(101, 'img-1'))
    map = applyFrame(map, completeFrame(101, 'img-1'))
    map = applyFrame(map, jobFrame(101, 'img-2', 'in_progress'))

    const generations = map.get(101)!.generations
    expect(generations.map((generation) => [generation.job_id, generation.status])).toEqual([['img-1', 'completed'], ['img-2', 'in_progress']])
    expect(generations[0].assets).toEqual([asset('img-1')])
    expect(nonTerminalJobIds(map)).toEqual(['img-2'])
  })

  it('lets a terminal status win per job and never moves it back to running', () => {
    let map = applyFrame(EMPTY_CHAT_IMAGES, completeFrame(101, 'img-1'))
    map = applyFrame(map, jobFrame(101, 'img-1', 'in_progress'))
    expect(map.get(101)!.generations[0]).toMatchObject({ status: 'completed', assets: [asset('img-1')] })

    const settled = map
    map = applyJobResult(map, { job_id: 'img-1', status: 'mirroring' })
    expect(map).toBe(settled)
  })

  it('folds polled results into the job that owns them and leaves unknown jobs alone', () => {
    let map = applyFrame(EMPTY_CHAT_IMAGES, jobFrame(101, 'img-1'))
    map = applyJobResult(map, { job_id: 'img-1', status: 'completed', assets: [asset('a1')] })
    expect(map.get(101)!.generations[0]).toMatchObject({ status: 'completed', assets: [asset('a1')] })
    expect(applyJobResult(map, { job_id: 'img-unknown', status: 'completed', assets: [asset('a2')] })).toBe(map)
  })

  it('keeps known assets when a later source leaves them out', () => {
    let map = applyFrame(EMPTY_CHAT_IMAGES, completeFrame(101, 'img-1'))
    map = applyJobResult(map, { job_id: 'img-1', status: 'completed' })
    expect(map.get(101)!.generations[0].assets).toEqual([asset('img-1')])
  })

  it('shows "starting" from done until the first frame, and a job-less failure ends it', () => {
    let map = markScheduled(EMPTY_CHAT_IMAGES, 101, true, 1_000)
    expect(scheduledWithoutJob(map)).toEqual([{ messageId: 101, scheduledAt: 1_000 }])

    map = applyFrame(map, {
      type: 'image_failed', adventure_id: 7, assistant_message_id: 101, turn_id: 'turn-101', job_id: null, status: 'quota_exceeded',
      error: { category: 'quota', detail: 'You have used your images for today.', code: 'quota_exceeded' },
    })
    expect(map.get(101)!.scheduled).toBeUndefined()
    expect(map.get(101)!.startFailure).toMatchObject({ status: 'quota_exceeded', error: { code: 'quota_exceeded' } })
    expect(scheduledWithoutJob(map)).toEqual([])
  })

  it('clears "starting" when the job arrives and ignores a schedule after the job raced ahead', () => {
    let map = markScheduled(EMPTY_CHAT_IMAGES, 101, true, 1_000)
    map = applyFrame(map, jobFrame(101, 'img-1'))
    expect(map.get(101)!.scheduled).toBeUndefined()

    const raced = applyFrame(EMPTY_CHAT_IMAGES, jobFrame(202, 'img-2'))
    expect(markScheduled(raced, 202, true, 2_000)).toBe(raced)
    expect(markScheduled(EMPTY_CHAT_IMAGES, 303, false, 0)).toBe(EMPTY_CHAT_IMAGES)
  })

  it('hydrates as a union by job id, newest last, keeping live-only jobs and identity when unchanged', () => {
    let map = applyFrame(EMPTY_CHAT_IMAGES, completeFrame(101, 'img-2'))
    map = applyFrame(map, jobFrame(202, 'img-9'))
    const other = map.get(202)
    const server: ChatImageGeneration[] = [
      { job_id: 'img-1', status: 'completed', assets: [asset('a1')], created_at: '2026-07-01T00:00:00Z', prompt: 'A torchlit hall.' },
      { job_id: 'img-2', status: 'in_progress', assets: [], created_at: '2026-07-01T00:01:00Z', prompt: 'A torchlit hall, again.' },
    ]
    map = mergeHydrated(map, new Map([[101, server]]))

    const generations = map.get(101)!.generations
    expect(generations.map((generation) => generation.job_id)).toEqual(['img-1', 'img-2'])
    // The live terminal status wins; the server's details are adopted.
    expect(generations[1]).toMatchObject({ status: 'completed', assets: [asset('img-2')], prompt: 'A torchlit hall, again.' })
    expect(map.get(202)).toBe(other)
    expect(mergeHydrated(map, new Map([[101, server]]))).toBe(map)
  })

  it('reads hydration input only from assistant turns that carry generations', () => {
    const generations: ChatImageGeneration[] = [{ job_id: 'img-1', status: 'completed', assets: [] }]
    const turns: TurnEntry[] = [
      { id: '1', type: 'user', content: 'Hi', timestamp: '' },
      { id: '2', type: 'ai', content: 'Hello', timestamp: '', assistantMessageId: 2, imageGenerations: generations },
      { id: '3', type: 'ai', content: 'Streaming', timestamp: '' },
    ]
    expect([...hydratedGenerationsFromTurns(turns)]).toEqual([[2, generations]])
  })

  it('maps a legacy metadata slot and skips rows without a job id', () => {
    expect(legacyGenerationFromMetadata({
      image_job: { job_id: 'img-1', status_url: '/images/jobs/img-1' },
      image_job_status: 'failed',
      image_job_error: { category: 'provider', detail: 'Provider failed.' },
      turn_metadata: { imagePrompt: 'A secret door behind the shelves.' },
    }, 5)).toMatchObject({ job_id: 'img-1', status: 'failed', assistant_message_id: 5, error: { detail: 'Provider failed.' }, prompt: 'A secret door behind the shelves.' })
    expect(legacyGenerationFromMetadata({ image_job_status: 'failed' })).toBeNull()
  })

  it('filters unsafe asset urls and error text but never the prompt', () => {
    const map = mergeHydrated(EMPTY_CHAT_IMAGES, new Map([[101, [{
      job_id: 'img-1',
      status: 'failed',
      prompt: 'Bearer of the secret flame, see https://example.test',
      assets: [
        { asset_id: 'raw', url: 'https://v3.fal.media/files/raw.png', content_type: 'image/png' },
        { asset_id: 'signed', url: '/images/a.png?X-Amz-Signature=abc', content_type: 'image/png' },
        { asset_id: 'ok', url: '/generated-images/ok.png', content_type: 'image/png' },
      ],
      error: { category: 'provider', detail: 'Failed at https://internal.test/var/log' },
    } satisfies ChatImageGeneration]]]))
    const [generation] = map.get(101)!.generations
    expect(generation.assets.map((entry) => entry.asset_id)).toEqual(['ok'])
    expect(generation.error?.detail).toBe('Image generation failed.')
    expect(generation.prompt).toBe('Bearer of the secret flame, see https://example.test')
    expect(isSafeAssetUrl('//evil.test/x.png')).toBe(false)
    expect(isSafeAssetUrl('data:image/png;base64,AAAA')).toBe(false)
  })

  it('lets a new non-automatic job take the place of the oldest regenerate placeholder', () => {
    const placeholder = (id: string): ChatImageGeneration => ({ job_id: `local:${id}`, status: 'pending', assets: [], trigger: 'regenerate' })
    let map = putGeneration(EMPTY_CHAT_IMAGES, 101, { job_id: 'img-1', status: 'completed', assets: [asset('a1')], trigger: 'auto', created_at: '2026-07-01T00:00:00Z' })
    map = putGeneration(putGeneration(map, 101, placeholder('a')), 101, placeholder('b'))
    const ids = () => map.get(101)!.generations.map((generation) => generation.job_id)

    // A frame carries no trigger: its new job is the regenerate.
    map = applyFrame(map, jobFrame(101, 'img-2'))
    expect(ids()).toEqual(['img-1', 'local:b', 'img-2'])
    // The POST answer names its own placeholder and never takes another one.
    map = putGeneration(map, 101, { job_id: 'img-3', status: 'pending', assets: [], trigger: 'regenerate' }, 'local:x')
    expect(ids()).toEqual(['img-1', 'local:b', 'img-2', 'img-3'])
    // The listing's automatic image is not a regenerate.
    map = mergeHydrated(map, new Map([[101, [{ job_id: 'img-0', status: 'completed', assets: [], trigger: 'auto', created_at: '2026-06-30T00:00:00Z' }]]]))
    expect(ids()).toEqual(['img-0', 'img-1', 'local:b', 'img-2', 'img-3'])
  })

  it('keeps a job first seen live ahead of a later dated regenerate, and sorts once all are dated', () => {
    let map = applyFrame(EMPTY_CHAT_IMAGES, completeFrame(101, 'img-1'))
    map = putGeneration(map, 101, { job_id: 'img-2', status: 'pending', assets: [], trigger: 'regenerate', created_at: '2026-07-01T00:05:00Z' })
    expect(map.get(101)!.generations.map((generation) => generation.job_id)).toEqual(['img-1', 'img-2'])

    map = mergeHydrated(map, new Map([[101, [
      { job_id: 'img-0', status: 'completed', assets: [], created_at: '2026-07-01T00:00:00Z' },
      { job_id: 'img-1', status: 'completed', assets: [], created_at: '2026-07-01T00:01:00Z' },
    ]]]))
    expect(map.get(101)!.generations.map((generation) => generation.job_id)).toEqual(['img-0', 'img-1', 'img-2'])
  })

  it('reads a newest-first server list oldest first, ties included', () => {
    const at = '2026-07-01T00:00:00Z'
    const parsed = parseGenerations([
      { job_id: 'img-3', status: 'pending', assets: [], created_at: at },
      { job_id: 'img-2', status: 'completed', assets: [], created_at: at },
      { job_id: 'img-1', status: 'completed', assets: [], created_at: '2026-06-30T00:00:00Z', credential_mode: 'user_byok', provider: 'fal', prompt_edited: false },
    ], 101)
    expect(parsed?.map((generation) => generation.job_id)).toEqual(['img-1', 'img-2', 'img-3'])
    expect(parsed?.[0]).toMatchObject({ credential_mode: 'user_byok', provider: 'fal', prompt_edited: false, assistant_message_id: 101 })
  })
})
