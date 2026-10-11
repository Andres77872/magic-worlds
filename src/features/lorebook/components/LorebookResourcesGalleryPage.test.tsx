import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { LorebookResource } from '@/shared'
import { authSession } from '@/infrastructure/api/authSession'
import { EXTRACTION_HASH as HASH, extractionResult } from '@/infrastructure/api/__tests__/fixtures/lorebookExtraction'

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), extract: vi.fn(), reconcile: vi.fn(), upsert: vi.fn(), replaceHash: vi.fn() }))
let target: LorebookResource
let resourceEdit = { resourceId: 'new' }
vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useNavigation: () => ({ resourceEdit, replaceHash: mocks.replaceHash, setPage: vi.fn(), goBack: vi.fn() }),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/infrastructure/api', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/infrastructure/api')>(),
    apiService: { createLorebookResource: mocks.create, updateLorebookResource: mocks.update, extractLorebookResource: mocks.extract, getLorebookResourceExtraction: mocks.reconcile },
}))
vi.mock('../hooks/useLorebookResourceGallery', () => ({ useLorebookResourceGallery: () => ({ items: [], upsertItem: mocks.upsert, query: '', error: null }) }))
vi.mock('./resources/useLorebookResourceRoute', () => ({ useLorebookResourceRoute: () => ({ resource: target, isCreate: resourceEdit.resourceId === 'new', loading: false }) }))
vi.mock('./resources/ResourceDetailView', () => ({ ResourceDetailView: ({ resource, saving, onSave, onSyncMetadata, banner }: { resource: LorebookResource; saving: boolean; onSave: (resource: LorebookResource, options: { extractMetadata: boolean }) => Promise<boolean>; onSyncMetadata: (resource: LorebookResource) => Promise<boolean>; banner: ReactNode }) => <div>
    {banner}
    <span>{resource.id}:{resource.extractionStatus}</span>
    <button disabled={saving} onClick={() => void onSave(resource, { extractMetadata: true })}>Save with extraction</button>
    <button disabled={saving} onClick={() => void onSyncMetadata(resource)}>Sync</button>
</div> }))

import { ApiError } from '@/infrastructure/api'
import { LorebookResourcesGalleryPage } from './LorebookResourcesGalleryPage'

describe('resource gallery save then extract', () => {
    beforeEach(() => {
        vi.clearAllMocks(); localStorage.clear(); authSession.authenticate('alice', 'token')
        target = { id: 'draft-resource', title: 'Archive', description: null, triggers: [], fileName: 'archive.md', fileType: 'md', content: 'Court facts.', extractionStatus: 'pending', extraction: null }
        resourceEdit = { resourceId: 'new' }
        mocks.create.mockResolvedValue({ ...target, id: 'resource-1', evaluationHash: HASH })
        mocks.upsert.mockImplementation((value: LorebookResource) => { target = value })
        mocks.replaceHash.mockImplementation(() => { resourceEdit = { resourceId: 'resource-1' } })
    })
    afterEach(() => { authSession.continueSignedOut() })

    it('keeps the saved resource and ID when inference fails, then checks the same request', async () => {
        mocks.extract.mockImplementationOnce(async () => {
            expect(mocks.replaceHash).toHaveBeenCalled()
            expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'resource-1', evaluationHash: HASH }))
            throw new ApiError(0, 'Unknown')
        })
        render(<LorebookResourcesGalleryPage />)
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
        render(<LorebookResourcesGalleryPage />)
        fireEvent.click(screen.getByRole('button', { name: 'Save with extraction' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('lorebookResourcesGallery.errors.extractionAfterSave')
        expect(target.extraction).toBeNull()
        expect(target.id).toBe('resource-1')
        expect(target.content).toBe('Court facts.')
    })
})
