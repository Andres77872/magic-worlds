import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError, apiService } from '../index'
import { PROGRESS_STORY, writingProgress } from '@/test/fixtures/storyProgress'

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('magic_worlds:token', 'token-1')
    vi.stubGlobal('fetch', fetchMock)
    setTestFeatureFlags({ novels: true })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear() })

it('reads the progress for one time zone and window and verifies it', async () => {
    fetchMock.mockResolvedValueOnce(json(writingProgress()))
    const value = await apiService.getStoryWritingProgress(PROGRESS_STORY, { timeZone: 'America/Mexico_City', days: 7 })
    expect(value.activeWords).toBe(629)
    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    expect(url.pathname).toMatch(new RegExp(`/stories/${PROGRESS_STORY}/writing-progress$`))
    expect(Object.fromEntries(url.searchParams)).toEqual({ timeZone: 'America/Mexico_City', days: '7' })
})

it('refuses a reply for another window, and invalid requests before any call', async () => {
    fetchMock.mockResolvedValueOnce(json(writingProgress()))
    await expect(apiService.getStoryWritingProgress(PROGRESS_STORY, { timeZone: 'America/Mexico_City', days: 30 })).rejects.toMatchObject({ code: 'story_progress_contract' })
    for (const request of [{ timeZone: '', days: 7 }, { timeZone: 'UTC', days: 0 }, { timeZone: 'UTC', days: 367 }])
        await expect(apiService.getStoryWritingProgress(PROGRESS_STORY, request)).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
})
