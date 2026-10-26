import { setAllTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    page: 'library' as string,
    isAuthenticated: false,
    setPage: vi.fn(),
    openLoginModal: vi.fn(),
}))

vi.mock('../hooks', () => ({
    useNavigation: () => ({ currentPage: mocks.page, setPage: mocks.setPage }),
    useData: () => ({ loadingState: { isLoading: false } }),
    useWorkspace: () => ({
        status: mocks.isAuthenticated ? 'ready' : 'idle',
        selectedWorkspaceId: mocks.isAuthenticated ? '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b' : null,
        selectedWorkspace: null,
        workspaceEpoch: 1,
        hasHiddenWorkspaces: false,
        refreshWorkspaces: vi.fn(async () => undefined),
    }),
    useAuth: () => ({
        isAuthenticated: mocks.isAuthenticated,
        authEpoch: 1,
        accountKey: 'account-1',
        sessionPhase: mocks.isAuthenticated ? 'authenticated' : 'signed_out',
        isLoginModalOpen: false,
        loginModalMode: 'login',
        closeLoginModal: vi.fn(),
        openLoginModal: mocks.openLoginModal,
        continueSignedOut: vi.fn(),
    }),
}))
vi.mock('../../features/library/components/LibraryPage', () => ({ LibraryPage: () => <h1>Library page</h1> }))
vi.mock('../../features/notifications/components/NotificationsPage', () => ({ NotificationsPage: () => <h1>Notifications page</h1> }))
vi.mock('../../features/characterChat/components/ChatroomPage', () => ({ ChatroomPage: () => <h1>Chatroom page</h1> }))
vi.mock('../../features/gallery/media/components/MediaGalleryPage', () => ({ MediaGalleryPage: () => <h1>Media page</h1> }))
vi.mock('../../features/landing/components/LandingPage', () => ({ LandingPage: () => <h1>Landing page</h1> }))
vi.mock('../../features/novel/components/NovelDeviceLibrary', () => ({ NovelDeviceLibrary: () => null }))
vi.mock('../../ui/components/Sidebar', () => ({ Sidebar: () => null }))
vi.mock('../../ui/components/MobileTopBar', () => ({ MobileTopBar: () => null }))
vi.mock('../../ui/components/SidebarNavDrawer', () => ({ SidebarNavDrawer: () => null }))
vi.mock('../../ui/components/LoginModal', () => ({ LoginModal: () => null }))
vi.mock('../../ui/components/AppWarningModal', () => ({ AppWarningModal: () => null }))
vi.mock('../../ui/components/CookieConsentBanner', () => ({ CookieConsentBanner: () => null }))
vi.mock('../../ui/components/ServicesDownBanner', () => ({ ServicesDownBanner: () => null }))
vi.mock('../../ui/components/AppUpdateBanner', () => ({ AppUpdateBanner: () => null }))
vi.mock('../../ui/components/DataLoadErrorBanner', () => ({ DataLoadErrorBanner: () => null }))
vi.mock('../../ui/components/audio/PlaylistDock', () => ({ PlaylistDock: () => null }))
vi.mock('../../features/tasks', () => ({ SidebarTasksMenu: () => null, TasksDrawer: () => null }))
vi.mock('../../features/cards', () => ({ CardPreviewModal: () => null, useCardPreviewModal: () => ({}) }))
vi.mock('../../features/floatingWindows', () => ({ FloatingWindowsLayer: () => null }))

import { AppRouter } from './AppRouter'

const originalScrollTo = Element.prototype.scrollTo

describe('AppRouter guest gate', () => {
    beforeEach(() => {
        Element.prototype.scrollTo = vi.fn()
        setAllTestFeatureFlags(true)
        mocks.page = 'library'
        mocks.isAuthenticated = false
        mocks.setPage.mockClear()
        mocks.openLoginModal.mockClear()
    })

    afterEach(() => {
        Element.prototype.scrollTo = originalScrollTo
    })

    it('invites a guest to sign up instead of rendering the Library', async () => {
        render(<AppRouter />)

        expect(await screen.findByRole('heading', { name: 'Your library lives here' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Library page' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Create free account' }))
        expect(mocks.openLoginModal).toHaveBeenLastCalledWith('register')
        fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
        expect(mocks.openLoginModal).toHaveBeenLastCalledWith('login')
        fireEvent.click(screen.getByRole('button', { name: 'Back to Explore' }))
        expect(mocks.setPage).toHaveBeenCalledWith('landing')
    })

    it.each([
        ['notifications', 'Know when the magic is ready', 'Notifications page'],
        ['chatroom', 'Pick up where you left off', 'Chatroom page'],
        ['gallery-media', 'Every portrait and theme, collected', 'Media page'],
    ])('never mounts %s for a guest (no private requests, no false "session expired")', async (page, gateTitle, pageHeading) => {
        mocks.page = page
        render(<AppRouter />)

        expect(await screen.findByRole('heading', { name: gateTitle })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: pageHeading })).not.toBeInTheDocument()
    })

    it('keeps public pages open to guests', async () => {
        mocks.page = 'landing'
        render(<AppRouter />)

        expect(await screen.findByRole('heading', { name: 'Landing page' })).toBeInTheDocument()
        expect(screen.queryByTestId('guest-gate')).not.toBeInTheDocument()
    })

    it('renders the page itself once signed in', async () => {
        mocks.isAuthenticated = true
        render(<AppRouter />)

        expect(await screen.findByRole('heading', { name: 'Library page' })).toBeInTheDocument()
        expect(screen.queryByTestId('guest-gate')).not.toBeInTheDocument()
    })
})
