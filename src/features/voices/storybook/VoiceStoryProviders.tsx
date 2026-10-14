/**
 * Story-only contexts for the R1 voice UI (never imported by the application):
 * a signed-in reader, the selected "Main library" workspace and a navigation
 * stub that reports where an action would go instead of navigating.
 */
import { useState, type ComponentProps, type ReactNode } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { NavigationContext } from '@/app/providers/NavigationProvider'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import { createWorkspaceTestState } from '@/shared/hooks/testing/workspaceTestUtils'

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
type NavValue = NonNullable<ComponentProps<typeof NavigationContext.Provider>['value']>

/** The user hash of the story reader (keys its first-exposure dismissal). */
export const STORY_USER_HASH = 'storybook-reader'

const workspace = createWorkspaceTestState().value()
const noop = () => {}
const asyncNoop = async () => {}

export function VoiceStoryProviders({ children }: { children: ReactNode }) {
    const [notice, setNotice] = useState('')
    const auth: AuthValue = {
        isAuthenticated: true,
        user: { user_hash: STORY_USER_HASH, username: 'Lyra', user_type: 'consumer', email: null, created_at: null, updated_at: null },
        token: null,
        projects: [],
        isLoading: false,
        error: null,
        sessionPhase: 'authenticated',
        authEpoch: 0,
        accountKey: STORY_USER_HASH,
        userHash: STORY_USER_HASH,
        isLoginModalOpen: false,
        login: async () => false,
        register: async () => false,
        loginWithGoogle: asyncNoop,
        completeGoogleLogin: async () => false,
        logout: asyncNoop,
        continueSignedOut: noop,
        updateUser: noop,
        clearError: noop,
        openLoginModal: () => setNotice('Sign-in requested.'),
        closeLoginModal: noop,
    }
    const navigation: NavValue = {
        currentPage: 'voice-studio',
        previousPage: undefined,
        currentHash: '',
        cardEdit: null,
        resourceEdit: null,
        setPage: (page) => setNotice(`Would open: ${page}`),
        goBack: () => setNotice('Would go back'),
        replaceHash: noop,
        registerNavigationInterceptor: () => noop,
    }
    return (
        <AuthContext.Provider value={auth}>
            <NavigationContext.Provider value={navigation}>
                <WorkspaceContext.Provider value={workspace}>
                    {notice && <p role="status" className="mb-3 font-ui text-caption text-fg-subtle">{notice}</p>}
                    {children}
                </WorkspaceContext.Provider>
            </NavigationContext.Provider>
        </AuthContext.Provider>
    )
}
