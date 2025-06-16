/**
 * Theme management provider
 */

import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { ThemeOption } from '../../shared'

interface ThemeContextValue {
    theme: ThemeOption
    setTheme: (theme: ThemeOption) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

interface ThemeProviderProps {
    children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [theme, setTheme] = useState<ThemeOption>(() => {
        const stored = localStorage.getItem('theme')
        return stored === 'light' || stored === 'dark' ? stored : 'system'
    })

    useEffect(() => {
        localStorage.setItem('theme', theme)
    }, [theme])

    const value: ThemeContextValue = {
        theme,
        setTheme
    }

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    )
}

// Export the context for use in hooks
export { ThemeContext }
