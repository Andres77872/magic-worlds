/**
 * Main application provider that combines all context providers
 */

import type { ReactNode } from 'react'
import { ThemeProvider } from './ThemeProvider'
import { DataProvider } from './DataProvider'
import { NavigationProvider } from './NavigationProvider'

interface AppProviderProps {
    children: ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
    return (
        <ThemeProvider>
            <NavigationProvider>
                <DataProvider>
                    {children}
                </DataProvider>
            </NavigationProvider>
        </ThemeProvider>
    )
}
