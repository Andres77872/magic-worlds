import { ApiError, apiService } from '@/infrastructure/api'
import { authSession } from '@/infrastructure/api/authSession'
import { isLlmRequestSpent } from '@/infrastructure/api/llmIntent'
import { prepareLlmRequest } from '@/infrastructure/api/llmPreparation'
import { matchesLorebookExtractionProfile } from '@/infrastructure/api/lorebookExtractionContract'
import type { LorebookResource } from '@/shared'
import type { LlmRequest } from '@/shared/types/llm.types'
import type { LorebookExtractionResult } from '@/shared/types/lorebookExtraction.types'
import { makeRequestId } from '@/utils/uuid'

interface Receipt {
    resourceId: string; lorebookId: string | null; expectedHash: string; requestId: string
    selection: LlmRequest['selection']; expected_revision_id?: string
}

/** Receipts contain identity only. Retries read a prior request, never resubmit it. */
export function createLorebookExtractionSession() {
    const receipts = new Map<string, Receipt>()
    const active = new Map<string, Promise<LorebookExtractionResult>>()
    let closed = false
    let owner = authSession.getSnapshot()
    const unsubscribe = authSession.subscribe((next) => {
        if (!authSession.isCurrent(owner) || next.sessionPhase !== 'authenticated') {
            receipts.clear()
            active.clear()
        }
        owner = next
    })

    const execute = (resource: LorebookResource, llm: LlmRequest = {}, lorebookId: string | null = null): Promise<LorebookExtractionResult> => {
        if (closed || owner.sessionPhase !== 'authenticated') return Promise.reject(new ApiError(401, 'Sign in to extract metadata.'))
        const hash = resource.evaluationHash
        if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) return Promise.reject(new ApiError(422, 'Save the resource before extracting metadata.'))
        const key = JSON.stringify([lorebookId, resource.id])
        const existing = receipts.get(key)
        const running = active.get(key)
        if (running) return running
        const receipt = existing ?? {
            resourceId: resource.id, lorebookId, expectedHash: hash, requestId: makeRequestId('mw-lore-extract'),
            selection: llm.selection ? { ...llm.selection } : { mode: 'inherit' as const }, expected_revision_id: llm.expected_revision_id,
        }
        const initiating = authSession.getSnapshot()
        const requireOwner = () => {
            if (closed || !authSession.isCurrent(initiating) || authSession.getSnapshot().sessionPhase !== 'authenticated') {
                throw new ApiError(401, 'Authentication changed during extraction.', { code: 'auth_epoch_changed' })
            }
        }
        const operation = Promise.resolve().then(async () => {
            try {
                let result: LorebookExtractionResult
                if (existing) {
                    const status = await apiService.getLorebookResourceExtraction(receipt.resourceId, receipt.expectedHash, { requestId: receipt.requestId }, receipt.lorebookId)
                    requireOwner()
                    if (status.status === 'completed') result = status.result
                    else if (status.status === 'recovery_required') {
                        // Resume the same request against its frozen plan. A key is
                        // asked for only if the server needs one for that target.
                        result = await apiService.extractLorebookResource(receipt.resourceId, {
                            expected_evaluation_hash: receipt.expectedHash,
                            llm: { selection: receipt.selection, ...(receipt.expected_revision_id ? { expected_revision_id: receipt.expected_revision_id } : {}) },
                        }, { requestId: receipt.requestId }, receipt.lorebookId)
                        requireOwner()
                    } else throw new ApiError(409, 'Check the existing extraction request.', { code: `lorebook_extraction_${status.status}`, requestId: receipt.requestId })
                } else {
                    // Resolve the feature choice before admission, and retain public identity only.
                    // Cancelling credential entry must not create a phantom recovery receipt.
                    const prepared = await prepareLlmRequest('lorebook_extraction', llm)
                    try {
                        requireOwner()
                        receipt.selection = prepared.selection ? { ...prepared.selection } : { mode: 'inherit' }
                        receipt.expected_revision_id = prepared.expected_revision_id
                        receipts.set(key, receipt)
                        result = await apiService.extractLorebookResource(resource.id, { expected_evaluation_hash: hash, llm: prepared }, { requestId: receipt.requestId }, lorebookId)
                        requireOwner()
                    } finally { delete prepared.credentials }
                }
                if (!matchesLorebookExtractionProfile(result, receipt)) throw new ApiError(502, 'Invalid extraction profile.', { code: 'lorebook_extraction_contract' })
                receipts.delete(key)
                if (receipt.expectedHash !== hash) throw new ApiError(409, 'The source changed. Extract its saved revision.', { code: 'LOREBOOK_RESOURCE_SOURCE_CHANGED' })
                return result
            } catch (error) {
                requireOwner()
                // Definitive pre-admission failures may be corrected with a new request,
                // and a spent request ID can never finish: the next try starts fresh.
                if (!existing && error instanceof ApiError && [401, 403, 404, 422].includes(error.status)) receipts.delete(key)
                if (isLlmRequestSpent(error)) receipts.delete(key)
                throw error
            }
        }).finally(() => { if (active.get(key) === operation) active.delete(key) })
        active.set(key, operation)
        return operation
    }
    return {
        execute,
        close() { closed = true; receipts.clear(); active.clear(); unsubscribe() },
    }
}

export function applyLorebookExtraction(resource: LorebookResource, result: LorebookExtractionResult): LorebookResource {
    if (resource.id !== result.resource_id || resource.evaluationHash !== result.extraction.sourceHash) {
        throw new ApiError(409, 'The saved source changed during extraction.', { code: 'LOREBOOK_RESOURCE_SOURCE_CHANGED' })
    }
    return { ...resource, extraction: result.extraction, extractionStatus: 'completed', metadataOutdated: false, updatedAt: result.extraction.updatedAt }
}
