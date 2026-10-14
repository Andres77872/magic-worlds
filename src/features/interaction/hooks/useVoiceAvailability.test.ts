import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FAIL_OPEN_VOICE_STATUS } from '@/shared/voice'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_EL_PLUS_BODY, BFF_R0_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import { FAIL_OPEN_VOICE_AVAILABILITY, useVoiceAvailability } from './useVoiceAvailability'

const off = toVoiceCapabilities({ surfaces: {}, status: { narration_available: false, calls_available: false, auto_narration_paused: true } })!

describe('useVoiceAvailability', () => {
    it('reads the server switches while active', async () => {
        const api = { getVoiceCapabilities: vi.fn(async () => off) }
        const { result } = renderHook(() => useVoiceAvailability(api, true))

        await waitFor(() => expect(result.current.calls_available).toBe(false))
        expect(result.current).toEqual({ narration_available: false, calls_available: false, auto_narration_paused: true, consentVersion: 'voice-v2' })
    })

    it('reads nothing and reports available while inactive', () => {
        const api = { getVoiceCapabilities: vi.fn(async () => off) }
        const { result } = renderHook(() => useVoiceAvailability(api, false))

        expect(api.getVoiceCapabilities).not.toHaveBeenCalled()
        expect(result.current).toEqual(FAIL_OPEN_VOICE_AVAILABILITY)
    })

    it('fails open without the read or on a failed read', async () => {
        expect(renderHook(() => useVoiceAvailability({}, true)).result.current).toEqual(FAIL_OPEN_VOICE_AVAILABILITY)

        const api = { getVoiceCapabilities: vi.fn(async () => { throw new Error('offline') }) }
        const { result } = renderHook(() => useVoiceAvailability(api, true))
        await waitFor(() => expect(api.getVoiceCapabilities).toHaveBeenCalled())
        expect(result.current).toEqual(FAIL_OPEN_VOICE_AVAILABILITY)
    })

    it('keeps the last reading when a refresh fails', async () => {
        const api = { getVoiceCapabilities: vi.fn<() => Promise<typeof off>>().mockResolvedValueOnce(off).mockRejectedValueOnce(new Error('offline')) }
        const { result, rerender } = renderHook(({ key }) => useVoiceAvailability(api, true, key), { initialProps: { key: 1 } })
        await waitFor(() => expect(result.current.narration_available).toBe(false))

        rerender({ key: 2 })
        await waitFor(() => expect(api.getVoiceCapabilities).toHaveBeenCalledTimes(2))
        expect(result.current.narration_available).toBe(false)
    })

    it('fails open with the voice-v2 consent version', () => {
        expect(FAIL_OPEN_VOICE_AVAILABILITY).toEqual({ ...FAIL_OPEN_VOICE_STATUS, consentVersion: 'voice-v2' })
        expect(FAIL_OPEN_VOICE_AVAILABILITY).not.toHaveProperty('providerRoute')
    })

    it('always reports the voice-v2 consent version, whatever the plan (I-68)', async () => {
        for (const body of [BFF_R0_BODY, BFF_EL_PLUS_BODY]) {
            const api = { getVoiceCapabilities: vi.fn(async () => toVoiceCapabilities(body)!) }
            const { result } = renderHook(() => useVoiceAvailability(api, true))
            await waitFor(() => expect(api.getVoiceCapabilities).toHaveBeenCalled())
            expect(result.current).toEqual({ ...FAIL_OPEN_VOICE_STATUS, consentVersion: 'voice-v2' })
        }
    })
})
