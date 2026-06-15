import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})
