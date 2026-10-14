import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    previewCreditConfirmed,
    previewCreditKey,
    resetPreviewCreditConfirmation,
    usePreviewCreditConfirm,
} from './usePreviewCreditConfirm'

describe('usePreviewCreditConfirm (AC-P5, 05 §6.3)', () => {
    beforeEach(() => {
        resetPreviewCreditConfirmation()
        vi.restoreAllMocks()
    })

    it('runs a free preview at once and asks before the first paid one', () => {
        const { result } = renderHook(() => usePreviewCreditConfirm('user-a'))
        const free = vi.fn()
        act(() => result.current.guard(false, free))
        expect(free).toHaveBeenCalledTimes(1)
        expect(result.current.open).toBe(false)

        const paid = vi.fn()
        act(() => result.current.guard(true, paid))
        expect(result.current.open).toBe(true)
        expect(paid).not.toHaveBeenCalled()
        act(() => result.current.confirm())
        expect(paid).toHaveBeenCalledTimes(1)
        expect(window.sessionStorage.getItem(previewCreditKey('user-a'))).toBe('1')
    })

    it('remembers the confirmation per account: user B is asked again after user A confirmed', () => {
        const { result, rerender } = renderHook(({ hash }) => usePreviewCreditConfirm(hash), { initialProps: { hash: 'user-a' } })
        act(() => result.current.guard(true, vi.fn()))
        act(() => result.current.confirm())
        const again = vi.fn()
        act(() => result.current.guard(true, again))
        expect(again).toHaveBeenCalledTimes(1)

        rerender({ hash: 'user-b' })
        const forB = vi.fn()
        act(() => result.current.guard(true, forB))
        expect(result.current.open).toBe(true)
        expect(forB).not.toHaveBeenCalled()
        expect(previewCreditConfirmed('user-a')).toBe(true)
        expect(previewCreditConfirmed('user-b')).toBe(false)
    })

    it('never runs a confirmation opened for another account', () => {
        const { result, rerender } = renderHook(({ hash }) => usePreviewCreditConfirm(hash), { initialProps: { hash: 'user-a' as string | null } })
        const forA = vi.fn()
        act(() => result.current.guard(true, forA))
        expect(result.current.open).toBe(true)

        rerender({ hash: 'user-b' })
        expect(result.current.open).toBe(false)
        act(() => result.current.confirm())
        expect(forA).not.toHaveBeenCalled()
        expect(previewCreditConfirmed('user-b')).toBe(false)
    })

    it('remembers nothing without a user, and keeps a per-account memory when storage is blocked', () => {
        const { result: anonymous } = renderHook(() => usePreviewCreditConfirm(null))
        act(() => anonymous.current.guard(true, vi.fn()))
        act(() => anonymous.current.confirm())
        const next = vi.fn()
        act(() => anonymous.current.guard(true, next))
        expect(next).not.toHaveBeenCalled()
        expect(anonymous.current.open).toBe(true)

        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
        const { result } = renderHook(() => usePreviewCreditConfirm('user-c'))
        act(() => result.current.guard(true, vi.fn()))
        act(() => result.current.confirm())
        expect(previewCreditConfirmed('user-c')).toBe(true)
        expect(previewCreditConfirmed('user-d')).toBe(false)
    })
})
