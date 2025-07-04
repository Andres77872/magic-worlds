/**
 * Custom hook for accessing the Theme Context
 */

import { useContext } from 'react'
import { ThemeContext } from '../providers/ThemeProvider'

export function useTheme() {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
