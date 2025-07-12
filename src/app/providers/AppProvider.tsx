/**
 * Main application provider that combines all context providers
 */

import type { ReactNode } from 'react'
import { AuthProvider } from './AuthProvider'
import { DataProvider } from './DataProvider'
import { NavigationProvider } from './NavigationProvider'
import { ThemeProvider } from './ThemeProvider'

interface AppProviderProps {
    children: ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
    return (
        <ThemeProvider>
            <AuthProvider>
                <NavigationProvider>
                    <DataProvider>
                        {children}
                    </DataProvider>
                </NavigationProvider>
            </AuthProvider>
        </ThemeProvider>
    )
}
