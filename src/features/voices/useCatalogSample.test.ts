import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCatalogSample } from './useCatalogSample'

const fetchProtectedMediaBlob = vi.fn()

vi.mock('@/infrastructure/api', () => ({
    apiService: { fetchProtectedMediaBlob: (...a: unknown[]) => fetchProtectedMediaBlob(...a) },
}))

const SAMPLE_A = '/voices/catalog/vk_a/preview.mp3?lang=en&tier=standard&h=1'
const SAMPLE_B = '/voices/catalog/vk_b/preview.mp3?lang=en&tier=standard&h=2'

describe('useCatalogSample (dormant until R1)', () => {
    let urls = 0
    beforeEach(() => {
        vi.clearAllMocks()
        urls = 0
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => `blob:sample-${++urls}`), revokeObjectURL: vi.fn() })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('plays the latest sample only, with the voice gain applied', async () => {
        let releaseA!: (blob: Blob) => void
        fetchProtectedMediaBlob
            .mockImplementationOnce(() => new Promise<Blob>((resolve) => { releaseA = resolve }))
            .mockResolvedValueOnce(new Blob(['b']))
        const { result } = renderHook(() => useCatalogSample())

        let first!: Promise<void>
        act(() => {
            first = result.current.play(SAMPLE_A)
        })
        await act(() => result.current.play(SAMPLE_B, -6))
        await act(async () => {
            releaseA(new Blob(['a']))
            await first
        })

        expect(fetchProtectedMediaBlob).toHaveBeenCalledWith(SAMPLE_B, 'audio/mpeg')
        expect(result.current.clip).toMatchObject({ sampleUrl: SAMPLE_B, src: 'blob:sample-1' })
        expect(result.current.clip?.volume).toBeCloseTo(10 ** (-6 / 20), 3)
        expect(result.current.loading).toBe(false)
    })

    it('reports a rate limit without metering anything', async () => {
        fetchProtectedMediaBlob.mockRejectedValue(Object.assign(new Error('Too many'), { status: 429 }))
        const { result } = renderHook(() => useCatalogSample())

        await act(() => result.current.play(SAMPLE_A))

        expect(result.current.error).toBe('Too many previews at once. Try again in a moment.')
        expect(result.current.clip).toBeNull()
    })
})
