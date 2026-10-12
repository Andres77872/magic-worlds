import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_COLLECTION_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'

const mocks = vi.hoisted(() => ({
    getWorkspace: vi.fn(),
    restoreWorkspace: vi.fn(),
    commit: vi.fn(() => true),
}))

vi.mock('@/infrastructure/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/infrastructure/api')>()),
    apiService: { getWorkspace: mocks.getWorkspace, restoreWorkspace: mocks.restoreWorkspace, resolveContent: vi.fn() },
}))

import { NavigationProvider } from '@/app/providers/NavigationProvider'
import { useNavigation } from '@/app/hooks/useNavigation'
import { CreationOriginProvider, useCreationOrigin } from '@/features/library/creationOrigin'
import { takeLibraryReturn } from '@/features/library/libraryReturn'
import { OriginNavigationProvider, useOriginNavigation, type OriginNavigationOutcome } from './originNavigation'
import { WorkspaceNavigationBridge } from './WorkspaceNavigationBridge'
import { ArchivedWorkspaceBanner } from './components/WorkspaceNotices'

const novel = testWorkspace(OTHER_WORKSPACE_ID, 'Novel A')
let state: WorkspaceTestState

function Probe() {
    const { origin, isCaptured, capture, returnToLibrary } = useCreationOrigin()
    const { navigateToOrigin } = useOriginNavigation()
    const { setPage, currentPage } = useNavigation()
    const [outcome, setOutcome] = useState<OriginNavigationOutcome | null>(null)
    return (
        <div>
            <output data-testid="page">{currentPage}</output>
            <output data-testid="captured">{isCaptured ? origin?.collectionId ?? 'root' : 'none'}</output>
            <output data-testid="outcome">{outcome ?? ''}</output>
            <button type="button" onClick={() => capture({
                workspaceId: TEST_WORKSPACE_ID,
                collectionId: TEST_COLLECTION_ID,
                returnTo: { collectionId: TEST_COLLECTION_ID, query: 'elf', typeFilter: 'world', uncollected: false, scrollY: 120 },
            })}>Capture</button>
            <button type="button" onClick={() => returnToLibrary(null)}>Back to library</button>
            <button type="button" onClick={() => returnToLibrary({ cardType: 'world', cardId: 'w7' })}>Saved</button>
            <button type="button" onClick={() => setPage('landing')}>Leave</button>
            <button type="button" onClick={() => void navigateToOrigin({ workspaceId: OTHER_WORKSPACE_ID, page: 'gallery-media' }).then(setOutcome)}>
                Open origin
            </button>
        </div>
    )
}

function renderBridge() {
    return render(
        <WorkspaceTestProvider state={state}>
            <NavigationProvider>
                <OriginNavigationProvider>
                    <CreationOriginProvider>
                        <WorkspaceNavigationBridge />
                        <ArchivedWorkspaceBanner />
                        <Probe />
                    </CreationOriginProvider>
                </OriginNavigationProvider>
            </NavigationProvider>
        </WorkspaceTestProvider>,
    )
}

describe('WorkspaceNavigationBridge', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_WORKSPACES_ENABLED', 'true')
        vi.clearAllMocks()
        takeLibraryReturn(TEST_WORKSPACE_ID)
        window.history.replaceState(null, '', '#/world')
        state = createWorkspaceTestState({ overrides: { commitWorkspace: mocks.commit } })
    })

    afterEach(() => vi.unstubAllEnvs())

    it('returns from a creator to the captured library location, with or without a saved card', () => {
        renderBridge()
        fireEvent.click(screen.getByRole('button', { name: 'Capture' }))
        expect(screen.getByTestId('captured')).toHaveTextContent(TEST_COLLECTION_ID)

        // Back (no saved card): the location comes back without a highlight.
        fireEvent.click(screen.getByRole('button', { name: 'Back to library' }))
        expect(window.location.hash).toBe(`#/library?workspace=${TEST_WORKSPACE_ID}&collection=${TEST_COLLECTION_ID}&q=elf&card_type=world`)
        expect(takeLibraryReturn(TEST_WORKSPACE_ID)).toEqual({ created: null, scrollY: 120 })
        expect(screen.getByTestId('captured')).toHaveTextContent('none')
    })

    it('hands the saved card to the Library after a create', () => {
        renderBridge()
        fireEvent.click(screen.getByRole('button', { name: 'Capture' }))
        fireEvent.click(screen.getByRole('button', { name: 'Saved' }))
        expect(screen.getByTestId('page')).toHaveTextContent('library')
        expect(takeLibraryReturn(TEST_WORKSPACE_ID)).toEqual({ created: { cardType: 'world', cardId: 'w7' }, scrollY: 120 })
    })

    it('drops the captured origin once the user leaves the creators', () => {
        renderBridge()
        fireEvent.click(screen.getByRole('button', { name: 'Capture' }))
        fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
        expect(screen.getByTestId('captured')).toHaveTextContent('none')
    })

    it('registers the origin navigator so records open in their own workspace', async () => {
        mocks.getWorkspace.mockResolvedValue(novel)
        renderBridge()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Open origin' }))
        })
        await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('navigated'))
        expect(mocks.commit).toHaveBeenCalledWith(novel)
        expect(window.location.hash).toBe(`#/gallery/media?workspace=${OTHER_WORKSPACE_ID}`)
    })
})

describe('ArchivedWorkspaceBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        window.history.replaceState(null, '', '#/')
    })

    it('offers Restore for an archived selected workspace and commits the restored version', async () => {
        const archived = testWorkspace(TEST_WORKSPACE_ID, 'Main library', { archived_at: '2026-10-10T00:00:00Z', row_version: 6 })
        mocks.restoreWorkspace.mockResolvedValue({ ...archived, archived_at: null, row_version: 7 })
        state = createWorkspaceTestState({ workspaces: [archived, novel], overrides: { commitWorkspace: mocks.commit } })
        renderBridge()
        expect(screen.getByText('This workspace is archived. Restore it to create or edit content.')).toBeInTheDocument()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
        })
        expect(mocks.restoreWorkspace).toHaveBeenCalledWith(TEST_WORKSPACE_ID, 6)
        expect(mocks.commit).toHaveBeenCalledWith({ ...archived, archived_at: null, row_version: 7 })
    })

    it('is absent for an active workspace', () => {
        state = createWorkspaceTestState()
        renderBridge()
        expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument()
    })
})
