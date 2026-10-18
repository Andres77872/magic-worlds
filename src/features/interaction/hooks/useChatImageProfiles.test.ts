import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { kreaProfile, personalProfile, userList } from '@/features/imageProfiles/imageProfileFixtures'
import { useChatImageProfiles } from './useChatImageProfiles'

describe('useChatImageProfiles', () => {
    it('loads the chat profiles and the default a turn runs on', async () => {
        const api = { getImageProfiles: vi.fn().mockResolvedValue(userList) }
        const { result } = renderHook(() => useChatImageProfiles(api, true))

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.profiles.map(profile => profile.profile_id)).toContain(personalProfile.profile_id)
        expect(result.current.profiles.every(profile => profile.provider === 'fal')).toBe(true)
        expect(result.current.defaultId).toBe(kreaProfile.profile_id)
    })

    it('waits until images are available', () => {
        const api = { getImageProfiles: vi.fn().mockResolvedValue(userList) }
        renderHook(() => useChatImageProfiles(api, false))
        expect(api.getImageProfiles).not.toHaveBeenCalled()
    })

    it('tells a server with images off from a failed load, and retries on demand', async () => {
        const off = { getImageProfiles: vi.fn().mockRejectedValue(new ApiError(503, 'Image generation is unavailable.')) }
        const disabled = renderHook(() => useChatImageProfiles(off, true))
        await waitFor(() => expect(disabled.result.current.unavailable).toBe(true))
        expect(disabled.result.current.failed).toBe(false)

        const flaky = { getImageProfiles: vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(userList) }
        const { result } = renderHook(() => useChatImageProfiles(flaky, true))
        await waitFor(() => expect(result.current.failed).toBe(true))
        act(() => result.current.reload())
        await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0))
        expect(flaky.getImageProfiles).toHaveBeenCalledTimes(2)
    })
})
