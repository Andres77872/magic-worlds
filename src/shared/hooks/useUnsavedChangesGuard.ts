/**
 * useUnsavedChangesGuard — blocks accidental loss of in-progress edits.
 *
 * While `when` is true it (a) intercepts navigation through NavigationProvider
 * (sidebar links, back affordances, browser back/forward and workspace
 * switches — the provider restores the URL while the dialog is open) and
 * (b) arms a `beforeunload` warning for tab close/reload. Cancelling the
 * dialog tells the provider, so a waiting workspace switch settles.
 *
 * The caller renders one ConfirmDialog from `dialogProps` and routes its own
 * leave-affordances (back button, Escape) through `confirm(action)` so every
 * exit path shares the same dialog.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation } from '@/app/hooks'

export interface UnsavedChangesGuardApi {
    /** Run `action` now when clean; otherwise ask first and run it on confirm. */
    confirm: (action: () => void) => void
    /**
     * Run a navigation without consulting the guard. For handlers that just
     * persisted the form and leave in the same tick — `when` is computed from
     * render state, so it is still stale-true at that point.
     */
    skip: (action: () => void) => void
    /** Spread onto a ConfirmDialog (visible/onConfirm/onCancel). */
    dialogProps: {
        visible: boolean
        onConfirm: () => void
        onCancel: () => void
    }
}

export function useUnsavedChangesGuard({ when }: { when: boolean }): UnsavedChangesGuardApi {
    const { registerNavigationInterceptor } = useNavigation()
    // The navigation (or caller action) waiting on the user's decision.
    const pendingActionRef = useRef<(() => void) | null>(null)
    // The intercepted navigation's cancel callback (null for a caller action).
    const pendingCancelRef = useRef<(() => void) | null>(null)
    const [dialogVisible, setDialogVisible] = useState(false)
    // True while a confirmed action runs: its own navigation must pass through
    // the interceptor untouched instead of reopening the dialog.
    const bypassRef = useRef(false)
    const whenRef = useRef(when)
    useEffect(() => {
        whenRef.current = when
    }, [when])

    useEffect(() => {
        if (!when) return
        return registerNavigationInterceptor((proceed, cancel) => {
            if (bypassRef.current) return false
            pendingCancelRef.current?.()
            pendingActionRef.current = proceed
            pendingCancelRef.current = cancel ?? null
            setDialogVisible(true)
            return true
        })
    }, [registerNavigationInterceptor, when])

    useEffect(() => {
        if (!when) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [when])

    const confirm = useCallback((action: () => void) => {
        if (!whenRef.current) {
            action()
            return
        }
        pendingCancelRef.current?.()
        pendingCancelRef.current = null
        pendingActionRef.current = action
        setDialogVisible(true)
    }, [])

    const onConfirm = useCallback(() => {
        const action = pendingActionRef.current
        pendingActionRef.current = null
        pendingCancelRef.current = null
        // Hide the dialog before running: the action usually navigates and
        // unmounts the caller.
        setDialogVisible(false)
        bypassRef.current = true
        try {
            action?.()
        } finally {
            bypassRef.current = false
        }
    }, [])

    const onCancel = useCallback(() => {
        const cancel = pendingCancelRef.current
        pendingActionRef.current = null
        pendingCancelRef.current = null
        setDialogVisible(false)
        cancel?.()
    }, [])

    const skip = useCallback((action: () => void) => {
        bypassRef.current = true
        try {
            action()
        } finally {
            bypassRef.current = false
        }
    }, [])

    return {
        confirm,
        skip,
        dialogProps: { visible: dialogVisible, onConfirm, onCancel },
    }
}
