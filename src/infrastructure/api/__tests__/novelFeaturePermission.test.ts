import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '../index'
import { authSession } from '../authSession'
import { featureFlagRuntime } from '@/shared/featureFlagRuntime'
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'

const fetchMock = vi.fn()
const api = apiService.withWorkspace('0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b')
beforeEach(() => {
    authSession.authenticate('novel-member', 'novel-member-token')
    fetchMock.mockReset().mockImplementation(async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('novel plan permission at frontend dispatch', () => {
    it('blocks reads, annotations, snapshots and planning when absent or null before any fetch', async () => {
        setTestFeatureFlags({ novels: null }, { replace: true })
        await expect(api.getStories()).rejects.toThrow('Novels are disabled.')
        await expect(api.getStory('story')).rejects.toThrow('Novels are disabled.')
        await expect(api.getStoryAnnotations('story')).rejects.toThrow('Novels are disabled.')
        await expect(api.getStorySnapshots('story')).rejects.toThrow('Novels are disabled.')
        await expect(api.getStoryAssistantPreferences()).rejects.toThrow('Novels are disabled.')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('permits a granted plan and stops the next request as soon as the grant is invalidated', async () => {
        setTestFeatureFlags({ novels: true }, { replace: true })
        expect(await api.getStories()).toEqual([])
        expect(fetchMock).toHaveBeenCalledOnce()
        featureFlagRuntime.invalidate()
        await expect(api.getStories()).rejects.toThrow('Novels are disabled.')
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it('lets root dispatch without a snapshot and without fetching permissions', async () => {
        const owner = authSession.getSnapshot()
        featureFlagRuntime.setOwner(owner.accountKey, owner.userHash, true)
        expect(await api.getStories()).toEqual([])
        expect(fetchMock).toHaveBeenCalledOnce()
        expect(String(fetchMock.mock.calls[0][0])).toContain('/stories')
        expect(featureFlagRuntime.getSnapshot().snapshot).toBeNull()
    })
})
