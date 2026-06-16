import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/app/providers/AuthProvider'
import { ApiStatusContext, type ApiStatusContextValue } from '@/app/providers/apiStatusContext'
import { BackgroundTasksContext } from '@/app/providers/backgroundTasksContext'
import { NavigationProvider } from '@/app/providers/NavigationProvider'
import { MobileTopBar } from './MobileTopBar'
import { SidebarNavDrawer } from './SidebarNavDrawer'

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
    loginWithGoogle: async () => undefined,
    completeGoogleLogin: async () => false,
    logout: () => undefined,
    updateUser: () => undefined,
    clearError: () => undefined,
    openLoginModal: () => undefined,
    closeLoginModal: () => undefined,
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

const apiStatus: ApiStatusContextValue = { status: 'online', services: [] }

function withProviders(ui: React.ReactNode, auth: AuthValue = { ...baseAuth, isAuthenticated: true }) {
    return render(
        <NavigationProvider>
            <AuthContext.Provider value={auth}>
                <ApiStatusContext.Provider value={apiStatus}>
                    <BackgroundTasksContext.Provider value={backgroundTasks}>{ui}</BackgroundTasksContext.Provider>
                </ApiStatusContext.Provider>
            </AuthContext.Provider>
        </NavigationProvider>,
    )
}

describe('Mobile sidebar chrome', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        window.localStorage.clear()
    })

    afterEach(() => {
        document.body.style.overflow = ''
    })

    it('opens the nav from the top bar hamburger', () => {
        const onOpenNav = vi.fn()
        withProviders(<MobileTopBar onOpenNav={onOpenNav} />)

        fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
        expect(onOpenNav).toHaveBeenCalledTimes(1)
    })

    it('renders the labelled nav and closes on navigate when open', () => {
        const onClose = vi.fn()
        withProviders(<SidebarNavDrawer open onClose={onClose} />)

        // The drawer renders the always-expanded shell — labels are present.
        const drawer = screen.getByRole('dialog')
        const explore = within(drawer).getByRole('button', { name: 'Explore' })
        expect(explore).toBeInTheDocument()

        fireEvent.click(explore)
        expect(onClose).toHaveBeenCalled()
    })

    it('renders nothing while closed', () => {
        const onClose = vi.fn()
        withProviders(<SidebarNavDrawer open={false} onClose={onClose} />)

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
