/**
 * Main application provider that combines all context providers
 */

import type { ReactNode } from 'react'
import { ApiStatusProvider } from './ApiStatusProvider'
import { AudioPlaylistProvider } from './AudioPlaylistProvider'
import { AuthProvider } from './AuthProvider'
import { BackgroundTasksProvider } from './BackgroundTasksProvider'
import { DataProvider } from './DataProvider'
import { LanguageProvider } from './LanguageProvider'
import { NavigationProvider } from './NavigationProvider'

interface AppProviderProps {
    children: ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
    return (
        <ApiStatusProvider>
            <AuthProvider>
                <LanguageProvider>
                    <NavigationProvider>
                        <DataProvider>
                            <BackgroundTasksProvider>
                                <AudioPlaylistProvider>
                                    {children}
                                </AudioPlaylistProvider>
                            </BackgroundTasksProvider>
                        </DataProvider>
                    </NavigationProvider>
                </LanguageProvider>
            </AuthProvider>
        </ApiStatusProvider>
    )
}
