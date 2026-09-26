import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '../index'
import { makeRequestId } from '@/utils/uuid'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    })
}

describe('makeRequestId', () => {
    it('prefixes the id and yields unique values', () => {
        const a = makeRequestId('voice')
        const b = makeRequestId('voice')
        expect(a.startsWith('voice-')).toBe(true)
        expect(b.startsWith('voice-')).toBe(true)
        expect(a).not.toBe(b)
        // Non-empty suffix after the prefix.
        expect(a.length).toBeGreaterThan('voice-'.length)
    })
})

describe('pollUntilTerminal (via waitForImageJob)', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'test-token')
        vi.stubGlobal('fetch', fetchMock)
        vi.spyOn(document, 'hasFocus').mockReturnValue(true)
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('polls while non-terminal and returns once the status is terminal', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ job_id: 'img-1', status: 'in_progress' }))
            .mockResolvedValueOnce(jsonResponse({ job_id: 'img-1', status: 'completed' }))

        const job = await apiService.waitForImageJob('img-1', { intervalMs: 1 })

        expect(job.status).toBe('completed')
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('returns the latest job once the deadline passes even if still non-terminal', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ job_id: 'img-2', status: 'in_progress' }))

        // maxWaitMs:0 → deadline is immediately reached after the first poll.
        const job = await apiService.waitForImageJob('img-2', { intervalMs: 1, maxWaitMs: 0 })

        expect(job.status).toBe('in_progress')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('reports each polled job through onUpdate', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ job_id: 'img-3', status: 'pending' }))
            .mockResolvedValueOnce(jsonResponse({ job_id: 'img-3', status: 'completed' }))
        const seen: string[] = []

        await apiService.waitForImageJob('img-3', { intervalMs: 1, onUpdate: (j) => seen.push(j.status) })

        expect(seen).toEqual(['pending', 'completed'])
    })

    it('does not start polling until a hidden page becomes focused', async () => {
        vi.useFakeTimers()
        let visible = false
        let focused = false
        vi.mocked(document.hasFocus).mockImplementation(() => focused)
        vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible ? 'visible' : 'hidden')
        fetchMock.mockResolvedValue(jsonResponse({ job_id: 'img-4', status: 'completed' }))

        const waiting = apiService.waitForImageJob('img-4', { intervalMs: 1_000 })
        await vi.advanceTimersByTimeAsync(10_000)
        expect(fetchMock).not.toHaveBeenCalled()

        visible = true
        focused = true
        document.dispatchEvent(new Event('visibilitychange'))
        expect((await waiting).status).toBe('completed')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does not spend the wait deadline while hidden', async () => {
        vi.useFakeTimers()
        let visible = true
        let focused = true
        vi.mocked(document.hasFocus).mockImplementation(() => focused)
        vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible ? 'visible' : 'hidden')
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ job_id: 'img-slow', status: 'pending' }))
            .mockResolvedValueOnce(jsonResponse({ job_id: 'img-slow', status: 'in_progress' }))
            .mockResolvedValueOnce(jsonResponse({ job_id: 'img-slow', status: 'completed' }))

        const waiting = apiService.waitForImageJob('img-slow', { intervalMs: 1_000, maxWaitMs: 1_500 })
        await vi.advanceTimersByTimeAsync(0)
        expect(fetchMock).toHaveBeenCalledTimes(1)

        visible = false
        focused = false
        document.dispatchEvent(new Event('visibilitychange'))
        await vi.advanceTimersByTimeAsync(180_000)
        expect(fetchMock).toHaveBeenCalledTimes(1)

        visible = true
        focused = true
        document.dispatchEvent(new Event('visibilitychange'))
        await vi.advanceTimersByTimeAsync(0)
        expect(fetchMock).toHaveBeenCalledTimes(2)

        await vi.advanceTimersByTimeAsync(1_000)
        expect((await waiting).status).toBe('completed')
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('stops waiting if generation is aborted while the page is hidden', async () => {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
        const controller = new AbortController()

        const waiting = apiService.waitForImageJob('img-aborted', { signal: controller.signal })
        controller.abort()

        await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('pauses a pending job while blurred and polls immediately on focus', async () => {
        vi.useFakeTimers()
        let focused = true
        vi.mocked(document.hasFocus).mockImplementation(() => focused)
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ job_id: 'img-5', status: 'pending' }))
            .mockResolvedValueOnce(jsonResponse({ job_id: 'img-5', status: 'completed' }))

        const waiting = apiService.waitForImageJob('img-5', { intervalMs: 1_000 })
        await vi.advanceTimersByTimeAsync(0)
        expect(fetchMock).toHaveBeenCalledTimes(1)

        focused = false
        window.dispatchEvent(new Event('blur'))
        await vi.advanceTimersByTimeAsync(10_000)
        expect(fetchMock).toHaveBeenCalledTimes(1)

        focused = true
        window.dispatchEvent(new Event('focus'))
        expect((await waiting).status).toBe('completed')
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
