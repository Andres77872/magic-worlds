/**
 * Main application provider that combines all context providers
 */

import type { ReactNode } from 'react'
import { ApiStatusProvider } from './ApiStatusProvider'
import { AudioPlaylistProvider } from './AudioPlaylistProvider'
import { FloatingWindowsProvider } from './FloatingWindowsProvider'
import { AuthProvider } from './AuthProvider'
import { BackgroundTasksProvider } from './BackgroundTasksProvider'
import { CookieConsentProvider } from './CookieConsentProvider'
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
                        <CookieConsentProvider>
                            <DataProvider>
                                <BackgroundTasksProvider>
                                    <AudioPlaylistProvider>
                                        <FloatingWindowsProvider>
                                            {children}
                                        </FloatingWindowsProvider>
                                    </AudioPlaylistProvider>
                                </BackgroundTasksProvider>
                            </DataProvider>
                        </CookieConsentProvider>
                    </NavigationProvider>
                </LanguageProvider>
            </AuthProvider>
        </ApiStatusProvider>
    )
}
