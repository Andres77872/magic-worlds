import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeCapacityUsage, emptyCapacityUsage } from '../llmCapacityUsage.fixtures'
import { useLlmCapacityUsage } from './useLlmCapacityUsage'

const getLlmCapacityUsage = vi.hoisted(() => vi.fn())
vi.mock('@/infrastructure', () => ({ apiService: { getLlmCapacityUsage } }))

describe('useLlmCapacityUsage', () => {
    beforeEach(() => getLlmCapacityUsage.mockReset())

    it('does not fetch until enabled and then resolves the account usage', async () => {
        getLlmCapacityUsage.mockResolvedValue(activeCapacityUsage)
        const { result, rerender } = renderHook(({ enabled }) => useLlmCapacityUsage('alice', enabled), { initialProps: { enabled: false } })
        expect(result.current).toEqual({ status: 'loading', usage: null })
        expect(getLlmCapacityUsage).not.toHaveBeenCalled()
        rerender({ enabled: true })
        await waitFor(() => expect(result.current).toEqual({ status: 'ready', usage: activeCapacityUsage }))
    })

    it('never shows the previous account counts while the next account loads', async () => {
        getLlmCapacityUsage.mockResolvedValueOnce(activeCapacityUsage)
        let resolveNext: (value: unknown) => void = () => {}
        getLlmCapacityUsage.mockReturnValueOnce(new Promise((resolve) => { resolveNext = resolve }))
        const { result, rerender } = renderHook(({ account }) => useLlmCapacityUsage(account, true), { initialProps: { account: 'alice' } })
        await waitFor(() => expect(result.current.status).toBe('ready'))
        rerender({ account: 'bob' })
        expect(result.current).toEqual({ status: 'loading', usage: null })
        await act(async () => resolveNext(emptyCapacityUsage))
        expect(result.current).toEqual({ status: 'ready', usage: emptyCapacityUsage })
    })

    it('reads a rejected or disabled request as unavailable and reloads on a new token', async () => {
        getLlmCapacityUsage.mockRejectedValueOnce(new Error('LLM_PROFILES_DISABLED')).mockResolvedValueOnce(emptyCapacityUsage)
        const { result, rerender } = renderHook(({ token }) => useLlmCapacityUsage('alice', true, token), { initialProps: { token: 1 } })
        await waitFor(() => expect(result.current).toEqual({ status: 'unavailable', usage: null }))
        rerender({ token: 2 })
        await waitFor(() => expect(result.current).toEqual({ status: 'ready', usage: emptyCapacityUsage }))
        expect(getLlmCapacityUsage).toHaveBeenCalledTimes(2)
    })
})
