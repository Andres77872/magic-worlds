/**
 * FloatingWindowsProvider — global, page-surviving state for the floating
 * preview windows. Mirrors the AudioPlaylist provider shape (reducer + memoized
 * actions + context value). Holds an ordered list of open windows; the last
 * element is topmost. Opening an item that's already open focuses (and refreshes)
 * it instead of stacking a duplicate, and the list is capped (see the reducer).
 */
import { useCallback, useMemo, useReducer, type ReactNode } from 'react'
import { generateUUID } from '@/utils/uuid'
import type { FloatingWindowInput } from '@/features/floatingWindows/floatingWindow.types'
import { FloatingWindowsContext, type FloatingWindowsContextValue } from './floatingWindowsContext'
import { floatingWindowsReducer } from './floatingWindowsReducer'

export function FloatingWindowsProvider({ children }: { children: ReactNode }) {
    const [windows, dispatch] = useReducer(floatingWindowsReducer, [])

    const openWindow = useCallback((input: FloatingWindowInput) => {
        dispatch({ type: 'OPEN', descriptor: { ...input, id: generateUUID() } })
    }, [])
    const closeWindow = useCallback((id: string) => dispatch({ type: 'CLOSE', id }), [])
    const focusWindow = useCallback((id: string) => dispatch({ type: 'FOCUS', id }), [])
    const closeAll = useCallback(() => dispatch({ type: 'CLOSE_ALL' }), [])

    const value = useMemo<FloatingWindowsContextValue>(
        () => ({ windows, openWindow, closeWindow, closeAll, focusWindow }),
        [windows, openWindow, closeWindow, closeAll, focusWindow],
    )

    return <FloatingWindowsContext.Provider value={value}>{children}</FloatingWindowsContext.Provider>
}
