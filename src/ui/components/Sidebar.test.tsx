import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/app/providers/AuthProvider'
import { ApiStatusContext, type ApiStatusContextValue } from '@/app/providers/apiStatusContext'
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

const dependencyStatus: ApiStatusContextValue = {
    status: 'online',
    checkedAt: '2026-06-11T20:11:09.721371Z',
    services: [
        {
            id: 'magic_worlds_api',
            label: 'Magic Worlds API',
            status: 'ok',
            components: [
                { id: 'mysql', label: 'MySQL', status: 'ok', latency_ms: 3, components: [] },
                { id: 'api_auth', label: 'API Auth', status: 'ok', latency_ms: 12, components: [] },
            ],
        },
        {
            id: 'llm_providers',
            label: 'LLM Providers / Agent AI',
            status: 'ok',
            latency_ms: 42,
            components: [],
        },
        {
            id: 'user_providers',
            label: 'User / Auth Providers',
            status: 'ok',
            components: [
                { id: 'database', label: 'Database', status: 'ok', message: 'Database accessible', components: [] },
                { id: 'redis', label: 'Redis', status: 'ok', message: 'Redis accessible', components: [] },
            ],
        },
    ],
}

function renderSidebar(auth: AuthValue, apiStatus: ApiStatusContextValue = dependencyStatus) {
    return render(
        <NavigationProvider>
            <AuthContext.Provider value={auth}>
                <ApiStatusContext.Provider value={apiStatus}>
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
        window.localStorage.removeItem('magic-worlds-sidebar-collapsed')
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('shows API status while signed out', async () => {
        renderSidebar(baseAuth)

        expect(await screen.findByRole('status', { name: 'API online' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Docs' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    })

    it('opens a floating dependency view from the API status control', async () => {
        renderSidebar(baseAuth)

        fireEvent.click(await screen.findByRole('button', { name: 'API online' }))

        const dialog = screen.getByRole('dialog', { name: 'Backend dependencies' })
        expect(within(dialog).getByText('Magic Worlds API')).toBeInTheDocument()
        expect(within(dialog).getByText('LLM Providers / Agent AI')).toBeInTheDocument()
        expect(within(dialog).getByText('User / Auth Providers')).toBeInTheDocument()
        expect(within(dialog).getByText('Database accessible')).toBeInTheDocument()
        expect(within(dialog).getByText('All dependencies online')).toBeInTheDocument()
    })

    it('shows API status while signed in next to account utilities', async () => {
        renderSidebar({ ...baseAuth, isAuthenticated: true, user: mockUser })

        expect(await screen.findByRole('status', { name: 'API online' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Chatroom' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Items' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Docs' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Tasks' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Your profile' })).toBeInTheDocument()
    })

    it('opens the item gallery from the library rail', async () => {
        renderSidebar({ ...baseAuth, isAuthenticated: true, user: mockUser })

        const items = screen.getByRole('button', { name: 'Items' })
        fireEvent.click(items)

        expect(items).toHaveAttribute('aria-current', 'page')
    })

    it('marks docs as the current utility view after clicking it', async () => {
        renderSidebar(baseAuth)

        const docs = screen.getByRole('button', { name: 'Docs' })
        fireEvent.click(docs)

        expect(docs).toHaveAttribute('aria-current', 'page')
    })

    it('collapses and expands the desktop sidebar', async () => {
        renderSidebar(baseAuth)
        const sidebar = document.querySelector('[data-sidebar-collapsed]')

        expect(sidebar).toHaveAttribute('data-sidebar-collapsed', 'false')

        fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

        expect(sidebar).toHaveAttribute('data-sidebar-collapsed', 'true')
        expect(window.localStorage.getItem('magic-worlds-sidebar-collapsed')).toBe('true')

        fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))

        expect(sidebar).toHaveAttribute('data-sidebar-collapsed', 'false')
        expect(window.localStorage.getItem('magic-worlds-sidebar-collapsed')).toBe('false')
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
