import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG_ELDRIN, CATALOG_MAREN_HOUSE, VOICE_KEY_ELDRIN, VOICE_KEY_MAREN } from '../fixtures'
import { useCatalogLookup } from './useCatalogLookup'

const getVoiceCatalogByKeys = vi.fn()

vi.mock('@/infrastructure/api', () => ({
    apiService: { getVoiceCatalogByKeys: (...args: unknown[]) => getVoiceCatalogByKeys(...args) },
}))

describe('useCatalogLookup (R1-FE-03)', () => {
    beforeEach(() => {
        getVoiceCatalogByKeys.mockReset()
    })

    it('looks up the distinct keys once, in a stable order', async () => {
        getVoiceCatalogByKeys.mockResolvedValue([CATALOG_ELDRIN, CATALOG_MAREN_HOUSE])
        const { result, rerender } = renderHook(({ keys }) => useCatalogLookup(keys), {
            initialProps: { keys: [VOICE_KEY_MAREN, VOICE_KEY_ELDRIN, ` ${VOICE_KEY_MAREN} `, null, ''] as (string | null)[] },
        })
        await waitFor(() => expect(result.current.size).toBe(2))
        expect(getVoiceCatalogByKeys).toHaveBeenCalledTimes(1)
        expect(getVoiceCatalogByKeys).toHaveBeenCalledWith([VOICE_KEY_ELDRIN, VOICE_KEY_MAREN].sort())
        expect(result.current.get(VOICE_KEY_MAREN)?.house_voice).toBe(true)

        // Same keys in another order: no new request.
        rerender({ keys: [VOICE_KEY_ELDRIN, VOICE_KEY_MAREN] })
        expect(getVoiceCatalogByKeys).toHaveBeenCalledTimes(1)
    })

    it('answers an empty map on a failure, without keys, or while disabled', async () => {
        getVoiceCatalogByKeys.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }))
        const failed = renderHook(() => useCatalogLookup([VOICE_KEY_ELDRIN]))
        await waitFor(() => expect(getVoiceCatalogByKeys).toHaveBeenCalled())
        expect(failed.result.current.size).toBe(0)

        getVoiceCatalogByKeys.mockClear()
        renderHook(() => useCatalogLookup([]))
        renderHook(() => useCatalogLookup([VOICE_KEY_ELDRIN], false))
        expect(getVoiceCatalogByKeys).not.toHaveBeenCalled()
    })

    it('drops a late answer for keys no longer wanted', async () => {
        let resolveFirst: (items: unknown[]) => void = () => undefined
        getVoiceCatalogByKeys
            .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
            .mockResolvedValueOnce([CATALOG_MAREN_HOUSE])
        const { result, rerender } = renderHook(({ keys }) => useCatalogLookup(keys), { initialProps: { keys: [VOICE_KEY_ELDRIN] } })
        await waitFor(() => expect(getVoiceCatalogByKeys).toHaveBeenCalledTimes(1))
        rerender({ keys: [VOICE_KEY_MAREN] })
        await waitFor(() => expect(result.current.get(VOICE_KEY_MAREN)).toBeDefined())
        resolveFirst([CATALOG_ELDRIN])
        await Promise.resolve()
        expect(result.current.has(VOICE_KEY_ELDRIN)).toBe(false)
    })
})
