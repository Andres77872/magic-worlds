import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { AUTO_NARRATION_PAUSE_HOLD_MS, useAutoNarrationPause } from './useAutoNarrationPause'

function apiWith(status?: Record<string, boolean>) {
    const capabilities = toVoiceCapabilities({ surfaces: {}, ...(status ? { status } : {}) })!
    return { getVoiceCapabilities: vi.fn(async () => capabilities) }
}

describe('useAutoNarrationPause (D37)', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('reads the capability pause only while auto-narrate is active', async () => {
        const api = apiWith({ auto_narration_paused: true })
        const { result, rerender } = renderHook(({ active }) => useAutoNarrationPause(api, active, 0), { initialProps: { active: false } })

        await act(async () => {})
        expect(api.getVoiceCapabilities).not.toHaveBeenCalled()
        expect(result.current.paused).toBe(false)

        rerender({ active: true })
        await waitFor(() => expect(result.current.paused).toBe(true))
    })

    it('fails open on a server without the status or a failed read', async () => {
        const absent = apiWith()
        const { result } = renderHook(() => useAutoNarrationPause(absent, true, 0))
        await waitFor(() => expect(absent.getVoiceCapabilities).toHaveBeenCalled())
        expect(result.current.paused).toBe(false)

        const failing = { getVoiceCapabilities: vi.fn(async () => { throw new Error('404') }) }
        const second = renderHook(() => useAutoNarrationPause(failing, true, 0))
        await waitFor(() => expect(failing.getVoiceCapabilities).toHaveBeenCalled())
        expect(second.result.current.paused).toBe(false)
    })

    it('holds a server refusal for a while, then lets auto-narration try again', () => {
        vi.useFakeTimers()
        const api = apiWith()
        const { result } = renderHook(() => useAutoNarrationPause(api, false, 0))

        act(() => result.current.reportPaused())
        expect(result.current.paused).toBe(true)

        act(() => {
            vi.advanceTimersByTime(AUTO_NARRATION_PAUSE_HOLD_MS + 1)
        })
        expect(result.current.paused).toBe(false)
    })
})
