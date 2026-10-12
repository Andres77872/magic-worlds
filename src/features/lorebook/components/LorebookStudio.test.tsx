import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Lorebook, LorebookResource } from '@/shared'
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
    const mocks = { create: vi.fn(), update: vi.fn(), extract: vi.fn(), reconcile: vi.fn(), setEditing: vi.fn(), setBooks: vi.fn(), panelProps: vi.fn(), readOnly: vi.fn() }
    // One scoped client per workspace, like `apiService.withWorkspace`; the mocks record it as `this`.
    const client = (workspaceId: string) => ({
        workspaceScope: { workspaceId, initialCollectionIds: [] },
        createLorebook: mocks.create, updateLorebook: mocks.update, extractLorebookResource: mocks.extract, getLorebookResourceExtraction: mocks.reconcile,
    })
    return { ...mocks, client }
})
let initial: Lorebook
vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useNavigation: () => ({ setPage: vi.fn(), currentHash: '', replaceHash: vi.fn() }),
    useData: () => ({ editingLorebook: initial, lorebooks: [], setEditingLorebook: mocks.setEditing, setLorebooks: mocks.setBooks }),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/infrastructure/api', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/infrastructure/api')>(),
    apiService: { withWorkspace: (workspaceId: string) => mocks.client(workspaceId) },
}))
vi.mock('@/features/creation/common/components/assistant/AssistantChatbot', () => ({ AssistantChatbot: (props: { workspaceId?: string | null; readOnly?: boolean }) => { mocks.panelProps('assistant', props.workspaceId); mocks.readOnly('assistant', props.readOnly); return null } }))
vi.mock('./LorebookAttachPanel', () => ({ LorebookAttachPanel: (props: { workspaceId?: string | null; readOnly?: boolean }) => { mocks.panelProps('attach', props.workspaceId); mocks.readOnly('attach', props.readOnly); return null } }))
// The preview is a read: it renders outside every read-only fieldset.
vi.mock('./ActivationPreviewPanel', () => ({ ActivationPreviewPanel: (props: { workspaceId?: string | null }) => { mocks.panelProps('preview', props.workspaceId); return <button>Run preview</button> } }))
vi.mock('./LorebookResourcePickerDrawer', () => ({ LorebookResourcePickerDrawer: (props: { workspaceId?: string | null; open: boolean }) => { mocks.panelProps('picker', props.workspaceId); mocks.readOnly('picker-open', props.open); return null } }))
vi.mock('./LoreEntryEditor', () => ({ LoreEntryEditor: () => <input aria-label="Entry title" /> }))
vi.mock('./LoreEntryTable', () => ({ LoreEntryTable: (props: { readOnly?: boolean }) => { mocks.readOnly('table', props.readOnly); return null } }))
vi.mock('./LorebookResourcePanel', () => ({ LorebookResourcePanel: ({ resources, onExtractMetadataOnSaveChange, onImportingChange, readOnly }: { resources: LorebookResource[]; onExtractMetadataOnSaveChange: (value: boolean) => void; onImportingChange: (value: boolean) => void; readOnly?: boolean }) => <div data-testid="lorebook-resource-panel-mock" data-read-only={readOnly}>
    <button onClick={() => onImportingChange(true)}>Start importing</button>
    <button onClick={() => onImportingChange(false)}>Finish importing</button>
    <button onClick={() => onExtractMetadataOnSaveChange(true)}>Extract metadata</button>
    {resources.map((resource) => <span key={resource.id}>{resource.id}:{resource.extractionStatus}</span>)}
</div> }))

import { ApiError } from '@/infrastructure/api'
import { LorebookStudio } from './LorebookStudio'

/** The workspace (`X-Workspace-Id`) of each call a client mock received. */
const workspacesOf = (mock: Mock) => mock.mock.contexts.map((client) => (client as { workspaceScope: { workspaceId: string } }).workspaceScope.workspaceId)
let workspace: WorkspaceTestState
const studio = () => <WorkspaceTestProvider state={workspace}><LorebookStudio /></WorkspaceTestProvider>

function source(id: string): LorebookResource {
    return { id, title: 'Archive', description: null, triggers: [], fileName: 'archive.md', fileType: 'md', content: 'Court facts.', evaluationHash: HASH, extractionStatus: 'pending', extraction: null }
}
function book(id = ''): Lorebook {
    return { id, name: 'Court book', description: null, tags: [], enabled: true, settings: { scanDepth: 8, tokenBudget: 1200, recursiveScanning: false, matchWholeWords: true, caseSensitive: false }, entries: [], attachments: [], metadata: { resources: [source('resource-1'), source('resource-2')], sharedResources: [source('shared-1')] } }
}

describe('LorebookStudio source save and explicit extraction', () => {
    beforeEach(() => {
        vi.clearAllMocks(); localStorage.clear(); authSession.authenticate('alice', 'token')
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true'); vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', 'true')
        initial = book()
        mocks.create.mockResolvedValue(book('book-1'))
        mocks.update.mockImplementation(async (_id: string, payload: Record<string, unknown>) => ({ ...book('book-1'), ...payload, id: 'book-1' }))
        workspace = createWorkspaceTestState({ api: mocks.client(TEST_WORKSPACE_ID) })
    })
    afterEach(() => { vi.unstubAllEnvs(); authSession.continueSignedOut() })

    it('saves source without invoking inference when the checkbox is off', async () => {
        render(studio())
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
        await waitFor(() => expect(mocks.setEditing).toHaveBeenCalledWith(expect.objectContaining({ id: 'book-1' })))
        expect(mocks.create.mock.calls[0]).toHaveLength(1)
        expect(mocks.extract).not.toHaveBeenCalled()
    })

    it('waits for resource file conversion before allowing a source save', () => {
        render(studio())
        fireEvent.click(screen.getByRole('button', { name: 'Start importing' }))
        const save = screen.getByRole('button', { name: 'common.save' })
        expect(save).toBeDisabled()
        fireEvent.click(save)
        expect(mocks.create).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Finish importing' }))
        expect(save).toBeEnabled()
    })

    it('retains the new book and completed resources when a later extraction fails', async () => {
        mocks.extract.mockImplementationOnce(async () => {
            expect(mocks.setEditing).toHaveBeenCalledWith(expect.objectContaining({ id: 'book-1' }))
            return extractionResult({ lorebook_id: 'book-1' })
        }).mockRejectedValueOnce(new ApiError(0, 'Unknown'))
        render(studio())
        fireEvent.click(screen.getByRole('button', { name: 'Extract metadata' }))
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('lorebookStudio.resources.errors.extractionAfterSave')
        expect(screen.getByText('resource-1:completed')).toBeInTheDocument()
        expect(screen.getByText('resource-2:pending')).toBeInTheDocument()
        expect(mocks.extract.mock.calls.map((call) => call[0])).toEqual(['resource-1', 'resource-2'])
        const requestId = mocks.extract.mock.calls[1][2].requestId
        mocks.update.mockResolvedValueOnce({ ...book('book-1'), metadata: { resources: [{ ...source('resource-1'), extractionStatus: 'completed', extraction: extractionResult().extraction }, source('resource-2')] } })
        mocks.reconcile.mockResolvedValueOnce({ status: 'completed', request_id: requestId, result: extractionResult({ resource_id: 'resource-2', lorebook_id: 'book-1' }) })
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
        await waitFor(() => expect(screen.getByText('resource-2:completed')).toBeInTheDocument())
        expect(mocks.create).toHaveBeenCalledTimes(1)
        expect(mocks.update.mock.calls[0][0]).toBe('book-1')
        expect(mocks.extract).toHaveBeenCalledTimes(2)
        expect(mocks.reconcile).toHaveBeenCalledWith('resource-2', HASH, { requestId }, 'book-1')
    })

    it('ignores a late save response after account ownership changes', async () => {
        mocks.create.mockImplementationOnce(async () => { authSession.authenticate('bob', 'bob-token'); return book('book-1') })
        render(studio())
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'common.save' })).toBeEnabled())
        expect(mocks.setEditing).not.toHaveBeenCalled()
        expect(mocks.extract).not.toHaveBeenCalled()
    })

    it('creates a new book, extracts its resources and binds its panels in the workspace committed at open', async () => {
        mocks.extract.mockResolvedValueOnce(extractionResult({ lorebook_id: 'book-1' }))
            .mockResolvedValueOnce(extractionResult({ resource_id: 'resource-2', lorebook_id: 'book-1' }))
        render(studio())
        fireEvent.click(screen.getByRole('button', { name: 'Extract metadata' }))
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
        await waitFor(() => expect(screen.getByText('resource-2:completed')).toBeInTheDocument())
        expect(workspacesOf(mocks.create)).toEqual([TEST_WORKSPACE_ID])
        expect(workspacesOf(mocks.extract)).toEqual([TEST_WORKSPACE_ID, TEST_WORKSPACE_ID])
        // Write bodies never carry server-owned organization metadata.
        expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('organization')
        expect(mocks.setBooks).toHaveBeenCalledWith([expect.objectContaining({ id: 'book-1' })])
        for (const panel of ['assistant', 'attach', 'preview', 'picker']) {
            expect(mocks.panelProps).toHaveBeenCalledWith(panel, TEST_WORKSPACE_ID)
        }
    })

    it('keeps an opened book in its own workspace', async () => {
        initial = { ...book('book-1'), organization: { workspace_id: OTHER_WORKSPACE_ID } }
        render(studio())
        expect(mocks.panelProps).toHaveBeenCalledWith('assistant', OTHER_WORKSPACE_ID)
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
        await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce())
        expect(mocks.update.mock.calls[0][0]).toBe('book-1')
        expect(workspacesOf(mocks.update)).toEqual([OTHER_WORKSPACE_ID])
        expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('organization')
        // The editor keeps the saved book, but the committed workspace's list never takes it.
        await waitFor(() => expect(mocks.setEditing).toHaveBeenCalledWith(expect.objectContaining({ id: 'book-1' })))
        expect(mocks.setBooks).not.toHaveBeenCalled()
    })

    it('ignores a late save response after a workspace switch', async () => {
        let finish!: (value: Lorebook) => void
        mocks.create.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
        const { rerender } = render(studio())
        fireEvent.click(screen.getByRole('button', { name: 'Extract metadata' }))
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
        await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce())
        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        rerender(studio())
        await act(async () => finish(book('book-1')))
        await waitFor(() => expect(screen.getByRole('button', { name: 'common.save' })).toBeEnabled())
        expect(workspacesOf(mocks.create)).toEqual([TEST_WORKSPACE_ID])
        expect(mocks.setEditing).not.toHaveBeenCalled()
        expect(mocks.setBooks).not.toHaveBeenCalled()
        expect(mocks.extract).not.toHaveBeenCalled()
    })
})

describe('LorebookStudio in an archived workspace', () => {
    beforeEach(() => {
        vi.clearAllMocks(); localStorage.clear(); authSession.authenticate('alice', 'token')
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true'); vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', 'true')
        mocks.update.mockResolvedValue(book('book-1'))
        // The selected workspace is active; the book's own workspace is archived.
        workspace = createWorkspaceTestState({
            api: mocks.client(TEST_WORKSPACE_ID),
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-10T00:00:00Z' }),
            ],
        })
    })
    afterEach(() => { vi.unstubAllEnvs(); authSession.continueSignedOut() })

    it('keys on the book\'s own workspace: fields, save and every write panel are disabled; the preview stays usable', () => {
        initial = { ...book('book-1'), organization: { workspace_id: OTHER_WORKSPACE_ID } }
        render(studio())

        expect(screen.getByLabelText('lorebookStudio.shell.fields.name.label')).toBeDisabled()
        expect(screen.getByLabelText('lorebookStudio.shell.fields.scanDepth.label')).toBeDisabled()
        expect(screen.getByLabelText('Entry title')).toBeDisabled()

        const save = screen.getByRole('button', { name: 'common.save' })
        expect(save).toBeDisabled()
        fireEvent.click(save)
        expect(mocks.update).not.toHaveBeenCalled()
        expect(mocks.create).not.toHaveBeenCalled()

        // Assistant send, entry add/delete, attachments and resources are read-only; the picker never opens.
        for (const panel of ['assistant', 'table', 'attach']) expect(mocks.readOnly).toHaveBeenCalledWith(panel, true)
        expect(screen.getByTestId('lorebook-resource-panel-mock')).toHaveAttribute('data-read-only', 'true')
        expect(mocks.readOnly).not.toHaveBeenCalledWith('picker-open', true)

        expect(screen.getByRole('button', { name: 'Run preview' })).toBeEnabled()
        // The shell banner only covers the selected workspace, so the studio explains itself.
        expect(screen.getByTestId('lorebook-archived-notice')).toHaveTextContent('workspaceContent.saveErrors.archived')
    })

    it('stays editable for a book whose own workspace is active', async () => {
        initial = { ...book('book-1'), organization: { workspace_id: TEST_WORKSPACE_ID } }
        render(studio())

        expect(screen.getByLabelText('Entry title')).toBeEnabled()
        expect(screen.queryByTestId('lorebook-archived-notice')).not.toBeInTheDocument()
        for (const panel of ['assistant', 'table', 'attach']) expect(mocks.readOnly).toHaveBeenCalledWith(panel, false)
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
        await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce())
        expect(workspacesOf(mocks.update)).toEqual([TEST_WORKSPACE_ID])
    })
})
