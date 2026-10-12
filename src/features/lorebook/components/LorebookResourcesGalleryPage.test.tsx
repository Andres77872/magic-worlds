import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { ReactNode } from 'react'
import type { LorebookResource } from '@/shared'
import { authSession } from '@/infrastructure/api/authSession'
import { EXTRACTION_HASH as HASH, extractionResult } from '@/infrastructure/api/__tests__/fixtures/lorebookExtraction'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    testWorkspace,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'

const mocks = vi.hoisted(() => {
    const mocks = { create: vi.fn(), importPdf: vi.fn(), update: vi.fn(), extract: vi.fn(), reconcile: vi.fn(), remove: vi.fn(), upsert: vi.fn(), replaceHash: vi.fn(), refresh: vi.fn() }
    // One scoped client per workspace, like `apiService.withWorkspace`; the mocks record it as `this`.
    const client = (workspaceId: string) => ({
        workspaceScope: { workspaceId, initialCollectionIds: [] },
        createLorebookResource: mocks.create, importLorebookResourcePdf: mocks.importPdf, updateLorebookResource: mocks.update,
        extractLorebookResource: mocks.extract, getLorebookResourceExtraction: mocks.reconcile, deleteLorebookResource: mocks.remove,
    })
    return { ...mocks, client }
})
let target: LorebookResource
let resourceEdit: { resourceId: string } | null = { resourceId: 'new' }
let galleryItems: LorebookResource[] = []
vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useNavigation: () => ({ resourceEdit, replaceHash: mocks.replaceHash, setPage: vi.fn(), goBack: vi.fn() }),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/infrastructure/api', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/infrastructure/api')>(),
    apiService: { withWorkspace: (workspaceId: string) => mocks.client(workspaceId) },
}))
vi.mock('../hooks/useLorebookResourceGallery', () => ({ useLorebookResourceGallery: () => ({ items: galleryItems, upsertItem: mocks.upsert, refresh: mocks.refresh, query: '', error: null }) }))
vi.mock('./resources/useLorebookResourceRoute', () => ({ useLorebookResourceRoute: () => ({ resource: target, isCreate: resourceEdit?.resourceId === 'new', loading: false }) }))
vi.mock('./resources/ResourceDetailView', () => ({ ResourceDetailView: ({ resource, saving, onSave, onSyncMetadata, banner }: { resource: LorebookResource; saving: boolean; onSave: (resource: LorebookResource, options: { extractMetadata: boolean }) => Promise<boolean>; onSyncMetadata: (resource: LorebookResource) => Promise<boolean>; banner: ReactNode }) => <div>
    {banner}
    <span>{resource.id}:{resource.extractionStatus}</span>
    <button disabled={saving} onClick={() => void onSave(resource, { extractMetadata: true })}>Save with extraction</button>
    <button disabled={saving} onClick={() => void onSyncMetadata(resource)}>Sync</button>
</div> }))

import { ApiError, WorkspaceApiError } from '@/infrastructure/api'
import { TASK_REQUEST_FINISHED, type TaskRequestEvent } from '@/infrastructure/api/resourceTaskEvents'
import { LorebookResourcesGalleryPage } from './LorebookResourcesGalleryPage'

/** The workspace (`X-Workspace-Id`) of each call a client mock received. */
const workspacesOf = (mock: Mock) => mock.mock.contexts.map((client) => (client as { workspaceScope: { workspaceId: string } }).workspaceScope.workspaceId)
let workspace: WorkspaceTestState
const page = () => <WorkspaceTestProvider state={workspace}><LorebookResourcesGalleryPage /></WorkspaceTestProvider>

describe('resource gallery save then extract', () => {
    beforeEach(() => {
        vi.clearAllMocks(); localStorage.clear(); authSession.authenticate('alice', 'token')
        target = { id: 'draft-resource', title: 'Archive', description: null, triggers: [], fileName: 'archive.md', fileType: 'md', content: 'Court facts.', extractionStatus: 'pending', extraction: null }
        resourceEdit = { resourceId: 'new' }
        galleryItems = []
        mocks.create.mockResolvedValue({ ...target, id: 'resource-1', evaluationHash: HASH })
        mocks.upsert.mockImplementation((value: LorebookResource) => { target = value })
        mocks.replaceHash.mockImplementation(() => { resourceEdit = { resourceId: 'resource-1' } })
        workspace = createWorkspaceTestState({ api: mocks.client(TEST_WORKSPACE_ID) })
    })
    afterEach(() => { authSession.continueSignedOut() })

    it('keeps the saved resource and ID when inference fails, then checks the same request', async () => {
        mocks.extract.mockImplementationOnce(async () => {
            expect(mocks.replaceHash).toHaveBeenCalled()
            expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'resource-1', evaluationHash: HASH }))
            throw new ApiError(0, 'Unknown')
        })
        render(page())
        fireEvent.click(screen.getByRole('button', { name: 'Save with extraction' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('lorebookResourcesGallery.errors.extractionAfterSave')
        expect(screen.getByText('resource-1:pending')).toBeInTheDocument()
        expect(mocks.create.mock.calls[0]).toHaveLength(1)
        const requestId = mocks.extract.mock.calls[0][2].requestId
        mocks.reconcile.mockResolvedValueOnce({ status: 'completed', request_id: requestId, result: extractionResult() })
        fireEvent.click(screen.getByRole('button', { name: 'Sync' }))
        await waitFor(() => expect(screen.getByText('resource-1:completed')).toBeInTheDocument())
        expect(mocks.extract).toHaveBeenCalledTimes(1)
        expect(mocks.reconcile).toHaveBeenCalledWith('resource-1', HASH, { requestId }, null)
        expect(mocks.create).toHaveBeenCalledTimes(1)
    })

    it('keeps the saved revision when a source conflict prevents applying extraction', async () => {
        mocks.extract.mockResolvedValueOnce(extractionResult({ extraction: { ...extractionResult().extraction, sourceHash: 'b'.repeat(64) } }))
        render(page())
        fireEvent.click(screen.getByRole('button', { name: 'Save with extraction' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('lorebookResourcesGallery.errors.extractionFailed')
        expect(target.extraction).toBeNull()
        expect(target.id).toBe('resource-1')
        expect(target.content).toBe('Court facts.')
    })

    it('finishes the PDF upload with metadata, without creating the saved source twice', async () => {
        resourceEdit = null
        const file = new File(['%PDF-binary'], 'court.pdf', { type: 'application/pdf' })
        const readAsText = vi.fn(() => { throw new Error('PDF bytes must not be read as text') })
        Object.defineProperty(file, 'text', { value: readAsText })
        mocks.importPdf.mockResolvedValueOnce({ ...target, id:'resource-1',evaluationHash:HASH,title: 'court.pdf', fileName: 'court.md', content: '# Court facts' })
        mocks.extract.mockResolvedValueOnce(extractionResult())
        render(page())
        const input = screen.getByLabelText('lorebookResourcesGallery.actions.upload')
        expect(input).toHaveAttribute('accept', expect.stringContaining('.pdf'))
        fireEvent.change(input, { target: { files: [file] } })
        await waitFor(() => expect(mocks.upsert).toHaveBeenCalled())
        expect(mocks.importPdf).toHaveBeenCalledWith(file)
        expect(mocks.create).not.toHaveBeenCalled()
        expect(workspacesOf(mocks.importPdf)).toEqual([TEST_WORKSPACE_ID])
        expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'court.md', fileType: 'md', content: '# Court facts' }))
        expect(readAsText).not.toHaveBeenCalled()
        await waitFor(() => expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({extractionStatus:'completed'})))
        expect(mocks.extract).toHaveBeenCalledTimes(1)
        // The imported resource's metadata is generated in the workspace the upload started in.
        expect(workspacesOf(mocks.extract)).toEqual([TEST_WORKSPACE_ID])
        expect(screen.queryByText('lorebookResourcesGallery.pdfImportHint')).toBeNull()
    })

    it('keeps uploading valid files after a PDF fails', async () => {
        resourceEdit = null
        mocks.importPdf.mockRejectedValueOnce(new ApiError(422, 'OCR required', { code: 'RESOURCE_PDF_OCR_REQUIRED' }))
        const text = new File(['Court notes'], 'court.txt')
        Object.defineProperty(text, 'text', { value: async () => 'Court notes' })
        render(page())
        fireEvent.change(screen.getByLabelText('lorebookResourcesGallery.actions.upload'), {
            target: { files: [new File(['%PDF-binary'], 'scan.pdf'), text] },
        })
        await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
        expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'court.txt', content: 'Court notes' }))
        expect(screen.getByRole('alert')).toHaveTextContent('lorebookResourcesGallery.errors.pdfOcrRequired')
    })

    it('explains a PDF import the server refused because the workspace was archived meanwhile', async () => {
        resourceEdit = null
        mocks.importPdf.mockRejectedValueOnce(new WorkspaceApiError(409, 'Workspace archived', { code: 'WORKSPACE_ARCHIVED' }))
        render(page())
        fireEvent.change(screen.getByLabelText('lorebookResourcesGallery.actions.upload'), {
            target: { files: [new File(['%PDF-binary'], 'court.pdf')] },
        })
        expect(await screen.findByRole('alert')).toHaveTextContent('workspaceContent.saveErrors.archived')
        expect(mocks.upsert).not.toHaveBeenCalled()
        expect(mocks.extract).not.toHaveBeenCalled()
    })

    it('explains metadata generation the server refused because the workspace was archived meanwhile', async () => {
        resourceEdit = { resourceId: 'resource-1' }
        target = { ...target, id: 'resource-1', evaluationHash: HASH }
        mocks.extract.mockRejectedValueOnce(new WorkspaceApiError(409, 'Workspace archived', { code: 'WORKSPACE_ARCHIVED' }))
        render(page())
        fireEvent.click(screen.getByRole('button', { name: 'Sync' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('workspaceContent.saveErrors.archived')
    })

    it('does not save an imported PDF after the account changes', async () => {
        resourceEdit = null
        let finish!: (value: LorebookResource) => void
        mocks.importPdf.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
        render(page())
        fireEvent.change(screen.getByLabelText('lorebookResourcesGallery.actions.upload'), {
            target: { files: [new File(['%PDF-binary'], 'court.pdf')] },
        })
        await waitFor(() => expect(mocks.importPdf).toHaveBeenCalled())
        authSession.authenticate('bob', 'bob-token')
        finish(target)
        await waitFor(() => expect(screen.getByRole('button', { name: 'lorebookResourcesGallery.actions.upload' })).toBeEnabled())
        expect(mocks.create).not.toHaveBeenCalled()
        expect(mocks.upsert).not.toHaveBeenCalled()
    })

    it('keeps a PDF import that finishes after a workspace switch out of the new workspace', async () => {
        resourceEdit = null
        let finish!: (value: unknown) => void
        mocks.importPdf.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
        const { rerender } = render(page())
        fireEvent.change(screen.getByLabelText('lorebookResourcesGallery.actions.upload'), {
            target: { files: [new File(['%PDF-binary'], 'court.pdf')] },
        })
        await waitFor(() => expect(mocks.importPdf).toHaveBeenCalledOnce())
        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        rerender(page())
        await act(async () => finish({ ...target, id: 'resource-1', evaluationHash: HASH, fileName: 'court.md', content: '# Court facts' }))
        // Imported (and tracked in Tasks) in the workspace it started in; nothing lands in the new one.
        expect(workspacesOf(mocks.importPdf)).toEqual([TEST_WORKSPACE_ID])
        expect(mocks.upsert).not.toHaveBeenCalled()
        expect(mocks.extract).not.toHaveBeenCalled()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('reloads the list when a resource task of this workspace finishes, never for another workspace', () => {
        resourceEdit = null
        render(page())
        const finished = (workspaceId: string | null) => {
            const { authEpoch, accountKey } = authSession.getSnapshot()
            const detail: TaskRequestEvent = { id: `task-${workspaceId}`, authEpoch, accountKey, workspaceId }
            act(() => { window.dispatchEvent(new CustomEvent(TASK_REQUEST_FINISHED, { detail })) })
        }
        finished(OTHER_WORKSPACE_ID)
        expect(mocks.refresh).not.toHaveBeenCalled()
        finished(TEST_WORKSPACE_ID)
        expect(mocks.refresh).toHaveBeenCalledTimes(1)
        // A chat-socket media event without a known workspace still refreshes the visible list.
        finished(null)
        expect(mocks.refresh).toHaveBeenCalledTimes(2)
    })

    it('saves, imports and extracts through the committed workspace client', async () => {
        render(page())
        fireEvent.click(screen.getByRole('button', { name: 'Save with extraction' }))
        await waitFor(() => expect(mocks.extract).toHaveBeenCalledOnce())
        expect(workspacesOf(mocks.create)).toEqual([TEST_WORKSPACE_ID])
        expect(workspacesOf(mocks.extract)).toEqual([TEST_WORKSPACE_ID])
        // Write bodies never carry server-owned organization metadata.
        expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('organization')
    })

    it('recovers a retained extraction in the resource workspace after a switch', async () => {
        mocks.create.mockResolvedValueOnce({ ...target, id: 'resource-1', evaluationHash: HASH, organization: { workspace_id: TEST_WORKSPACE_ID } })
        mocks.extract.mockRejectedValueOnce(new ApiError(0, 'Unknown'))
        const { rerender } = render(page())
        fireEvent.click(screen.getByRole('button', { name: 'Save with extraction' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('lorebookResourcesGallery.errors.extractionAfterSave')
        const requestId = mocks.extract.mock.calls[0][2].requestId

        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        rerender(page())
        mocks.reconcile.mockResolvedValueOnce({ status: 'completed', request_id: requestId, result: extractionResult() })
        fireEvent.click(screen.getByRole('button', { name: 'Sync' }))

        await waitFor(() => expect(screen.getByText('resource-1:completed')).toBeInTheDocument())
        expect(mocks.reconcile).toHaveBeenCalledWith('resource-1', HASH, { requestId }, null)
        expect(workspacesOf(mocks.reconcile)).toEqual([TEST_WORKSPACE_ID])
        expect(mocks.extract).toHaveBeenCalledOnce()
    })

    it('keeps a save that finishes after a workspace switch out of the new workspace UI', async () => {
        let finish!: (value: unknown) => void
        mocks.create.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
        const { rerender } = render(page())
        fireEvent.click(screen.getByRole('button', { name: 'Save with extraction' }))
        await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce())
        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        rerender(page())
        await act(async () => finish({ ...target, id: 'resource-1', evaluationHash: HASH }))
        expect(workspacesOf(mocks.create)).toEqual([TEST_WORKSPACE_ID])
        expect(mocks.upsert).not.toHaveBeenCalled()
        expect(mocks.replaceHash).not.toHaveBeenCalled()
        expect(mocks.extract).not.toHaveBeenCalled()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
})

describe('resource gallery in an archived workspace', () => {
    const ARCHIVED_AT = '2026-10-10T00:00:00Z'
    const resource = (id: string, workspaceId: string): LorebookResource => ({ ...target, id, title: id, organization: { workspace_id: workspaceId } })

    beforeEach(() => {
        vi.clearAllMocks(); localStorage.clear(); authSession.authenticate('alice', 'token')
        target = { id: 'draft-resource', title: 'Archive', description: null, triggers: [], fileName: 'archive.md', fileType: 'md', content: 'Court facts.', extractionStatus: 'pending', extraction: null }
        resourceEdit = null
        galleryItems = []
    })
    afterEach(() => { authSession.continueSignedOut() })

    it('refuses to save, sync or delete a resource whose own workspace is archived', async () => {
        workspace = createWorkspaceTestState({
            api: mocks.client(TEST_WORKSPACE_ID),
            workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library'), testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: ARCHIVED_AT })],
        })
        target = resource('resource-1', OTHER_WORKSPACE_ID)
        resourceEdit = { resourceId: 'resource-1' }
        render(page())

        fireEvent.click(screen.getByRole('button', { name: 'Save with extraction' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('workspaceContent.saveErrors.archived')
        fireEvent.click(screen.getByRole('button', { name: 'Sync' }))
        expect(mocks.update).not.toHaveBeenCalled()
        expect(mocks.extract).not.toHaveBeenCalled()
        expect(mocks.reconcile).not.toHaveBeenCalled()
        expect(mocks.remove).not.toHaveBeenCalled()
    })

    it('keys each card\'s delete on its own workspace and keeps every card openable', () => {
        workspace = createWorkspaceTestState({
            api: mocks.client(TEST_WORKSPACE_ID),
            workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library'), testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: ARCHIVED_AT })],
        })
        galleryItems = [resource('archived-source', OTHER_WORKSPACE_ID), resource('active-source', TEST_WORKSPACE_ID)]
        render(page())

        expect(screen.getAllByRole('button', { name: 'lorebookResourcesGallery.card.deleteAria' })).toHaveLength(2)
        const [archivedDelete, activeDelete] = screen.getAllByRole('button', { name: 'lorebookResourcesGallery.card.deleteAria' })
        expect(archivedDelete).toBeDisabled()
        expect(activeDelete).toBeEnabled()
        for (const open of screen.getAllByRole('button', { name: 'lorebookResourcesGallery.card.openAria' })) expect(open).toBeEnabled()
        // The selected workspace is active, so creation stays available.
        expect(screen.getByRole('button', { name: 'lorebookResourcesGallery.actions.upload' })).toBeEnabled()
    })

    it('disables new, from-URL and upload while the selected workspace is archived', () => {
        workspace = createWorkspaceTestState({
            api: mocks.client(TEST_WORKSPACE_ID),
            workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library', { archived_at: ARCHIVED_AT })],
        })
        render(page())

        for (const name of ['newText', 'newMarkdown', 'fromUrl', 'upload']) {
            for (const button of screen.getAllByRole('button', { name: `lorebookResourcesGallery.actions.${name}` })) expect(button).toBeDisabled()
        }
        const input = screen.getByLabelText('lorebookResourcesGallery.actions.upload')
        expect(input).toBeDisabled()
        fireEvent.change(input, { target: { files: [new File(['Court notes'], 'court.txt')] } })
        expect(screen.getByRole('alert')).toHaveTextContent('workspaceContent.saveErrors.archived')
        expect(mocks.create).not.toHaveBeenCalled()
        expect(mocks.importPdf).not.toHaveBeenCalled()
    })
})
