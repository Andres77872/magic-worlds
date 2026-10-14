import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { firstExposureKey, useFirstExposure } from './useFirstExposure'

describe('useFirstExposure (R1-FE-03)', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        localStorage.clear()
    })

    it('shows once per user and remembers the dismissal under the user key', () => {
        const { result, rerender } = renderHook(({ hash }) => useFirstExposure(hash), { initialProps: { hash: 'user-a' as string | null } })
        expect(result.current.visible).toBe(true)
        act(() => result.current.dismiss())
        expect(result.current.visible).toBe(false)
        expect(localStorage.getItem('magic_worlds:voice_first_exposure:v1:user-a')).toBe('1')
        expect(firstExposureKey('user-a')).toBe('magic_worlds:voice_first_exposure:v1:user-a')

        // Another account starts from its own answer.
        rerender({ hash: 'user-b' })
        expect(result.current.visible).toBe(true)
        // A fresh mount reads the stored dismissal.
        expect(renderHook(() => useFirstExposure('user-a')).result.current.visible).toBe(false)
    })

    it('never shows without a signed-in user', () => {
        expect(renderHook(() => useFirstExposure(null)).result.current.visible).toBe(false)
        expect(renderHook(() => useFirstExposure('  ')).result.current.visible).toBe(false)
    })

    it('falls back to memory when storage throws', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        const { result } = renderHook(() => useFirstExposure('user-c'))
        expect(result.current.visible).toBe(true)
        act(() => result.current.dismiss())
        expect(result.current.visible).toBe(false)
    })
})
