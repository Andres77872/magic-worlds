import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gptProfile, kreaProfile, personalProfile } from '@/features/imageProfiles/imageProfileFixtures'
import {
    chatImageChoice,
    chatImageSettingsKey,
    DEFAULT_CHAT_IMAGE_SETTINGS,
    readChatImageSettings,
    useChatImageSettings,
} from './useChatImageSettings'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('useChatImageSettings', () => {
    it('starts with images on and the default profile', () => {
        const { result } = renderHook(() => useChatImageSettings('character', '17'))
        expect(result.current.enabled).toBe(true)
        expect(result.current.profileId).toBeNull()
    })

    it('keeps the choice per chat and per kind', () => {
        const { result } = renderHook(() => useChatImageSettings('character', '17'))
        act(() => result.current.setEnabled(false))
        act(() => result.current.setProfileId(gptProfile.profile_id))

        expect(JSON.parse(localStorage.getItem(chatImageSettingsKey('character', '17'))!))
            .toEqual({ enabled: false, profileId: gptProfile.profile_id })
        // Another adventure has no entry of its own and adventures have no last-used choice yet.
        expect(readChatImageSettings('adventure', '17')).toEqual(DEFAULT_CHAT_IMAGE_SETTINGS)
    })

    it('starts a chat without its own entry from the last-used choice of its kind', () => {
        const draft = renderHook(() => useChatImageSettings('character', 'draft-1'))
        act(() => draft.result.current.setProfileId(kreaProfile.profile_id))

        // The draft's server id arrives: same choice, now stored under the real id on the next change.
        const saved = renderHook(() => useChatImageSettings('character', '42'))
        expect(saved.result.current.profileId).toBe(kreaProfile.profile_id)
    })

    it('re-reads storage when the chat changes under a mounted composer', () => {
        localStorage.setItem(chatImageSettingsKey('adventure', '1'), JSON.stringify({ enabled: false, profileId: null }))
        localStorage.setItem(chatImageSettingsKey('adventure', '2'), JSON.stringify({ enabled: true, profileId: gptProfile.profile_id }))
        const { result, rerender } = renderHook(({ id }) => useChatImageSettings('adventure', id), { initialProps: { id: '1' } })
        expect(result.current.enabled).toBe(false)

        rerender({ id: '2' })

        expect(result.current.enabled).toBe(true)
        expect(result.current.profileId).toBe(gptProfile.profile_id)
    })

    it('ignores malformed entries and survives storage that throws', () => {
        localStorage.setItem(chatImageSettingsKey('adventure', '1'), '{"enabled":"yes"}')
        localStorage.setItem(chatImageSettingsKey('adventure', '2'), JSON.stringify({ enabled: false, profileId: 'not-a-uuid' }))
        expect(readChatImageSettings('adventure', '1')).toEqual(DEFAULT_CHAT_IMAGE_SETTINGS)
        expect(readChatImageSettings('adventure', '2')).toEqual({ enabled: false, profileId: null })

        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
        const { result } = renderHook(() => useChatImageSettings('character', '9'))
        expect(result.current.enabled).toBe(true)
        act(() => result.current.setEnabled(false))
        expect(result.current.enabled).toBe(false)
    })
})

describe('chatImageChoice', () => {
    const profiles = [kreaProfile, gptProfile, personalProfile]

    it('turns images off, or on with the default or a chosen app profile', () => {
        expect(chatImageChoice({ enabled: false, profileId: gptProfile.profile_id }, profiles)).toEqual({ generate: false })
        expect(chatImageChoice({ enabled: true, profileId: null }, profiles)).toEqual({ generate: true })
        expect(chatImageChoice({ enabled: true, profileId: gptProfile.profile_id }, profiles))
            .toEqual({ generate: true, image_profile_id: gptProfile.profile_id })
    })

    it('never sends a profile that is no longer offered', () => {
        expect(chatImageChoice({ enabled: true, profileId: '0b6f1d7e-4f6a-4c55-9a1e-7a3f0c1d2eff' }, profiles)).toEqual({ generate: true })
    })

    it('keeps the chosen profile while the profiles are still loading', () => {
        expect(chatImageChoice({ enabled: true, profileId: gptProfile.profile_id }, null))
            .toEqual({ generate: true, image_profile_id: gptProfile.profile_id })
        expect(chatImageChoice({ enabled: true, profileId: null }, null)).toEqual({ generate: true })
    })

    it('names the provider of a personal profile so its key rides along, never the key itself', () => {
        expect(chatImageChoice({ enabled: true, profileId: personalProfile.profile_id }, profiles))
            .toEqual({ generate: true, image_profile_id: personalProfile.profile_id, byok_provider: 'fal' })
    })
})
