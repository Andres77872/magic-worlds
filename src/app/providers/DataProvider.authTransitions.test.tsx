/**
 * Auth-transition behavior: a session expiry followed by an in-place re-login
 * must never unmount the current page (silent reload) nor destroy the open
 * story (expiry-safe clearing). Explicit logout still clears everything.
 */
import { useContext, useEffect } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const openLoginModal = vi.fn()
let authenticated = true
let authEpoch: number | undefined
let pageFocused = true

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ isAuthenticated: authenticated, authEpoch, openLoginModal }),
}))

vi.mock('../hooks/usePageFocus', () => ({
    usePageFocus: () => pageFocused,
    isPageFocused: () => pageFocused,
}))

// Workspace R1: the handshake already selected a workspace; its scoped client is the stub below.
const workspaceMock = vi.hoisted(() => ({
    status: 'ready' as 'idle' | 'loading' | 'ready' | 'unavailable' | 'stale',
    selectedWorkspaceId: '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b' as string | null,
    workspaceEpoch: 1,
    api: null as unknown,
}))
vi.mock('../hooks/useWorkspace', async () => {
    const { apiService } = await import('@/infrastructure')
    workspaceMock.api = apiService
    return { useWorkspace: () => ({ ...workspaceMock }) }
})

vi.mock('@/infrastructure', () => {
    class ApiError extends Error {
        isTransient = false
    }
    return {
        ApiError,
        apiService: {
            getCharacters: vi.fn().mockResolvedValue([]),
            getWorlds: vi.fn().mockResolvedValue([]),
            getItems: vi.fn().mockResolvedValue([]),
            getAdventureTemplates: vi.fn().mockResolvedValue([]),
            getAdventureSessions: vi.fn().mockResolvedValue([]),
            getCharacterChats: vi.fn().mockResolvedValue([]),
            getLorebooks: vi.fn().mockResolvedValue([]),
            getStories: vi.fn().mockResolvedValue([]),
        },
    }
})

import { apiService } from '@/infrastructure'
import { DataContext, DataProvider } from './DataProvider'

const STORY = {
    id: 's1',
    title: 'The Hollow Crown',
    description: null,
    source: { kind: 'blank' as const, id: null, title: null },
    chapters: [],
    activeCardRefs: [],
    activeContext: {
        includeSelectedCards: true,
        includeLorebooks: true,
        includeRecentChapters: 1,
        tokenBudget: 1000,
        styleSource: 'current_chapter' as const,
        customStyleInstruction: null,
    },
}

// Record every isLoading value seen across renders so tests can assert the
// page-unmounting spinner never re-appears on later auth transitions.
const loadingLog: boolean[] = []

function Probe() {
    const ctx = useContext(DataContext)
    loadingLog.push(ctx?.isLoading ?? false)
    return (
        <div>
            <span data-testid="stories-count">{ctx?.stories.length ?? 0}</span>
            <span data-testid="persona-names">{ctx?.characters.filter((card) => card.role === 'persona').map((card) => card.name).join(', ')}</span>
            <button type="button" onClick={() => ctx?.setActiveStory(STORY)}>Open story</button>
            <button type="button" onClick={() => void ctx?.loadData()}>Reload data</button>
            <button type="button" onClick={() => void ctx?.loadData({ silent: true, entryPage: 'landing' })}>Enter landing</button>
            <span data-testid="loading-log">{loadingLog.some((v, i) => v && i > 0 && !loadingLog[i - 1]) ? 'respun' : 'stable'}</span>
            <span data-testid="is-loading">{String(ctx?.isLoading ?? false)}</span>
        </div>
    )
}

function renderProvider() {
    return render(
        <DataProvider>
            <Probe />
        </DataProvider>,
    )
}

function EntryOnMountProbe() {
    const ctx = useContext(DataContext)
    useEffect(() => {
        void ctx?.loadData({ silent: true, entryPage: 'landing' })
        // Test the child-before-parent passive effect ordering on auth transition.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return <span data-testid="entry-ready">{String(ctx?.isLoading === false)}</span>
}

describe('DataProvider auth transitions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'true')
        authenticated = true
        authEpoch = undefined
        pageFocused = true
        window.history.replaceState(null, '', '#/')
        loadingLog.length = 0
        vi.mocked(apiService.getCharacters).mockResolvedValue([])
        vi.mocked(apiService.getStories).mockResolvedValue([STORY])
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })



    it('does one full sweep when a child entry effect runs before the provider auth effect', async () => {
        authenticated = false
        const view = renderProvider()
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'))
        authenticated = true
        view.rerender(<DataProvider><EntryOnMountProbe /></DataProvider>)
        await waitFor(() => expect(apiService.getCharacters).toHaveBeenCalledTimes(1))
        expect(screen.getByTestId('entry-ready')).toHaveTextContent('true')
    })

    it('waits for focus before the authenticated bootstrap and does not reload on every focus return', async () => {
        pageFocused = false
        const view = renderProvider()
        expect(apiService.getCharacters).not.toHaveBeenCalled()

        pageFocused = true
        view.rerender(<DataProvider><Probe /></DataProvider>)
        await waitFor(() => expect(apiService.getCharacters).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'))

        pageFocused = false
        view.rerender(<DataProvider><Probe /></DataProvider>)
        pageFocused = true
        view.rerender(<DataProvider><Probe /></DataProvider>)
        expect(apiService.getCharacters).toHaveBeenCalledTimes(1)
    })

    it('uses the bootstrap result for one immediate page entry, then refreshes on later entry and manually', async () => {
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'))
        expect(apiService.getCharacters).toHaveBeenCalledTimes(1)

        act(() => screen.getByRole('button', { name: 'Enter landing' }).click())
        expect(apiService.getCharacters).toHaveBeenCalledTimes(1)

        act(() => screen.getByRole('button', { name: 'Enter landing' }).click())
        await waitFor(() => expect(apiService.getCharacters).toHaveBeenCalledTimes(2))

        act(() => screen.getByRole('button', { name: 'Reload data' }).click())
        await waitFor(() => expect(apiService.getCharacters).toHaveBeenCalledTimes(3))
    })

    it('refreshes on first page entry when bootstrap loaded a different page', async () => {
        window.history.replaceState(null, '', '#/gallery/characters')
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'))
        expect(apiService.getCharacters).toHaveBeenCalledTimes(1)

        act(() => screen.getByRole('button', { name: 'Enter landing' }).click())
        await waitFor(() => expect(apiService.getCharacters).toHaveBeenCalledTimes(2))
    })
    it('does not preserve a bootstrap skip after navigating away during loading', async () => {
        let releaseCharacters!: () => void
        const gate = new Promise<void>((resolve) => { releaseCharacters = resolve })
        vi.mocked(apiService.getCharacters).mockImplementationOnce(async () => {
            await gate
            return []
        })
        const view = renderProvider()
        expect(apiService.getCharacters).toHaveBeenCalledTimes(1)

        window.history.replaceState(null, '', '#/gallery/characters')
        view.rerender(<DataProvider><Probe /></DataProvider>)
        await act(async () => { releaseCharacters(); await Promise.resolve() })
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'))

        window.history.replaceState(null, '', '#/')
        view.rerender(<DataProvider><Probe /></DataProvider>)
        act(() => screen.getByRole('button', { name: 'Enter landing' }).click())
        await waitFor(() => expect(apiService.getCharacters).toHaveBeenCalledTimes(2))
    })

    it('loads saved personas when persisted login becomes ready without advancing the auth epoch', async () => {
        authenticated = false
        authEpoch = 0
        vi.mocked(apiService.getCharacters).mockResolvedValue([
            { id: 'persona-1', name: '{{user}}', role: 'persona', is_default_persona: true },
        ])
        const view = renderProvider()
        expect(apiService.getCharacters).not.toHaveBeenCalled()

        // AuthProvider hydrates localStorage in an effect; authSession already has
        // this account, so its ownership epoch correctly remains unchanged.
        authenticated = true
        view.rerender(<DataProvider><Probe /></DataProvider>)

        await waitFor(() => expect(screen.getByTestId('persona-names')).toHaveTextContent('{{user}}'))
        expect(apiService.getCharacters).toHaveBeenCalledWith(0, 100)
        expect(screen.getByTestId('loading-log')).toHaveTextContent('stable')
    })

    it('reloads silently on re-login after the initial load (no page-unmounting spinner)', async () => {
        const view = renderProvider()
        await waitFor(() => expect(screen.getByTestId('stories-count')).toHaveTextContent('1'))
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false')

        // Expire, then re-login through the modal.
        act(() => {
            window.dispatchEvent(new CustomEvent('auth:expired'))
        })
        authenticated = false
        view.rerender(
            <DataProvider>
                <Probe />
            </DataProvider>,
        )
        authenticated = true
        view.rerender(
            <DataProvider>
                <Probe />
            </DataProvider>,
        )

        await waitFor(() => expect(apiService.getStories).toHaveBeenCalledTimes(2))
        // isLoading never flipped back to true across the whole expiry/re-login cycle.
        expect(screen.getByTestId('loading-log')).toHaveTextContent('stable')
        await waitFor(() => expect(screen.getByTestId('stories-count')).toHaveTextContent('1'))
    })

    it('keeps only the owner-tagged active story on session expiry', async () => {
        const view = renderProvider()
        await waitFor(() => expect(screen.getByTestId('stories-count')).toHaveTextContent('1'))
        act(() => {
            screen.getByRole('button', { name: 'Open story' }).click()
        })

        act(() => {
            window.dispatchEvent(new CustomEvent('auth:expired'))
        })
        authenticated = false
        view.rerender(
            <DataProvider>
                <Probe />
            </DataProvider>,
        )

        // The unauthenticated pass ran but stories survived the expiry.
        await waitFor(() => expect(screen.getByTestId('stories-count')).toHaveTextContent('1'))
    })

    it('clears the story library on explicit logout (no expiry event)', async () => {
        const view = renderProvider()
        await waitFor(() => expect(screen.getByTestId('stories-count')).toHaveTextContent('1'))

        authenticated = false
        view.rerender(
            <DataProvider>
                <Probe />
            </DataProvider>,
        )

        await waitFor(() => expect(screen.getByTestId('stories-count')).toHaveTextContent('0'))
    })

    it('clears a blocking reload interrupted by logout', async () => {
        const view = renderProvider()
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'))
        let resolveOld!: (cards: unknown) => void
        vi.mocked(apiService.getCharacters).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
        act(() => screen.getByRole('button', { name: 'Reload data' }).click())
        expect(screen.getByTestId('is-loading')).toHaveTextContent('true')

        authenticated = false
        view.rerender(<DataProvider><Probe /></DataProvider>)
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
        await act(async () => resolveOld([{ id: 'stale', name: 'Stale persona', role: 'persona' }]))
        expect(screen.getByTestId('persona-names')).not.toHaveTextContent('Stale persona')
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
    })

    it('releases the previous session spinner when a new auth epoch reloads silently', async () => {
        const view = renderProvider()
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'))
        let resolveOld!: (cards: unknown) => void
        vi.mocked(apiService.getCharacters).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
        act(() => screen.getByRole('button', { name: 'Reload data' }).click())
        expect(screen.getByTestId('is-loading')).toHaveTextContent('true')

        authEpoch = 2
        view.rerender(<DataProvider><Probe /></DataProvider>)
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'))
        await act(async () => resolveOld([]))
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
    })
})

describe('DataProvider workspace gating (Workspace R1)', () => {
    const WS_A = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'
    const WS_B = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'true')
        authenticated = true
        authEpoch = undefined
        pageFocused = true
        window.history.replaceState(null, '', '#/')
        loadingLog.length = 0
        workspaceMock.status = 'ready'
        workspaceMock.selectedWorkspaceId = WS_A
        workspaceMock.workspaceEpoch = 1
        vi.mocked(apiService.getCharacters).mockResolvedValue([])
        vi.mocked(apiService.getStories).mockResolvedValue([STORY])
    })

    afterEach(() => {
        workspaceMock.status = 'ready'
        workspaceMock.selectedWorkspaceId = WS_A
        workspaceMock.workspaceEpoch = 1
        vi.unstubAllEnvs()
    })

    it('sends no private request before the handshake and keeps the existing loading state', async () => {
        workspaceMock.status = 'loading'
        workspaceMock.selectedWorkspaceId = null
        workspaceMock.workspaceEpoch = 0
        const view = renderProvider()
        await act(async () => { await Promise.resolve() })
        expect(apiService.getCharacters).not.toHaveBeenCalled()
        expect(apiService.getStories).not.toHaveBeenCalled()
        expect(screen.getByTestId('is-loading')).toHaveTextContent('true')

        workspaceMock.status = 'ready'
        workspaceMock.selectedWorkspaceId = WS_A
        workspaceMock.workspaceEpoch = 1
        view.rerender(<DataProvider><Probe /></DataProvider>)
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'))
        expect(apiService.getCharacters).toHaveBeenCalledTimes(1)
        expect(screen.getByTestId('stories-count')).toHaveTextContent('1')
    })

    it('releases the spinner without loading anything while the library is unavailable', async () => {
        workspaceMock.status = 'unavailable'
        workspaceMock.selectedWorkspaceId = null
        workspaceMock.workspaceEpoch = 0
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'))
        expect(apiService.getCharacters).not.toHaveBeenCalled()
        expect(screen.getByTestId('stories-count')).toHaveTextContent('0')
    })

    it('drops a load that finishes after a workspace switch and shows the new workspace only', async () => {
        let releaseA!: () => void
        const gate = new Promise<void>((resolve) => { releaseA = resolve })
        vi.mocked(apiService.getStories).mockImplementationOnce(async () => {
            await gate
            return [STORY] as never
        })
        const view = renderProvider()
        expect(apiService.getStories).toHaveBeenCalledTimes(1)

        vi.mocked(apiService.getStories).mockResolvedValue([])
        workspaceMock.selectedWorkspaceId = WS_B
        workspaceMock.workspaceEpoch = 2
        view.rerender(<DataProvider><Probe /></DataProvider>)
        await waitFor(() => expect(apiService.getStories).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'))

        await act(async () => {
            releaseA()
            await gate
            await Promise.resolve()
        })
        expect(screen.getByTestId('stories-count')).toHaveTextContent('0')
    })

    it('clears the previous workspace lists at commit and reloads with the loading state', async () => {
        const view = renderProvider()
        await waitFor(() => expect(screen.getByTestId('stories-count')).toHaveTextContent('1'))

        let releaseB!: () => void
        const gate = new Promise<void>((resolve) => { releaseB = resolve })
        vi.mocked(apiService.getStories).mockImplementationOnce(async () => {
            await gate
            return []
        })
        workspaceMock.selectedWorkspaceId = WS_B
        workspaceMock.workspaceEpoch = 2
        view.rerender(<DataProvider><Probe /></DataProvider>)
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('true'))
        expect(screen.getByTestId('stories-count')).toHaveTextContent('0')

        await act(async () => {
            releaseB()
            await gate
        })
        await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'))
        expect(screen.getByTestId('stories-count')).toHaveTextContent('0')
    })
})
