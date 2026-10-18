import { setTestFeatureFlags, setAllTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NavigationCoordinatorValue, SwitchFailure } from '../providers/NavigationProvider'

const mocks = vi.hoisted(() => ({
    page: 'library' as string,
    setPage: vi.fn(),
    workspace: {
        status: 'ready' as const,
        selectedWorkspaceId: '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b',
        selectedWorkspace: { name: 'Main library' },
        workspaceEpoch: 1,
        hasHiddenWorkspaces: false,
        refreshWorkspaces: vi.fn(async () => undefined),
    },
}))

vi.mock('../hooks', () => ({
    useNavigation: () => ({ currentPage: mocks.page, setPage: mocks.setPage }),
    useData: () => ({ loadingState: { isLoading: false } }),
    useWorkspace: () => mocks.workspace,
    useAuth: () => ({
        isAuthenticated: true,
        authEpoch: 1,
        accountKey: 'account-1',
        sessionPhase: 'authenticated',
        isLoginModalOpen: false,
        closeLoginModal: vi.fn(),
        openLoginModal: vi.fn(),
        continueSignedOut: vi.fn(),
    }),
}))
vi.mock('../../features/library/components/LibraryPage', () => ({ LibraryPage: () => <h1>Library page</h1> }))
vi.mock('../../features/gallery/components/GalleryPage', () => ({ GalleryPage: () => <h1>Character gallery</h1> }))
vi.mock('../../features/errorPages/components/NotFoundPage', () => ({ NotFoundPage: () => <h1>Not found</h1> }))
vi.mock('../../features/novel/components/NovelStudio', () => ({ NovelStudio: () => <h1>Novel workspace</h1> }))
vi.mock('../../features/novel/components/NovelGalleryPage', () => ({ NovelGalleryPage: () => <h1>Novel library</h1> }))
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

import { NavigationCoordinatorContext } from '../providers/NavigationProvider'
import { AppRouter } from './AppRouter'

const originalScrollTo = Element.prototype.scrollTo

function coordinator(overrides: Partial<NavigationCoordinatorValue> = {}): NavigationCoordinatorValue {
    return {
        navigate: vi.fn(async () => 'navigated' as const),
        switchingTo: null,
        switchFailure: null,
        dismissSwitchFailure: vi.fn(),
        routeStatus: 'ready',
        ...overrides,
    }
}

function renderRouter(value: NavigationCoordinatorValue) {
    return render(
        <NavigationCoordinatorContext.Provider value={value}>
            <AppRouter />
        </NavigationCoordinatorContext.Provider>,
    )
}

describe('AppRouter Library and workspace routing', () => {
    beforeEach(() => {
        Element.prototype.scrollTo = vi.fn()
        mocks.page = 'library'
        mocks.setPage.mockClear()
    })

    afterEach(() => {
        Element.prototype.scrollTo = originalScrollTo
        vi.unstubAllEnvs()
    })

    it.each(['community', 'shared-card', 'voice-studio', 'calls', 'gallery-lorebooks', 'lorebook',
        'gallery-resources', 'gallery-stories', 'story', 'gallery-adventures', 'adventure', 'active-adventures', 'interaction', 'assistant'])(
        'blocks %s with all product permissions off', async (page) => {
            setAllTestFeatureFlags(false)
            mocks.page = page
            renderRouter(coordinator())
            expect(await screen.findByText('This feature is not available on your current plan.')).toBeInTheDocument()
        },
    )

    it.each([
        ['calls', 'voices', 'calls'], ['gallery-resources', 'lorebooks', 'lorebookResources'],
    ] as const)('keeps %s unavailable when its parent is off and child is on', async (page, parent, child) => {
        setAllTestFeatureFlags(true)
        setTestFeatureFlags({ [parent]: false })
        setTestFeatureFlags({ [child]: true })
        mocks.page = page
        renderRouter(coordinator())
        expect(await screen.findByText('This feature is not available on your current plan.')).toBeInTheDocument()
    })

    it('renders the globally released Library with every temporary permission off', async () => {
        setAllTestFeatureFlags(false)
        const view = renderRouter(coordinator())
        expect(await screen.findByRole('heading', { name: 'Library page' })).toBeInTheDocument()

        view.rerender(
            <NavigationCoordinatorContext.Provider value={coordinator()}>
                <AppRouter />
            </NavigationCoordinatorContext.Provider>,
        )
        expect(await screen.findByRole('heading', { name: 'Library page' })).toBeInTheDocument()
    })

    it('opens the novel route after a grant and removes it as soon as access is revoked', async () => {
        setAllTestFeatureFlags(false)
        mocks.page = 'story'
        renderRouter(coordinator())
        expect(await screen.findByText('This feature is not available on your current plan.')).toBeInTheDocument()
        act(() => setTestFeatureFlags({ novels: true }))
        expect(await screen.findByRole('heading', { name: 'Novel workspace' })).toBeInTheDocument()
        act(() => setTestFeatureFlags({ novels: null }))
        expect(screen.queryByRole('heading', { name: 'Novel workspace' })).not.toBeInTheDocument()
        expect(screen.getByText('This feature is not available on your current plan.')).toBeInTheDocument()
    })

    it('holds content while a URL is verified and shows the unavailable target instead of this workspace', async () => {

        const view = renderRouter(coordinator({ routeStatus: 'resolving' }))
        expect(screen.queryByRole('heading', { name: 'Library page' })).not.toBeInTheDocument()

        view.rerender(
            <NavigationCoordinatorContext.Provider value={coordinator({ routeStatus: 'unavailable' })}>
                <AppRouter />
            </NavigationCoordinatorContext.Provider>,
        )
        expect(screen.getByRole('heading', { name: 'This content isn’t available' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Library page' })).not.toBeInTheDocument()
        screen.getByRole('button', { name: 'Go to library' }).click()
        expect(mocks.setPage).toHaveBeenCalledWith('library')
    })

    it('reports a failed switch while the source workspace stays open', async () => {

        const retry = vi.fn()
        const failure: SwitchFailure = { reason: 'call', workspaceId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', retry }
        renderRouter(coordinator({ switchFailure: failure }))
        expect(await screen.findByRole('heading', { name: 'Library page' })).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('The active call could not be ended, so you’re still in Main library. Try again.')
        screen.getByRole('button', { name: 'Try again' }).click()
        expect(retry).toHaveBeenCalledOnce()
    })
})
