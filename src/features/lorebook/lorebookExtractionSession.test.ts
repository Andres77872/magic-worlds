import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { ApiError, apiService } from '@/infrastructure/api'
import { authSession } from '@/infrastructure/api/authSession'
import type { LorebookResource } from '@/shared'
import { EXTRACTION_HASH as HASH, extractionResult } from '@/infrastructure/api/__tests__/fixtures/lorebookExtraction'
import { applyLorebookExtraction, createLorebookExtractionSession } from './lorebookExtractionSession'
import { configureLlmPreparation } from '@/infrastructure/api/llmPreparation'
import { waitFor } from '@testing-library/react'

vi.mock('@/infrastructure/api/baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))

const resource: LorebookResource = { id: 'resource-1', title: 'Archive', description: null, triggers: [], fileName: 'archive.md', fileType: 'md', content: 'Court facts.', evaluationHash: HASH, extractionStatus: 'pending', extraction: null }
let session: ReturnType<typeof createLorebookExtractionSession>
let post: MockInstance<typeof apiService.extractLorebookResource>
let get: MockInstance<typeof apiService.getLorebookResourceExtraction>

describe('extraction request receipts', () => {
    it('starts a fresh request after extraction was disabled, without a phantom receipt', async () => {
        post.mockRejectedValueOnce(new ApiError(503,'Disabled',{code:'LOREBOOK_EXTRACTION_DISABLED'}))
        await expect(session.execute(resource)).rejects.toMatchObject({code:'LOREBOOK_EXTRACTION_DISABLED'})
        post.mockResolvedValueOnce(extractionResult())
        await expect(session.execute(resource)).resolves.toEqual(extractionResult())
        expect(post.mock.calls[0][2].requestId).not.toBe(post.mock.calls[1][2].requestId)
        expect(get).not.toHaveBeenCalled()
    })

    it('recovers an earlier phantom receipt only after the server confirms no admission exists', async () => {
        post.mockRejectedValueOnce(new ApiError(0,'Unknown'))
        await expect(session.execute(resource)).rejects.toThrow()
        get.mockRejectedValueOnce(new ApiError(404,'Not found',{code:'LOREBOOK_EXTRACTION_NOT_FOUND'}))
        post.mockResolvedValueOnce(extractionResult())
        await expect(session.execute(resource)).resolves.toEqual(extractionResult())
        expect(post.mock.calls[0][2].requestId).not.toBe(post.mock.calls[1][2].requestId)
        expect(get).toHaveBeenCalledTimes(1)
    })
    beforeEach(() => {
        localStorage.clear(); authSession.authenticate('alice', 'token')
        session = createLorebookExtractionSession()
        post = vi.spyOn(apiService, 'extractLorebookResource')
        get = vi.spyOn(apiService, 'getLorebookResourceExtraction')
    })
    afterEach(() => { session.close(); vi.restoreAllMocks(); authSession.continueSignedOut() })

    it('checks the same request after interruption without storing or resending a key', async () => {
        post.mockRejectedValueOnce(new ApiError(0, 'Unknown', { code: 'lorebook_extraction_unknown' }))
        const llm = { selection: { mode: 'inherit' as const }, credentials: { api_key: 'FAKE_KEY_CANARY' } }
        await expect(session.execute(resource, llm)).rejects.toMatchObject({ code: 'lorebook_extraction_unknown' })
        const requestId = post.mock.calls[0][2].requestId
        const result = extractionResult(); result.llm_execution.replayed = true
        get.mockResolvedValueOnce({ status: 'completed', request_id: requestId, result })
        expect(await session.execute(resource)).toEqual(result)
        expect(post).toHaveBeenCalledTimes(1)
        expect(get).toHaveBeenCalledWith('resource-1', HASH, { requestId }, null)
        expect(JSON.stringify(get.mock.calls)).not.toContain('FAKE_KEY_CANARY')
        expect(localStorage.getItem('FAKE_KEY_CANARY')).toBeNull()
    })

    it('keeps a pending receipt across repeated user actions', async () => {
        post.mockRejectedValueOnce(new ApiError(409, 'Wait', { code: 'lorebook_extraction_pending' }))
        await expect(session.execute(resource)).rejects.toThrow()
        const requestId = post.mock.calls[0][2].requestId
        get.mockResolvedValue({ status: 'pending', request_id: requestId })
        await expect(session.execute(resource)).rejects.toMatchObject({ code: 'lorebook_extraction_pending' })
        await expect(session.execute(resource)).rejects.toThrow()
        expect(post).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledTimes(2)
    })

    it('resumes a recovery-required request with its frozen target, never a new choice or key', async () => {
        const configured = configureLlmPreparation(async () => () => ({ selection: { mode: 'profile', profile_id: 'profile-1' }, expected_revision_id: 'revision-1' }))
        try {
            post.mockRejectedValueOnce(new ApiError(0, 'Unknown', { code: 'lorebook_extraction_unknown' }))
            await expect(session.execute(resource)).rejects.toThrow()
            const requestId = post.mock.calls[0][2].requestId
            get.mockResolvedValueOnce({ status: 'recovery_required', request_id: requestId })
            const result = extractionResult()
            result.llm_execution.profile_id = 'profile-1'; result.llm_execution.revision_id = 'revision-1'
            post.mockResolvedValueOnce(result)
            const later = { selection: { mode: 'profile' as const, profile_id: 'other' }, credentials: { api_key: 'FAKE_KEY_CANARY' } }
            expect(await session.execute(resource, later)).toEqual(result)
            expect(post).toHaveBeenCalledTimes(2)
            expect(post.mock.calls[1][1]).toEqual({ expected_evaluation_hash: HASH,
                llm: { selection: { mode: 'profile', profile_id: 'profile-1' }, expected_revision_id: 'revision-1' } })
            expect(post.mock.calls[1][2]).toEqual({ requestId })
        } finally { configured() }
    })

    it('starts a fresh request once the retained one is spent', async () => {
        post.mockRejectedValueOnce(new ApiError(0, 'Unknown'))
        await expect(session.execute(resource)).rejects.toThrow()
        const requestId = post.mock.calls[0][2].requestId
        get.mockResolvedValueOnce({ status: 'recovery_required', request_id: requestId })
        post.mockRejectedValueOnce(new ApiError(409, 'LLM_EXECUTION_FINISHED', { code: 'LLM_EXECUTION_FINISHED' }))
        await expect(session.execute(resource)).rejects.toMatchObject({ code: 'LLM_EXECUTION_FINISHED' })
        post.mockResolvedValueOnce(extractionResult())
        await session.execute(resource)
        expect(post.mock.calls[2][2].requestId).not.toBe(requestId)
    })

    it('joins concurrent clicks into one inference', async () => {
        post.mockResolvedValueOnce(extractionResult())
        const first = session.execute(resource)
        const second = session.execute(resource)
        expect(first).toBe(second)
        await first
        expect(post).toHaveBeenCalledTimes(1)
    })

    it('keeps old source identity when the saved source changes before reconciliation', async () => {
        post.mockRejectedValueOnce(new ApiError(0, 'Unknown'))
        await expect(session.execute(resource)).rejects.toThrow()
        const requestId = post.mock.calls[0][2].requestId
        get.mockResolvedValueOnce({ status: 'completed', request_id: requestId, result: extractionResult() })
        await expect(session.execute({ ...resource, evaluationHash: 'b'.repeat(64) })).rejects.toMatchObject({ code: 'LOREBOOK_RESOURCE_SOURCE_CHANGED' })
        expect(get).toHaveBeenCalledWith('resource-1', HASH, { requestId }, null)
        expect(post).toHaveBeenCalledTimes(1)
    })

    it('allows corrected pre-admission input with a fresh request', async () => {
        post.mockRejectedValueOnce(new ApiError(422, 'Profile invalid'))
        await expect(session.execute(resource)).rejects.toThrow()
        post.mockResolvedValueOnce(extractionResult())
        await session.execute(resource)
        expect(post.mock.calls[0][2].requestId).not.toBe(post.mock.calls[1][2].requestId)
        expect(get).not.toHaveBeenCalled()
    })

    it('clears another account’s receipt and rejects its late callback', async () => {
        let finish!: (value: ReturnType<typeof extractionResult>) => void
        post.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
        const pending = session.execute(resource)
        await waitFor(() => expect(post).toHaveBeenCalledOnce())
        authSession.authenticate('bob', 'other-token')
        finish(extractionResult())
        await expect(pending).rejects.toMatchObject({ code: 'auth_epoch_changed' })
        post.mockResolvedValueOnce(extractionResult())
        await session.execute(resource)
        expect(get).not.toHaveBeenCalled(); expect(post).toHaveBeenCalledTimes(2)
    })

    it('keeps a receipt across token rotation but clears it on expiry', async () => {
        post.mockRejectedValueOnce(new ApiError(0, 'Unknown'))
        await expect(session.execute(resource)).rejects.toThrow()
        authSession.rotateToken('rotated')
        get.mockResolvedValueOnce({ status: 'pending', request_id: post.mock.calls[0][2].requestId })
        await expect(session.execute(resource)).rejects.toMatchObject({ code: 'lorebook_extraction_pending' })
        authSession.expire()
        await expect(session.execute(resource)).rejects.toMatchObject({ status: 401 })
    })

    it('applies only metadata for the same saved source', () => {
        expect(applyLorebookExtraction(resource, extractionResult())).toMatchObject({ id: resource.id, content: resource.content, extractionStatus: 'completed' })
        expect(() => applyLorebookExtraction({ ...resource, evaluationHash: 'b'.repeat(64) }, extractionResult())).toThrow()
    })

    it('rejects an unsaved resource and a closed session before calling the API', async () => {
        await expect(session.execute({ ...resource, evaluationHash: undefined })).rejects.toMatchObject({ status: 422 })
        session.close()
        await expect(session.execute(resource)).rejects.toMatchObject({ status: 401 })
        expect(post).not.toHaveBeenCalled()
    })

    it('keeps the selected profile identity across keyless recovery without preparing a second key', async () => {
        const provenance = extractionResult().llm_execution
        const prepare = vi.fn(async () => () => ({ selection: { mode: 'profile' as const, profile_id: provenance.profile_id }, expected_revision_id: provenance.revision_id }))
        const unsubscribe = configureLlmPreparation(prepare)
        try {
            post.mockRejectedValueOnce(new ApiError(0, 'Unknown'))
            await expect(session.execute(resource)).rejects.toThrow()
            const requestId = post.mock.calls[0][2].requestId
            get.mockResolvedValueOnce({ status: 'completed', request_id: requestId, result: { ...extractionResult(), llm_execution: { ...provenance, replayed: true } } })
            await session.execute(resource)
            expect(prepare).toHaveBeenCalledOnce()
            expect(get.mock.calls[0]).not.toContainEqual(expect.objectContaining({ credentials: expect.anything() }))
        } finally { unsubscribe() }
    })
    it('does not retain a receipt if credential entry is cancelled before admission', async () => {
        const unsubscribe = configureLlmPreparation(async () => { throw new DOMException('Cancelled', 'AbortError') })
        try { await expect(session.execute(resource)).rejects.toMatchObject({ name: 'AbortError' }) }
        finally { unsubscribe() }
        post.mockResolvedValueOnce(extractionResult())
        await session.execute(resource)
        expect(post).toHaveBeenCalledOnce(); expect(get).not.toHaveBeenCalled()
    })
})
