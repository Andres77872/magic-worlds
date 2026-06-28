import { createContext } from 'react'
import type { FloatingWindowDescriptor, FloatingWindowInput } from '@/features/floatingWindows/floatingWindow.types'

export interface FloatingWindowsContextValue {
    /** Open windows, ordered back-to-front (last element is topmost). */
    windows: FloatingWindowDescriptor[]
    /** Open a window, or focus the existing one with the same `dedupKey`. */
    openWindow: (input: FloatingWindowInput) => void
    closeWindow: (id: string) => void
    closeAll: () => void
    /** Bring a window to the front. */
    focusWindow: (id: string) => void
}

export const FloatingWindowsContext = createContext<FloatingWindowsContextValue | undefined>(undefined)
