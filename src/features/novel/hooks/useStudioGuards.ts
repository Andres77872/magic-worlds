/**
 * useStudioGuards — the two things the studio has to check before it does
 * anything: is the writer signed in, and is there unsaved work in the way.
 *
 * Both lived inline in NovelStudio along with the confirm dialog's state,
 * which made a layout shell 280 lines long.
 *
 * While a story is open the leave guard also takes part in the app's
 * navigation guard pass (sidebar links, back affordances, the workspace switch
 * coordinator): the navigation waits for the draft flush and, when the save
 * fails, the writer stays in the studio with the discard dialog.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useAuth, useNavigation } from '@/app/hooks'
import type { NovelEditorHandle } from '../editor/types'

interface UseStudioGuardsOptions {
    editorHandleRef: RefObject<NovelEditorHandle | null>
    /** Persist the draft; resolves false when it could not be saved. */
    flush: () => Promise<boolean>
    /** Whether a story is open; nothing is guarded otherwise. */
    active: boolean
}

export interface StudioGuardsApi {
    /** True when signed in; otherwise opens the login modal and returns false. */
    requireAuth: () => boolean
    /**
     * Decline anything the AI has live, flush the draft, then run `action` —
     * or, if the draft could not be saved, hold and ask before discarding it.
     */
    guardedLeave: (action: () => void) => void
    discardPending: boolean
    confirmDiscard: () => void
    cancelDiscard: () => void
}

export function useStudioGuards({ editorHandleRef, flush, active }: UseStudioGuardsOptions): StudioGuardsApi {
    const { isAuthenticated, openLoginModal } = useAuth()
    const { registerNavigationInterceptor } = useNavigation()
    const [pendingDiscard, setPendingDiscard] = useState<(() => void) | null>(null)
    // True while a guarded action runs: the navigation it starts must pass the
    // studio's own interceptor instead of being guarded a second time.
    const bypassRef = useRef(false)
    // The intercepted navigation's cancel callback: declining the discard dialog
    // tells the provider, so a waiting workspace switch or history move settles.
    const pendingCancelRef = useRef<(() => void) | null>(null)

    const runBypassed = useCallback((action: () => void) => {
        bypassRef.current = true
        try {
            action()
        } finally {
            bypassRef.current = false
        }
    }, [])

    const requireAuth = useCallback(() => {
        if (isAuthenticated) return true
        openLoginModal()
        return false
    }, [isAuthenticated, openLoginModal])

    const guardedLeave = useCallback(
        (action: () => void) => {
            void (async () => {
                await editorHandleRef.current?.resolveSuggestion('reject')
                const clean = await flush()
                if (clean) runBypassed(action)
                // Leaving now would silently drop the unsaved draft — ask first.
                else setPendingDiscard(() => action)
            })()
        },
        [editorHandleRef, flush, runBypassed],
    )

    const guardedLeaveRef = useRef(guardedLeave)
    useEffect(() => {
        guardedLeaveRef.current = guardedLeave
    })

    useEffect(() => {
        if (!active) return
        return registerNavigationInterceptor((proceed, cancel) => {
            if (bypassRef.current) return false
            // A newer navigation supersedes one still waiting on the writer.
            pendingCancelRef.current?.()
            pendingCancelRef.current = cancel ?? null
            guardedLeaveRef.current(() => {
                pendingCancelRef.current = null
                proceed()
            })
            return true
        })
    }, [active, registerNavigationInterceptor])

    return {
        requireAuth,
        guardedLeave,
        discardPending: pendingDiscard !== null,
        confirmDiscard: () => {
            const action = pendingDiscard
            setPendingDiscard(null)
            if (action) runBypassed(action)
        },
        cancelDiscard: () => {
            const cancel = pendingCancelRef.current
            pendingCancelRef.current = null
            setPendingDiscard(null)
            cancel?.()
        },
    }
}
