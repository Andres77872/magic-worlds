import { afterEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { apiService } from '@/infrastructure/api'
import {
    createWorkspaceTestState,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import type { CardDraftConflict, UseCardDraftApi } from '../engine'
import { CardDraftControls } from './CardDraftControls'

vi.mock('@/app/hooks', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/app/hooks')>()),
    useNavigation: () => ({ replaceHash: vi.fn() }),
}))

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

function wrapper({ children }: { children: ReactNode }) {
    const workspace = createWorkspaceTestState({ api: apiService.withWorkspace(TEST_WORKSPACE_ID) })
    return <WorkspaceTestProvider state={workspace}>{children}</WorkspaceTestProvider>
}

function draftWith(conflict: CardDraftConflict, patch: Partial<UseCardDraftApi> = {}): UseCardDraftApi {
    return {
        draftState: { hasDraft: true, basedOnVersionNumber: 2, latestVersionNumber: 2 },
        hasDraft: true, isHistorical: false, viewingVersionNumber: null,
        loading: false, saving: false, publishing: false, busy: false, error: null, clearError: vi.fn(),
        saveDraft: vi.fn().mockResolvedValue(true), publish: vi.fn(), discard: vi.fn(), restoreIntoDraft: vi.fn(),
        refresh: vi.fn(), conflict, loadLatest: vi.fn(), adoptLatest: vi.fn().mockResolvedValue(true), dismissConflict: vi.fn(),
        ...patch,
    }
}

function renderControls(draft: UseCardDraftApi) {
    const handlers = { onHydrate: vi.fn(), onDraftSaved: vi.fn() }
    render(<CardDraftControls cardType="character" cardId="card-1" cardName="Mara" draft={draft} {...handlers} />, { wrapper })
    return handlers
}

it('says a save over a draft a novel changed was not applied and loads the newer draft into the form', async () => {
    const newer = { id: 'card-1', name: 'Mara', description: 'Keeps the lamp.', is_draft: true }
    const draft = draftWith({ action: 'save', body: { name: 'Mine' } }, { loadLatest: vi.fn().mockResolvedValue(newer) })
    const { onHydrate } = renderControls(draft)

    expect(screen.getByRole('dialog', { name: 'This card’s draft changed elsewhere' })).toBeInTheDocument()
    expect(screen.getByText(/Your changes were not saved, and nothing was lost/)).toBeInTheDocument()
    expect(screen.getByText('Loading the newer draft replaces the unsaved edits in this editor.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Load the newer draft' }))
    await waitFor(() => expect(onHydrate).toHaveBeenCalledWith(newer))
    expect(await screen.findByText('Loaded the newer draft.')).toBeInTheDocument()
})

it('saves the editor’s body over the newer draft only when asked, after holding its stamp', async () => {
    const draft = draftWith({ action: 'save', body: { name: 'Mine' } })
    const { onDraftSaved } = renderControls(draft)

    fireEvent.click(screen.getByRole('button', { name: 'Save mine over it' }))
    await waitFor(() => expect(draft.saveDraft).toHaveBeenCalledWith({ name: 'Mine' }, expect.anything()))
    expect(draft.adoptLatest).toHaveBeenCalledBefore(draft.saveDraft as ReturnType<typeof vi.fn>)
    expect(onDraftSaved).toHaveBeenCalledWith({ name: 'Mine' })
})

it('offers no way to publish a draft the author has not seen', () => {
    renderControls(draftWith({ action: 'publish' }))
    expect(screen.getByText(/Nothing was published, so nothing you have not seen went live/)).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((button) => button.textContent)).not.toContain('Publish anyway')
    expect(screen.getByRole('button', { name: 'Load the newer draft' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
})

it('restores a version over the newer draft only when asked', async () => {
    const draft = draftWith({ action: 'restore', versionNumber: 1 }, { restoreIntoDraft: vi.fn().mockResolvedValue({ id: 'card-1', is_draft: true }) })
    const { onHydrate } = renderControls(draft)
    expect(screen.getByText(/Version 1 was not loaded into the draft/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Load version 1 anyway' }))
    await waitFor(() => expect(draft.restoreIntoDraft).toHaveBeenCalledWith(1, expect.anything()))
    expect(onHydrate).toHaveBeenCalledWith({ id: 'card-1', is_draft: true })
})
