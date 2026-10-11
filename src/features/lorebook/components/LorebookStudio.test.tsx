import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lorebook, LorebookResource } from '@/shared'
import { authSession } from '@/infrastructure/api/authSession'
import { EXTRACTION_HASH as HASH, extractionResult } from '@/infrastructure/api/__tests__/fixtures/lorebookExtraction'

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), extract: vi.fn(), reconcile: vi.fn(), setEditing: vi.fn(), setBooks: vi.fn() }))
let initial: Lorebook
vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useNavigation: () => ({ setPage: vi.fn() }),
    useData: () => ({ editingLorebook: initial, lorebooks: [], setEditingLorebook: mocks.setEditing, setLorebooks: mocks.setBooks }),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/infrastructure/api', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/infrastructure/api')>(),
    apiService: { createLorebook: mocks.create, updateLorebook: mocks.update, extractLorebookResource: mocks.extract, getLorebookResourceExtraction: mocks.reconcile },
}))
vi.mock('./LorebookAssistantChatbot', () => ({ LorebookAssistantChatbot: () => null }))
vi.mock('./LorebookAttachPanel', () => ({ LorebookAttachPanel: () => null }))
vi.mock('./ActivationPreviewPanel', () => ({ ActivationPreviewPanel: () => null }))
vi.mock('./LorebookResourcePickerDrawer', () => ({ LorebookResourcePickerDrawer: () => null }))
vi.mock('./LoreEntryEditor', () => ({ LoreEntryEditor: () => null }))
vi.mock('./LoreEntryTable', () => ({ LoreEntryTable: () => null }))
vi.mock('./LorebookResourcePanel', () => ({ LorebookResourcePanel: ({ resources, onExtractMetadataOnSaveChange }: { resources: LorebookResource[]; onExtractMetadataOnSaveChange: (value: boolean) => void }) => <div>
    <button onClick={() => onExtractMetadataOnSaveChange(true)}>Extract metadata</button>
    {resources.map((resource) => <span key={resource.id}>{resource.id}:{resource.extractionStatus}</span>)}
</div> }))

import { ApiError } from '@/infrastructure/api'
import { LorebookStudio } from './LorebookStudio'

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
    })
    afterEach(() => { vi.unstubAllEnvs(); authSession.continueSignedOut() })

    it('saves source without invoking inference when the checkbox is off', async () => {
        render(<LorebookStudio />)
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
        await waitFor(() => expect(mocks.setEditing).toHaveBeenCalledWith(expect.objectContaining({ id: 'book-1' })))
        expect(mocks.create.mock.calls[0]).toHaveLength(1)
        expect(mocks.extract).not.toHaveBeenCalled()
    })

    it('retains the new book and completed resources when a later extraction fails', async () => {
        mocks.extract.mockImplementationOnce(async () => {
            expect(mocks.setEditing).toHaveBeenCalledWith(expect.objectContaining({ id: 'book-1' }))
            return extractionResult({ lorebook_id: 'book-1' })
        }).mockRejectedValueOnce(new ApiError(0, 'Unknown'))
        render(<LorebookStudio />)
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
        render(<LorebookStudio />)
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'common.save' })).toBeEnabled())
        expect(mocks.setEditing).not.toHaveBeenCalled()
        expect(mocks.extract).not.toHaveBeenCalled()
    })
})
