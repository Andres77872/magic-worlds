import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NavigationInterceptor } from '@/app/providers/NavigationProvider'

const registered: NavigationInterceptor[] = []
const registerNavigationInterceptor = vi.fn((interceptor: NavigationInterceptor) => {
    registered.push(interceptor)
    return () => {
        const index = registered.indexOf(interceptor)
        if (index >= 0) registered.splice(index, 1)
    }
})

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ registerNavigationInterceptor }),
}))

import { useUnsavedChangesGuard } from './useUnsavedChangesGuard'

describe('useUnsavedChangesGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registered.length = 0
    })

    it('runs the action immediately while clean', () => {
        const { result } = renderHook(() => useUnsavedChangesGuard({ when: false }))
        const action = vi.fn()

        act(() => result.current.confirm(action))

        expect(action).toHaveBeenCalledTimes(1)
        expect(result.current.dialogProps.visible).toBe(false)
        expect(registerNavigationInterceptor).not.toHaveBeenCalled()
    })

    it('asks first while dirty; confirm runs the action, cancel drops it', () => {
        const { result } = renderHook(() => useUnsavedChangesGuard({ when: true }))
        const action = vi.fn()

        act(() => result.current.confirm(action))
        expect(action).not.toHaveBeenCalled()
        expect(result.current.dialogProps.visible).toBe(true)

        act(() => result.current.dialogProps.onCancel())
        expect(action).not.toHaveBeenCalled()
        expect(result.current.dialogProps.visible).toBe(false)

        act(() => result.current.confirm(action))
        act(() => result.current.dialogProps.onConfirm())
        expect(action).toHaveBeenCalledTimes(1)
        expect(result.current.dialogProps.visible).toBe(false)
    })

    it('intercepts navigation while dirty and completes it on confirm', () => {
        const { result } = renderHook(() => useUnsavedChangesGuard({ when: true }))
        expect(registered).toHaveLength(1)

        const proceed = vi.fn()
        let intercepted = false
        act(() => {
            intercepted = registered[0](proceed)
        })
        expect(intercepted).toBe(true)
        expect(proceed).not.toHaveBeenCalled()
        expect(result.current.dialogProps.visible).toBe(true)

        act(() => result.current.dialogProps.onConfirm())
        expect(proceed).toHaveBeenCalledTimes(1)
    })

    it('a confirmed action that itself navigates passes the interceptor through', () => {
        const { result } = renderHook(() => useUnsavedChangesGuard({ when: true }))

        // Simulate handleBack: confirm an action whose body triggers navigation
        // (which consults the same interceptor again).
        let reintercepted: boolean | null = null
        act(() =>
            result.current.confirm(() => {
                reintercepted = registered[0](vi.fn())
            }),
        )
        act(() => result.current.dialogProps.onConfirm())

        // The nested navigation must NOT reopen the dialog.
        expect(reintercepted).toBe(false)
        expect(result.current.dialogProps.visible).toBe(false)
    })

    it('unregisters the interceptor when the form becomes clean', () => {
        const { rerender } = renderHook(({ when }) => useUnsavedChangesGuard({ when }), {
            initialProps: { when: true },
        })
        expect(registered).toHaveLength(1)

        rerender({ when: false })
        expect(registered).toHaveLength(0)
    })

    it('blocks tab unload only while dirty', () => {
        const { rerender } = renderHook(({ when }) => useUnsavedChangesGuard({ when }), {
            initialProps: { when: false },
        })

        const cleanEvent = new Event('beforeunload', { cancelable: true })
        window.dispatchEvent(cleanEvent)
        expect(cleanEvent.defaultPrevented).toBe(false)

        rerender({ when: true })
        const dirtyEvent = new Event('beforeunload', { cancelable: true })
        window.dispatchEvent(dirtyEvent)
        expect(dirtyEvent.defaultPrevented).toBe(true)
    })

    it('skip() bypasses the interceptor for post-save navigation', () => {
        const { result } = renderHook(() => useUnsavedChangesGuard({ when: true }))

        let intercepted: boolean | null = null
        act(() =>
            result.current.skip(() => {
                intercepted = registered[0](vi.fn())
            }),
        )

        expect(intercepted).toBe(false)
        expect(result.current.dialogProps.visible).toBe(false)
    })
})
