import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/app/providers/AuthProvider'
import { ApiStatusContext } from '@/app/providers/apiStatusContext'
import { BackgroundTasksContext } from '@/app/providers/backgroundTasksContext'
import { NavigationProvider } from '@/app/providers/NavigationProvider'
import type { User } from '@/shared'
import { Sidebar } from './Sidebar'

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
type BackgroundTasksValue = NonNullable<ComponentProps<typeof BackgroundTasksContext.Provider>['value']>

const baseAuth: AuthValue = {
    isAuthenticated: false,
    user: null,
    token: null,
    projects: [],
    isLoading: false,
    error: null,
    isLoginModalOpen: false,
    login: async () => false,
    register: async () => false,
    logout: () => undefined,
    clearError: () => undefined,
    openLoginModal: () => undefined,
    closeLoginModal: () => undefined,
}

const mockUser: User = {
    user_hash: 'u_lyra',
    username: 'Lyra the Bard',
    email: null,
    user_type: 'player',
    created_at: null,
    updated_at: null,
}

const backgroundTasks: BackgroundTasksValue = {
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
}

function renderSidebar(auth: AuthValue) {
    return render(
        <NavigationProvider>
            <AuthContext.Provider value={auth}>
                <ApiStatusContext.Provider value={{ status: 'online' }}>
                    <BackgroundTasksContext.Provider value={backgroundTasks}>
                        <Sidebar />
                    </BackgroundTasksContext.Provider>
                </ApiStatusContext.Provider>
            </AuthContext.Provider>
        </NavigationProvider>,
    )
}

describe('Sidebar API status', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('shows API status while signed out', async () => {
        renderSidebar(baseAuth)

        expect(await screen.findByRole('status', { name: 'API online' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    })

    it('shows API status while signed in next to account utilities', async () => {
        renderSidebar({ ...baseAuth, isAuthenticated: true, user: mockUser })

        expect(await screen.findByRole('status', { name: 'API online' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Tasks' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Your profile' })).toBeInTheDocument()
    })

    it('confirms before logging out from the sidebar', async () => {
        const logout = vi.fn()
        renderSidebar({ ...baseAuth, isAuthenticated: true, user: mockUser, logout })

        fireEvent.click(screen.getByRole('button', { name: 'Log out Lyra the Bard' }))

        const dialog = screen.getByRole('dialog', { name: 'Log out?' })
        expect(within(dialog).getByText(/signed in as/i)).toBeInTheDocument()
        expect(logout).not.toHaveBeenCalled()

        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

        expect(screen.queryByRole('dialog', { name: 'Log out?' })).not.toBeInTheDocument()
        expect(logout).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Log out Lyra the Bard' }))
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Log out?' })).getByRole('button', { name: 'Log out' }))

        expect(logout).toHaveBeenCalledTimes(1)
    })
})
