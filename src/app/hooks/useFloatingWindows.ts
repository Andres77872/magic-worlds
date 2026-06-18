import { useContext } from 'react'
import { FloatingWindowsContext } from '../providers/floatingWindowsContext'

export function useFloatingWindows() {
    const context = useContext(FloatingWindowsContext)
    if (context === undefined) {
        throw new Error('useFloatingWindows must be used within a FloatingWindowsProvider')
    }
    return context
}
