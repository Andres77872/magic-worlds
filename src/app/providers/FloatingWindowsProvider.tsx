/**
 * FloatingWindowsProvider — global, page-surviving state for the floating
 * preview windows. Mirrors the AudioPlaylist provider shape (reducer + memoized
 * actions + context value). Holds an ordered list of open windows; the last
 * element is topmost. Opening an item that's already open focuses (and refreshes)
 * it instead of stacking a duplicate, and the list is capped (see the reducer).
 *
 * Workspace R1: the windows preview workspace content, so a committed workspace
 * switch closes them all (as a sign-in/out does).
 */
import { useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { generateUUID } from '@/utils/uuid'
import type { FloatingWindowInput } from '@/features/floatingWindows/floatingWindow.types'
import { FloatingWindowsContext, type FloatingWindowsContextValue } from './floatingWindowsContext'
import { floatingWindowsReducer } from './floatingWindowsReducer'
import { AuthContext } from './AuthProvider'
import { WorkspaceContext } from './workspaceContext'

export function FloatingWindowsProvider({ children }: { children: ReactNode }) {
    const auth = useContext(AuthContext)
    // Optional so stories and isolated tests can mount without a workspace.
    const workspaceEpoch = useContext(WorkspaceContext)?.workspaceEpoch ?? 0
    const [windows, dispatch] = useReducer(floatingWindowsReducer, [])

    const openWindow = useCallback((input: FloatingWindowInput) => {
        dispatch({ type: 'OPEN', descriptor: { ...input, id: generateUUID() } })
    }, [])
    const closeWindow = useCallback((id: string) => dispatch({ type: 'CLOSE', id }), [])
    const focusWindow = useCallback((id: string) => dispatch({ type: 'FOCUS', id }), [])
    const closeAll = useCallback(() => dispatch({ type: 'CLOSE_ALL' }), [])

    useEffect(() => {
        if (auth) dispatch({ type: 'CLOSE_ALL' })
    }, [auth?.authEpoch])

    // Close during render on a switch so no window paints the previous workspace's content.
    const [windowsEpoch, setWindowsEpoch] = useState(workspaceEpoch)
    if (windowsEpoch !== workspaceEpoch) {
        setWindowsEpoch(workspaceEpoch)
        dispatch({ type: 'CLOSE_ALL' })
    }

    const value = useMemo<FloatingWindowsContextValue>(
        () => ({ windows, openWindow, closeWindow, closeAll, focusWindow }),
        [windows, openWindow, closeWindow, closeAll, focusWindow],
    )

    return <FloatingWindowsContext.Provider value={value}>{children}</FloatingWindowsContext.Provider>
}
