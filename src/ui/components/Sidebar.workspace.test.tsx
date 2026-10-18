import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/app/providers/AuthProvider'
import { ApiStatusContext, type ApiStatusContextValue } from '@/app/providers/apiStatusContext'
import { BackgroundTasksContext } from '@/app/providers/backgroundTasksContext'
import { NavigationProvider } from '@/app/providers/NavigationProvider'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { Sidebar } from './Sidebar'

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
type BackgroundTasksValue = NonNullable<ComponentProps<typeof BackgroundTasksContext.Provider>['value']>

const auth = {
    isAuthenticated: true,
    user: null,
    token: 'token',
    projects: [],
    isLoading: false,
    error: null,
    sessionPhase: 'authenticated',
    authEpoch: 1,
    accountKey: 'test',
    userHash: 'u_test',
    isLoginModalOpen: false,
    login: async () => false,
    register: async () => false,
    loginWithGoogle: async () => undefined,
    completeGoogleLogin: async () => false,
    logout: async () => undefined,
    continueSignedOut: () => undefined,
    updateUser: () => undefined,
    clearError: () => undefined,
    openLoginModal: () => undefined,
    closeLoginModal: () => undefined,
} as AuthValue

const backgroundTasks = {
    tasks: [],
    taskBuckets: { active: [], completed: [], failed: [] },
    activeTasks: [],
    activeCount: 0,
    drawerOpen: false,
    openDrawer: () => undefined,
    closeDrawer: () => undefined,
    refreshTasks: async () => undefined,
    registerTask: () => undefined,
    registerThemeSongJob: () => undefined,
    cancelTask: async () => {
        throw new Error('not implemented in test')
    },
    clearTerminalTasks: async () => undefined,
    terminalHasMore: { completed: false, failed: false },
    loadMoreTerminalTasks: async () => undefined,
} as unknown as BackgroundTasksValue

const apiStatus: ApiStatusContextValue = { status: 'online', checkedAt: null, services: [] } as unknown as ApiStatusContextValue

function Providers({ children }: { children: ReactNode }) {
    const workspace = createWorkspaceTestState({
        workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library'), testWorkspace(OTHER_WORKSPACE_ID, 'Novel A')],
    })
    return (
        <WorkspaceTestProvider state={workspace}>
            <NavigationProvider>
                <AuthContext.Provider value={auth}>
                    <ApiStatusContext.Provider value={apiStatus}>
                        <BackgroundTasksContext.Provider value={backgroundTasks}>{children}</BackgroundTasksContext.Provider>
                    </ApiStatusContext.Provider>
                </AuthContext.Provider>
            </NavigationProvider>
        </WorkspaceTestProvider>
    )
}

function renderSidebar() {
    return render(
        <Providers>
            <Sidebar />
        </Providers>,
    )
}

const TYPE_GALLERIES = ['Characters', 'Worlds', 'Items', 'Adventures']

describe('Sidebar with Workspace R1', () => {
    beforeEach(() => {
        setTestFeatureFlags({ adventures: true })
        window.history.replaceState(null, '', '#/')
        window.localStorage.removeItem('magic-worlds-sidebar-groups')
    })

    afterEach(() => vi.unstubAllEnvs())

    it('keeps Library and workspace switching available without a workspace permission', () => {

        renderSidebar()
        for (const label of TYPE_GALLERIES) expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Library' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Switch workspace/ })).toBeInTheDocument()
    })

    it('replaces the type galleries with one Library entry and shows the workspace switcher', () => {

        renderSidebar()
        for (const label of TYPE_GALLERIES) expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Switch workspace, current: Main library' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Library' }))
        expect(window.location.hash).toBe(`#/library?workspace=${TEST_WORKSPACE_ID}`)
        expect(screen.getByRole('button', { name: 'Library' })).toHaveAttribute('aria-current', 'page')
    })
})
