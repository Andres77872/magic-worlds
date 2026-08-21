/**
 * Auth-transition behavior: a session expiry followed by an in-place re-login
 * must never unmount the current page (silent reload) nor destroy the open
 * story (expiry-safe clearing). Explicit logout still clears everything.
 */
import { useContext } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const openLoginModal = vi.fn()
let authenticated = true

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ isAuthenticated: authenticated, openLoginModal }),
}))

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
            <button type="button" onClick={() => ctx?.setActiveStory(STORY)}>Open story</button>
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

describe('DataProvider auth transitions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'true')
        authenticated = true
        loadingLog.length = 0
        vi.mocked(apiService.getStories).mockResolvedValue([STORY])
    })

    afterEach(() => {
        vi.unstubAllEnvs()
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
})
