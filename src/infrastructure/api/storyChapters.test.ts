import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from './index'

const fetchMock = vi.fn()

describe('Story chapter API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'true')
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'test-token')
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
    })

    it.each([2400, null])('persists the stored nullable wordGoal value %s', async (wordGoal) => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'chapter-1', wordGoal }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }))

        await apiService.updateStoryChapter('story-1', 'chapter-1', { wordGoal })

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toMatch(/\/stories\/story-1\/chapters\/chapter-1$/)
        expect(init.method).toBe('PUT')
        expect(init.headers).toMatchObject({ Authorization: 'Bearer test-token' })
        expect(JSON.parse(String(init.body))).toEqual({ wordGoal })
    })
})
