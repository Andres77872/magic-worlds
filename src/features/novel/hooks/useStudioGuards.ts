/**
 * useStudioGuards — the two things the studio has to check before it does
 * anything: is the writer signed in, and is there unsaved work in the way.
 *
 * Both lived inline in NovelStudio along with the confirm dialog's state,
 * which made a layout shell 280 lines long.
 */

import { useCallback, useState, type RefObject } from 'react'
import { useAuth } from '@/app/hooks'
import type { NovelEditorHandle } from '../editor/types'

interface UseStudioGuardsOptions {
    editorHandleRef: RefObject<NovelEditorHandle | null>
    /** Persist the draft; resolves false when it could not be saved. */
    flush: () => Promise<boolean>
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

export function useStudioGuards({ editorHandleRef, flush }: UseStudioGuardsOptions): StudioGuardsApi {
    const { isAuthenticated, openLoginModal } = useAuth()
    const [pendingDiscard, setPendingDiscard] = useState<(() => void) | null>(null)

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
                if (clean) action()
                // Leaving now would silently drop the unsaved draft — ask first.
                else setPendingDiscard(() => action)
            })()
        },
        [editorHandleRef, flush],
    )

    return {
        requireAuth,
        guardedLeave,
        discardPending: pendingDiscard !== null,
        confirmDiscard: () => {
            pendingDiscard?.()
            setPendingDiscard(null)
        },
        cancelDiscard: () => setPendingDiscard(null),
    }
}
