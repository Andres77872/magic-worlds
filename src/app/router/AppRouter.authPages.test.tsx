import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    token: 'email-token' as string | null,
    epoch: 1,
    isAuthenticated: true,
    logout: vi.fn(),
    verifyEmail: vi.fn(),
    openLoginModal: vi.fn(),
}))

vi.mock('../hooks', () => ({
    useNavigation: () => ({ currentPage: 'verify-email', setPage: vi.fn() }),
    useData: () => ({ loadingState: { isLoading: false } }),
    useAuth: () => ({
        ...mocks,
        authEpoch: mocks.epoch,
        accountKey: `account-${mocks.epoch}`,
        sessionPhase: mocks.isAuthenticated ? 'authenticated' : 'signed_out',
        isLoginModalOpen: false,
        closeLoginModal: vi.fn(),
    }),
}))
vi.mock('@/infrastructure/api', () => ({ apiService: { verifyEmail: mocks.verifyEmail } }))
vi.mock('@/app/bootstrap/authDeepLink', () => ({ clearAuthDeepLink: () => { mocks.token = null } }))
vi.mock('@/features/gallery/galleryLinks', () => ({ parseAuthToken: () => mocks.token }))
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

beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
    mocks.token = 'email-token'
    mocks.epoch = 1
    mocks.isAuthenticated = true
    mocks.logout.mockReset().mockImplementation(async () => {
        mocks.epoch += 1
        mocks.isAuthenticated = false
    })
})

afterEach(() => {
    Element.prototype.scrollTo = originalScrollTo
})

it('keeps the email verification result visible after verification logs the user out', async () => {
    let resolve!: () => void
    mocks.verifyEmail.mockReset().mockReturnValue(new Promise<void>(done => { resolve = done }))
    const view = render(<AppRouter />, { reactStrictMode: true })
    await screen.findByRole('heading', { name: /confirming your email/i })
    await act(async () => resolve())
    expect(mocks.logout).toHaveBeenCalledOnce()

    view.rerender(<AppRouter />)

    expect(screen.getByRole('heading', { name: /email confirmed/i })).toBeInTheDocument()
    expect(mocks.verifyEmail).toHaveBeenCalledExactlyOnceWith('email-token')
})
