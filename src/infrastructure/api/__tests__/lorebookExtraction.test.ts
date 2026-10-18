import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))
import { ApiError, apiService } from '../index'
import { authSession } from '../authSession'
import { verifyLorebookExtraction } from '../lorebookExtractionContract'
import { EXTRACTION_HASH as HASH, extractionResult } from './fixtures/lorebookExtraction'

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const command = { expected_evaluation_hash: HASH, llm: { selection: { mode: 'inherit' as const } } }
const replay = () => { const value = extractionResult(); value.llm_execution.replayed = true; return value }

describe('profile extraction transport', () => {
    it('displays completed metadata without rejecting or truncating long notes and summaries', async () => {
        const result = extractionResult()
        result.extraction.notes = ['Full archive fact. '.repeat(200).trim()]
        result.extraction.longSummary = 'Full archive summary. '.repeat(300).trim()
        fetchMock.mockResolvedValueOnce(json(result))
        await expect(apiService.extractLorebookResource('resource-1', command, {requestId:'long-notes'})).resolves.toEqual(result)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    it('preserves a disabled-server rejection without checking a nonexistent request', async () => {
        fetchMock.mockResolvedValueOnce(json({ detail: { code: 'LOREBOOK_EXTRACTION_DISABLED' } },503))
        await expect(apiService.extractLorebookResource('resource-1',command,{requestId:'disabled-request'}))
            .rejects.toMatchObject({status:503,code:'LOREBOOK_EXTRACTION_DISABLED'})
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    beforeEach(() => {
        vi.clearAllMocks()
        setTestFeatureFlags({ lorebooks: true })
        setTestFeatureFlags({ lorebookResources: true })
        localStorage.clear()
        authSession.authenticate('alice', 'token'); grantFixtureFeatures(true)
        vi.stubGlobal('fetch', fetchMock)
    })
    afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); authSession.continueSignedOut() })

    it('reconciles a lost POST with one GET and never sends a second inference', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('Network lost'))
        fetchMock.mockResolvedValueOnce(json({ request_id: 'request-1', status: 'completed', result: replay() }))
        expect(await apiService.extractLorebookResource('resource-1', command, { requestId: 'request-1' })).toEqual(replay())
        expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(['POST', 'GET'])
        expect(fetchMock.mock.calls[1][0]).toContain('/metadata-extractions/request-1')
    })

    it.each(['pending', 'recovery_required'] as const)('retains the exact request when GET reports %s', async (status) => {
        fetchMock.mockRejectedValueOnce(new TypeError('Network lost'))
        fetchMock.mockResolvedValueOnce(json({ request_id: 'request-1', status }))
        await expect(apiService.extractLorebookResource('resource-1', command, { requestId: 'request-1' })).rejects.toMatchObject({ code: `lorebook_extraction_${status}`, requestId: 'request-1' })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('fails safely for unknown delivery and missing saved request', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('Network lost'))
        fetchMock.mockResolvedValueOnce(json({ detail: { code: 'LOREBOOK_EXTRACTION_NOT_FOUND' } }, 404))
        await expect(apiService.extractLorebookResource('resource-1', command, { requestId: 'request-1' })).rejects.toMatchObject({ code: 'lorebook_extraction_unknown', requestId: 'request-1', retryable: false })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('does not reconcile under a different account', async () => {
        fetchMock.mockImplementationOnce(async () => { authSession.authenticate('bob', 'bob-token'); throw new TypeError('Network lost') })
        await expect(apiService.extractLorebookResource('resource-1', command, { requestId: 'request-1' })).rejects.toMatchObject({ code: 'auth_epoch_changed' })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('preserves ownership across token rotation while reading a lost result', async () => {
        fetchMock.mockImplementationOnce(async () => { authSession.rotateToken('rotated'); throw new TypeError('Network lost') })
        fetchMock.mockResolvedValueOnce(json({ request_id: 'request-1', status: 'completed', result: replay() }))
        await expect(apiService.extractLorebookResource('resource-1', command, { requestId: 'request-1' })).resolves.toEqual(replay())
        expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer rotated')
    })

    it('keeps transient credentials only in POST and never in GET', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('Network lost'))
        const result = replay(); result.llm_execution.credential_mode = 'user_byok'
        fetchMock.mockResolvedValueOnce(json({ request_id: 'request-1', status: 'completed', result }))
        await apiService.extractLorebookResource('resource-1', { ...command, llm: { ...command.llm, credentials: { api_key: 'FAKE_KEY_CANARY' } } }, { requestId: 'request-1' })
        expect(JSON.stringify(fetchMock.mock.calls[1])).not.toContain('FAKE_KEY_CANARY')
        expect(fetchMock.mock.calls[1][1].body).toBeUndefined()
    })

    it.each(['profile', 'revision', 'key', 'escaped_key'])('rejects a completed %s mismatch after reconciliation', async (failure) => {
        const result = replay(); result.llm_execution.credential_mode = 'user_byok'
        const llm = { selection: { mode: 'profile' as const, profile_id: result.llm_execution.profile_id }, expected_revision_id: result.llm_execution.revision_id, credentials: { api_key: 'FAKE_KEY_CANARY' } }
        if (failure === 'profile') result.llm_execution.profile_id = '44444444-4444-4444-8444-444444444444'
        if (failure === 'revision') result.llm_execution.revision_id = '44444444-4444-4444-8444-444444444444'
        if (failure === 'key') result.extraction.shortSummary = llm.credentials.api_key
        if (failure === 'escaped_key') {
            llm.credentials.api_key = 'FAKE_"KEY\\_CANARY'
            result.extraction.shortSummary = llm.credentials.api_key
        }
        fetchMock.mockResolvedValueOnce(json(result))
        fetchMock.mockResolvedValueOnce(json({ request_id: 'request-1', status: 'completed', result }))
        await expect(apiService.extractLorebookResource('resource-1', { ...command, llm }, { requestId: 'request-1' })).rejects.toMatchObject({ code: 'lorebook_extraction_contract' })
        expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(['POST', 'GET'])
    })

    it('rejects another resource, source, book or request instead of displaying its result', async () => {
        fetchMock.mockResolvedValueOnce(json({ request_id: 'other', status: 'completed', result: replay() }))
        await expect(apiService.getLorebookResourceExtraction('resource-1', HASH, { requestId: 'request-1' })).rejects.toBeInstanceOf(ApiError)
        for (const override of [{ resource_id: 'other' }, { lorebook_id: 'other' }, { extraction: { ...extractionResult().extraction, sourceHash: 'b'.repeat(64) } }]) {
            expect(verifyLorebookExtraction(extractionResult(override), 'resource-1', HASH, null)).toBe(false)
        }
    })

    it('rejects extra credential fields, malformed plan and incomplete extraction', () => {
        const value = extractionResult()
        expect(verifyLorebookExtraction(value, 'resource-1', HASH, null)).toBe(true)
        expect(verifyLorebookExtraction({ ...value, credentials: { api_key: 'FAKE' } }, 'resource-1', HASH, null)).toBe(false)
        expect(verifyLorebookExtraction({ ...value, extraction: { ...value.extraction, notes: null } }, 'resource-1', HASH, null)).toBe(false)
        expect(verifyLorebookExtraction({ ...value, llm_execution: { ...value.llm_execution, revision_id: '' } }, 'resource-1', HASH, null)).toBe(false)
    })

    it('stops before sending an aborted or invalid request', async () => {
        const controller = new AbortController(); controller.abort()
        await expect(apiService.extractLorebookResource('resource-1', command, { requestId: 'request-1', signal: controller.signal })).rejects.toThrow()
        await expect(apiService.extractLorebookResource('resource-1', command, { requestId: '' })).rejects.toMatchObject({ status: 422 })
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
