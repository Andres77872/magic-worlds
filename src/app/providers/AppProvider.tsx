/**
 * Main application provider that combines all context providers
 */

import type { ReactNode } from 'react'
import { ApiStatusProvider } from './ApiStatusProvider'
import { AudioPlaylistProvider } from './AudioPlaylistProvider'
import { FloatingWindowsProvider } from './FloatingWindowsProvider'
import { AuthProvider } from './AuthProvider'
import { FeatureFlagProvider } from './FeatureFlagProvider'
import { BackgroundTasksProvider } from './BackgroundTasksProvider'
import { CookieConsentProvider } from './CookieConsentProvider'
import { DataProvider } from './DataProvider'
import { LanguageProvider } from './LanguageProvider'
import { NavigationProvider } from './NavigationProvider'
import { WorkspaceProvider } from './WorkspaceProvider'
import { LlmSessionProvider } from '@/features/llmProfiles/LlmSessionProvider'
import { CreationOriginProvider } from '@/features/library/creationOrigin'
import { OriginNavigationProvider } from '@/features/workspaces/originNavigation'
import { AttestationProvider } from '@/features/legal/attestation/AttestationProvider'
import { PreviewAllowanceProvider } from '@/features/voices/PreviewAllowanceProvider'

interface AppProviderProps {
    children: ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
    return (
        <ApiStatusProvider>
            <AuthProvider>
                <FeatureFlagProvider>
                <LlmSessionProvider>
                <LanguageProvider>
                    {/* Workspace R1: handshake + committed workspace; private loaders wait for it. */}
                    <WorkspaceProvider>
                    <NavigationProvider>
                        <OriginNavigationProvider>
                        <CreationOriginProvider>
                        <CookieConsentProvider>
                            <DataProvider>
                                <BackgroundTasksProvider>
                                    <AudioPlaylistProvider>
                                        <FloatingWindowsProvider>
                                            {/* D26: 18+ / Terms attestation gate and prompt. */}
                                            <AttestationProvider>
                                                <PreviewAllowanceProvider>{children}</PreviewAllowanceProvider>
                                            </AttestationProvider>
                                        </FloatingWindowsProvider>
                                    </AudioPlaylistProvider>
                                </BackgroundTasksProvider>
                            </DataProvider>
                        </CookieConsentProvider>
                        </CreationOriginProvider>
                        </OriginNavigationProvider>
                    </NavigationProvider>
                    </WorkspaceProvider>
                </LanguageProvider>
                </LlmSessionProvider>
                </FeatureFlagProvider>
            </AuthProvider>
        </ApiStatusProvider>
    )
}
