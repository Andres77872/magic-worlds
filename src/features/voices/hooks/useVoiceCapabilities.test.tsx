import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CAPABILITIES_EL_FREE, CAPABILITIES_EL_PLUS } from '../fixtures'
import { useVoiceCapabilities } from './useVoiceCapabilities'

vi.mock('@/infrastructure/api', () => ({ apiService: {} }))

describe('useVoiceCapabilities', () => {
    it('settles at once, without loading, when the api cannot read capabilities', () => {
        const { result } = renderHook(() => useVoiceCapabilities())
        expect(result.current).toMatchObject({ loading: false, capabilities: null, error: null })
        const { result: nullApi } = renderHook(() => useVoiceCapabilities({ api: null }))
        expect(nullApi.current).toMatchObject({ loading: false, capabilities: null })
    })

    it('reads the account capabilities', async () => {
        const api = { getVoiceCapabilities: vi.fn().mockResolvedValue(CAPABILITIES_EL_PLUS) }
        const { result } = renderHook(() => useVoiceCapabilities({ api }))
        expect(result.current.loading).toBe(true)
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.capabilities).toBe(CAPABILITIES_EL_PLUS)
        expect(result.current.error).toBeNull()
        expect(api.getVoiceCapabilities).toHaveBeenCalledWith({})
    })

    it('gives null capabilities and the error on a 404 or any failure', async () => {
        const failure = Object.assign(new Error('Not Found'), { status: 404 })
        const failed = renderHook(() => useVoiceCapabilities({ api: { getVoiceCapabilities: vi.fn().mockRejectedValue(failure) } }))
        await waitFor(() => expect(failed.result.current.loading).toBe(false))
        expect(failed.result.current).toMatchObject({ capabilities: null, error: failure })

        const empty = renderHook(() => useVoiceCapabilities({ api: { getVoiceCapabilities: vi.fn().mockResolvedValue(undefined) } }))
        await waitFor(() => expect(empty.result.current.loading).toBe(false))
        expect(empty.result.current).toMatchObject({ capabilities: null, error: null })
    })

    it('does not read while disabled', () => {
        const api = { getVoiceCapabilities: vi.fn() }
        const { result } = renderHook(() => useVoiceCapabilities({ api, enabled: false }))
        expect(result.current).toMatchObject({ capabilities: null, loading: false })
        expect(api.getVoiceCapabilities).not.toHaveBeenCalled()
    })

    it('settles on the first render from a warm cache, then still reads', async () => {
        const api = { getVoiceCapabilities: vi.fn().mockResolvedValue(CAPABILITIES_EL_FREE), peekVoiceCapabilities: vi.fn(() => CAPABILITIES_EL_PLUS) }
        const { result } = renderHook(() => useVoiceCapabilities({ api }))
        expect(result.current).toMatchObject({ loading: false, capabilities: CAPABILITIES_EL_PLUS })
        await waitFor(() => expect(api.getVoiceCapabilities).toHaveBeenCalledWith({}))
        await waitFor(() => expect(result.current.capabilities).toBe(CAPABILITIES_EL_FREE))
    })

    it('waits for the read when the cache is cold or the peek throws', () => {
        const cold = renderHook(() => useVoiceCapabilities({ api: { getVoiceCapabilities: () => new Promise(() => undefined), peekVoiceCapabilities: () => null } }))
        expect(cold.result.current).toMatchObject({ capabilities: null, loading: true })
        const throwing = renderHook(() => useVoiceCapabilities({
            api: { getVoiceCapabilities: () => new Promise(() => undefined), peekVoiceCapabilities: () => { throw new Error('not a function') } },
        }))
        expect(throwing.result.current).toMatchObject({ capabilities: null, loading: true })
    })

    it('forgets the answer when the read is disabled, so a re-enable never shows the old one', async () => {
        let cold = true
        const api = {
            getVoiceCapabilities: vi.fn().mockResolvedValueOnce(CAPABILITIES_EL_PLUS).mockImplementation(() => new Promise(() => undefined)),
            peekVoiceCapabilities: vi.fn(() => (cold ? null : CAPABILITIES_EL_FREE)),
        }
        const { result, rerender } = renderHook(({ enabled }) => useVoiceCapabilities({ api, enabled }), { initialProps: { enabled: true } })
        await waitFor(() => expect(result.current.capabilities).toBe(CAPABILITIES_EL_PLUS))

        rerender({ enabled: false })
        expect(result.current).toMatchObject({ capabilities: null, loading: false, error: null })

        // Another session, cold cache: loading, not the previous answer.
        rerender({ enabled: true })
        expect(result.current).toMatchObject({ capabilities: null, loading: true })
        await waitFor(() => expect(api.getVoiceCapabilities).toHaveBeenCalledTimes(2))
        expect(result.current).toMatchObject({ capabilities: null, loading: true })

        // A warm cache answers the re-enable on its first render.
        rerender({ enabled: false })
        cold = false
        rerender({ enabled: true })
        expect(result.current).toMatchObject({ capabilities: CAPABILITIES_EL_FREE, loading: false })
    })

    it('forgets a retry when the read is disabled, so a re-enable peeks the warm cache and reads through it', async () => {
        let cold = true
        const api = {
            getVoiceCapabilities: vi.fn()
                .mockRejectedValueOnce(new Error('down'))
                .mockResolvedValueOnce(CAPABILITIES_EL_PLUS)
                .mockImplementation(() => new Promise(() => undefined)),
            peekVoiceCapabilities: vi.fn(() => (cold ? null : CAPABILITIES_EL_FREE)),
        }
        const { result, rerender } = renderHook(({ enabled }) => useVoiceCapabilities({ api, enabled }), { initialProps: { enabled: true } })
        await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
        act(() => result.current.retry())
        await waitFor(() => expect(result.current.capabilities).toBe(CAPABILITIES_EL_PLUS))
        expect(api.getVoiceCapabilities).toHaveBeenLastCalledWith({ fresh: true })

        // A reopened picker: the warm cache answers the first render, and the read is a cached one.
        rerender({ enabled: false })
        cold = false
        rerender({ enabled: true })
        expect(result.current).toMatchObject({ capabilities: CAPABILITIES_EL_FREE, loading: false, error: null })
        await waitFor(() => expect(api.getVoiceCapabilities).toHaveBeenCalledTimes(3))
        expect(api.getVoiceCapabilities).toHaveBeenLastCalledWith({})
        expect(result.current).toMatchObject({ capabilities: CAPABILITIES_EL_FREE, loading: false })
    })

    it('retries past the cache', async () => {
        const api = { getVoiceCapabilities: vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(CAPABILITIES_EL_PLUS) }
        const { result } = renderHook(() => useVoiceCapabilities({ api }))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.capabilities).toBeNull()
        act(() => result.current.retry())
        expect(result.current.loading).toBe(true)
        await waitFor(() => expect(result.current.capabilities).toBe(CAPABILITIES_EL_PLUS))
        expect(result.current.error).toBeNull()
        expect(api.getVoiceCapabilities).toHaveBeenLastCalledWith({ fresh: true })
    })
})
