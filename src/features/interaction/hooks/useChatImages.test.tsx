import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatImageGeneration, TurnEntry } from '../../../shared'
import { ApiError, ChatImagesUnsupportedError } from '../../../infrastructure/api'
import type { ChatImageFrame } from '../utils/chatImageStore'
import { useChatImages, type UseChatImagesOptions } from './useChatImages'

function jobFrame(messageId: number, jobId: string, trigger?: 'auto' | 'regenerate'): ChatImageFrame {
    return { type: 'image_job', adventure_id: 7, assistant_message_id: messageId, turn_id: `turn-${messageId}`, job_id: jobId, status: 'pending',
        status_url: '', result_url: '', ...(trigger ? { generation: { trigger } } : {}) }
}

function makeApi() {
    return {
        getImageJob: vi.fn(async (jobId: string) => ({ job_id: jobId, status: 'in_progress' as const, status_url: '', result_url: '' })),
        generateChatMessageImage: vi.fn(async (): Promise<ChatImageGeneration | null> => ({ job_id: 'img-new', status: 'pending', assets: [], trigger: 'regenerate', created_at: '2026-07-01T00:05:00Z' })),
        listChatMessageImages: vi.fn(async (): Promise<ChatImageGeneration[]> => []),
    }
}

function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
}

function setup(overrides: Partial<UseChatImagesOptions> = {}) {
    const api = makeApi()
    const view = renderHook((props: Partial<UseChatImagesOptions>) => useChatImages({ api, basePath: 'adventure-sessions', sessionId: 7, active: true, ...props }), { initialProps: overrides })
    return { api, ...view }
}

async function advance(ms: number) {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('useChatImages', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        setVisibility('visible')
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('polls every unfinished job with a 2 s, 4 s, then 10 s backoff', async () => {
        const { api, result } = setup()
        act(() => {
            result.current.applyFrame(jobFrame(101, 'img-1'))
            result.current.applyFrame(jobFrame(202, 'img-2'))
        })

        await advance(1_999)
        expect(api.getImageJob).not.toHaveBeenCalled()
        await advance(1)
        expect(api.getImageJob.mock.calls.map(([id]) => id)).toEqual(['img-1', 'img-2'])

        await advance(4_000)
        expect(api.getImageJob).toHaveBeenCalledTimes(4)
        await advance(9_000)
        expect(api.getImageJob).toHaveBeenCalledTimes(4)
        await advance(1_000)
        expect(api.getImageJob).toHaveBeenCalledTimes(6)
    })

    it('stops polling a job once it finishes and shows its asset', async () => {
        const { api, result } = setup()
        api.getImageJob.mockResolvedValueOnce({ job_id: 'img-1', status: 'completed', status_url: '', result_url: '',
            assets: [{ asset_id: 'a1', url: '/generated-images/a1.png', content_type: 'image/png' }] } as never)
        act(() => result.current.applyFrame(jobFrame(101, 'img-1')))
        await advance(2_000)
        expect(result.current.views.get(101)?.generations[0]).toMatchObject({ status: 'completed' })
        await advance(30_000)
        expect(api.getImageJob).toHaveBeenCalledTimes(1)
    })

    it('keeps polling while the window is visible but unfocused, and pauses while hidden', async () => {
        vi.spyOn(document, 'hasFocus').mockReturnValue(false)
        const { api, result } = setup()
        act(() => result.current.applyFrame(jobFrame(101, 'img-1')))
        await advance(2_000)
        expect(api.getImageJob).toHaveBeenCalledTimes(1)

        setVisibility('hidden')
        await advance(30_000)
        expect(api.getImageJob).toHaveBeenCalledTimes(1)

        // Back on screen, an overdue poll runs right away.
        setVisibility('visible')
        await advance(0)
        expect(api.getImageJob).toHaveBeenCalledTimes(2)
    })

    it('does not poll while the session is not the committed workspace', async () => {
        const { api, result } = setup({ active: false })
        act(() => result.current.applyFrame(jobFrame(101, 'img-1')))
        await advance(20_000)
        expect(api.getImageJob).not.toHaveBeenCalled()
    })

    it('looks a scheduled image up at 10 s and offers Retry at 30 s', async () => {
        const { api, result } = setup()
        act(() => result.current.markScheduled(101, true))
        expect(result.current.views.get(101)).toMatchObject({ scheduled: true, stalled: false, generations: [] })

        await advance(9_999)
        expect(api.listChatMessageImages).not.toHaveBeenCalled()
        await advance(1)
        expect(api.listChatMessageImages).toHaveBeenCalledWith('adventure-sessions', 7, 101)

        await advance(20_000)
        expect(result.current.views.get(101)).toMatchObject({ scheduled: true, stalled: true })
        expect(api.listChatMessageImages).toHaveBeenCalledTimes(1)
    })

    it('adopts the job the 10 s lookup finds and ends the wait', async () => {
        const { api, result } = setup()
        api.listChatMessageImages.mockResolvedValueOnce([{ job_id: 'img-1', status: 'in_progress', assets: [] }])
        act(() => result.current.markScheduled(101, true))
        await advance(10_000)
        expect(result.current.views.get(101)).toMatchObject({ scheduled: false, selectedJobId: 'img-1' })
        await advance(30_000)
        expect(result.current.views.get(101)?.stalled).toBe(false)
    })

    it('regenerates optimistically, jumps to the new image and keeps a page-back choice', async () => {
        const { api, result } = setup()
        act(() => result.current.adoptHydrated([{ id: '101', type: 'ai', content: '', timestamp: '', assistantMessageId: 101,
            imageGenerations: [{ job_id: 'img-1', status: 'completed', assets: [], created_at: '2026-07-01T00:00:00Z' }] } as TurnEntry]))
        let finish!: (value: ChatImageGeneration | null) => void
        api.generateChatMessageImage.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))

        let outcome: Promise<string> | undefined
        act(() => { outcome = result.current.regenerate(101, { prompt: ' A storm over the keep. ' }) })
        const pending = result.current.views.get(101)!
        expect(pending.generations).toHaveLength(2)
        expect(pending.generations[1]).toMatchObject({ status: 'pending', trigger: 'regenerate', prompt: 'A storm over the keep.', prompt_edited: true })
        expect(pending.selectedJobId).toBe(pending.generations[1].job_id)
        expect(api.generateChatMessageImage).toHaveBeenCalledWith('adventure-sessions', 7, 101, { prompt: 'A storm over the keep.' })

        // The player pages back while the new one is still starting.
        act(() => result.current.select(101, 'img-1'))
        await act(async () => {
            finish({ job_id: 'img-new', status: 'pending', assets: [], trigger: 'regenerate', prompt_edited: true, created_at: '2026-07-01T00:05:00Z' })
            await outcome
        })
        const settled = result.current.views.get(101)!
        expect(settled.generations.map((generation) => generation.job_id)).toEqual(['img-1', 'img-new'])
        expect(settled.selectedJobId).toBe('img-1')
        await expect(outcome).resolves.toBe('started')
    })

    it('lets the socket frame of a regenerate take the placeholder place', async () => {
        const { api, result } = setup()
        let finish!: (value: ChatImageGeneration | null) => void
        api.generateChatMessageImage.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
        act(() => { void result.current.regenerate(101) })
        // Frames carry ids and status only: a job new to the message is taken as the regenerate.
        act(() => result.current.applyFrame(jobFrame(101, 'img-live')))
        expect(result.current.views.get(101)!.generations.map((generation) => generation.job_id)).toEqual(['img-live'])

        await act(async () => { finish({ job_id: 'img-live', status: 'pending', assets: [], trigger: 'regenerate' }) })
        expect(result.current.views.get(101)!.generations.map((generation) => generation.job_id)).toEqual(['img-live'])
    })

    it('keeps the placeholder of a slow regenerate until the listing delivers its job', async () => {
        const { api, result } = setup()
        api.generateChatMessageImage.mockResolvedValueOnce(null)
        api.listChatMessageImages.mockResolvedValueOnce([
            { job_id: 'img-slow', status: 'pending', assets: [], trigger: 'regenerate', created_at: '2026-07-01T00:05:00Z' },
            { job_id: 'img-1', status: 'completed', assets: [], trigger: 'auto', created_at: '2026-07-01T00:00:00Z' },
        ])
        await act(async () => { await result.current.regenerate(101) })
        expect(api.listChatMessageImages).toHaveBeenCalledWith('adventure-sessions', 7, 101)
        // Newest-first from the server, oldest-first on screen, and no placeholder left behind.
        expect(result.current.views.get(101)!.generations.map((generation) => generation.job_id)).toEqual(['img-1', 'img-slow'])
    })

    it('shows a refused regenerate as a quota failure on the turn', async () => {
        const { api, result } = setup()
        api.generateChatMessageImage.mockRejectedValueOnce(new ApiError(429, 'You have used your images for today.', { code: 'QUOTA_EXCEEDED', category: 'quota' }))
        await act(async () => { await expect(result.current.regenerate(101)).resolves.toBe('failed') })
        const view = result.current.views.get(101)!
        expect(view.generations).toEqual([])
        expect(view.startFailure).toMatchObject({ status: 'quota_exceeded', error: { code: 'quota_exceeded', detail: 'You have used your images for today.' } })
    })

    it('hides regenerate on a server without the endpoint', async () => {
        const { api, result } = setup()
        api.generateChatMessageImage.mockRejectedValueOnce(new ChatImagesUnsupportedError(404))
        await act(async () => { await expect(result.current.regenerate(101)).resolves.toBe('unsupported') })
        expect(result.current.supported).toBe(false)
        expect(result.current.views.get(101)?.generations).toEqual([])
        await act(async () => { await expect(result.current.regenerate(101)).resolves.toBe('skipped') })
        expect(api.generateChatMessageImage).toHaveBeenCalledTimes(1)
    })

    it('keeps the view object of a message whose images did not change', () => {
        const { result } = setup()
        act(() => result.current.applyFrame(jobFrame(101, 'img-1')))
        const first = result.current.views.get(101)
        act(() => result.current.applyFrame(jobFrame(202, 'img-2')))
        expect(result.current.views.get(101)).toBe(first)
        const turns = [{ id: '202', type: 'ai', content: '', timestamp: '', assistantMessageId: 202,
            imageGenerations: [{ job_id: 'img-2', status: 'pending', assets: [] }] } as TurnEntry]
        const before = result.current.views
        act(() => result.current.adoptHydrated(turns))
        act(() => result.current.adoptHydrated(turns))
        expect(result.current.views).toBe(before)
    })
})
