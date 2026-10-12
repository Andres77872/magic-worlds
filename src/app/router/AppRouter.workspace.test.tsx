import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    page: 'gallery-characters' as string,
    isAuthenticated: true,
    isLoading: false,
    workspace: {
        status: 'ready' as 'idle' | 'loading' | 'ready' | 'unavailable' | 'stale',
        selectedWorkspaceId: '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b' as string | null,
        hasHiddenWorkspaces: false,
        refreshWorkspaces: vi.fn(async () => undefined),
    },
}))

vi.mock('../hooks', () => ({
    useNavigation: () => ({ currentPage: mocks.page, setPage: vi.fn() }),
    useData: () => ({ loadingState: { isLoading: mocks.isLoading } }),
    useWorkspace: () => mocks.workspace,
    useAuth: () => ({
        isAuthenticated: mocks.isAuthenticated,
        authEpoch: 1,
        accountKey: 'account-1',
        sessionPhase: mocks.isAuthenticated ? 'authenticated' : 'signed_out',
        isLoginModalOpen: false,
        closeLoginModal: vi.fn(),
        openLoginModal: vi.fn(),
        continueSignedOut: vi.fn(),
    }),
}))
vi.mock('../../features/gallery/components/GalleryPage', () => ({ GalleryPage: () => <h1>Character gallery</h1> }))
vi.mock('../../features/profile/components/ProfilePage', () => ({ ProfilePage: () => <h1>Profile page</h1> }))
vi.mock('../../features/landing/components/LandingPage', () => ({ LandingPage: () => <h1>Landing page</h1> }))
vi.mock('../../ui/components/Sidebar', () => ({ Sidebar: () => null }))
vi.mock('../../ui/components/MobileTopBar', () => ({ MobileTopBar: () => null }))
vi.mock('../../ui/components/SidebarNavDrawer', () => ({ SidebarNavDrawer: () => null }))
vi.mock('../../ui/components/LoginModal', () => ({ LoginModal: () => null }))
vi.mock('../../ui/components/AppWarningModal', () => ({ AppWarningModal: () => null }))
vi.mock('../../ui/components/CookieConsentBanner', () => ({ CookieConsentBanner: () => null }))
vi.mock('../../ui/components/ServicesDownBanner', () => ({ ServicesDownBanner: () => null }))
vi.mock('../../ui/components/AppUpdateBanner', () => ({
    AppUpdateBanner: ({ updateAvailable }: { updateAvailable?: boolean }) => (updateAvailable ? <div>Update banner</div> : null),
}))
vi.mock('../../ui/components/DataLoadErrorBanner', () => ({ DataLoadErrorBanner: () => <div>Data load banner</div> }))
vi.mock('../../ui/components/audio/PlaylistDock', () => ({ PlaylistDock: () => null }))
vi.mock('../../features/tasks', () => ({ SidebarTasksMenu: () => null, TasksDrawer: () => null }))
vi.mock('../../features/cards', () => ({ CardPreviewModal: () => null, useCardPreviewModal: () => ({}) }))
vi.mock('../../features/floatingWindows', () => ({ FloatingWindowsLayer: () => null }))

import { AppRouter } from './AppRouter'

const originalScrollTo = Element.prototype.scrollTo

describe('AppRouter workspace gating (Workspace R1)', () => {
    beforeEach(() => {
        Element.prototype.scrollTo = vi.fn()
        mocks.page = 'gallery-characters'
        mocks.isAuthenticated = true
        mocks.isLoading = false
        mocks.workspace.status = 'ready'
        mocks.workspace.selectedWorkspaceId = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'
        mocks.workspace.hasHiddenWorkspaces = false
        mocks.workspace.refreshWorkspaces.mockClear()
    })

    afterEach(() => {
        Element.prototype.scrollTo = originalScrollTo
    })

    it('renders private pages once the workspace is ready', async () => {
        render(<AppRouter />)
        expect(await screen.findByRole('heading', { name: 'Character gallery' })).toBeInTheDocument()
        expect(screen.getByText('Data load banner')).toBeInTheDocument()
    })

    it('keeps private pages in the loading state during the handshake, but not account pages', async () => {
        mocks.workspace.status = 'loading'
        mocks.workspace.selectedWorkspaceId = null
        const view = render(<AppRouter />)
        expect(screen.queryByRole('heading', { name: 'Character gallery' })).not.toBeInTheDocument()

        mocks.page = 'profile'
        mocks.isLoading = true
        view.rerender(<AppRouter />)
        expect(await screen.findByRole('heading', { name: 'Profile page' })).toBeInTheDocument()
    })

    it('shows the unavailable state with retry instead of an empty library', async () => {
        mocks.workspace.status = 'unavailable'
        mocks.workspace.selectedWorkspaceId = null
        render(<AppRouter />)
        expect(screen.getByRole('heading', { name: /your library is unavailable while the service is updating/i })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Character gallery' })).not.toBeInTheDocument()
        expect(screen.queryByText('Data load banner')).not.toBeInTheDocument()

        await act(async () => screen.getByRole('button', { name: /try again/i }).click())
        expect(mocks.workspace.refreshWorkspaces).toHaveBeenCalledOnce()
    })

    it('treats the signed-in landing dashboard as private but leaves the public landing alone', async () => {
        mocks.page = 'landing'
        mocks.workspace.status = 'unavailable'
        mocks.workspace.selectedWorkspaceId = null
        const view = render(<AppRouter />)
        expect(screen.getByRole('heading', { name: /your library is unavailable/i })).toBeInTheDocument()

        mocks.isAuthenticated = false
        mocks.workspace.status = 'idle'
        view.rerender(<AppRouter />)
        expect(await screen.findByRole('heading', { name: 'Landing page' })).toBeInTheDocument()
    })

    it('keeps a mounted private page behind the stale dialog until the user reloads or dismisses it', async () => {
        mocks.workspace.status = 'stale'
        render(<AppRouter />)
        expect(await screen.findByRole('heading', { name: 'Character gallery' })).toBeInTheDocument()
        const dialog = screen.getByRole('dialog')
        expect(dialog).toHaveTextContent(/this page is out of date/i)
        expect(dialog).toHaveTextContent(/changes that were not saved before the update can.t be saved from this tab/i)
        expect(screen.getByText('Update banner')).toBeInTheDocument()
        expect(screen.queryByText('Data load banner')).not.toBeInTheDocument()

        await act(async () => screen.getByRole('button', { name: /not now/i }).click())
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.getByText('Update banner')).toBeInTheDocument()
    })

    it('shows the in-page stale state when no workspace was ever selected', () => {
        mocks.workspace.status = 'stale'
        mocks.workspace.selectedWorkspaceId = null
        render(<AppRouter />)
        expect(screen.getByRole('alert')).toHaveTextContent(/this page is out of date/i)
        expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
    })

    it('shows the persistent hidden-workspaces notice', async () => {
        mocks.workspace.hasHiddenWorkspaces = true
        mocks.page = 'profile'
        render(<AppRouter />)
        expect(screen.getByText('Some workspaces are temporarily unavailable. Their content is safe.')).toBeInTheDocument()
    })
})
