import type { LorebookExtractionResult, LorebookExtractionStatus } from '@/shared/types/lorebookExtraction.types'
import type { LlmRequest } from '@/shared/types/llm.types'

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exact = (value: Record<string, unknown>, fields: string[]) => Object.keys(value).length === fields.length && fields.every((key) => key in value)
const text = (value: unknown, max: number): value is string => typeof value === 'string' && !!value && value === value.trim() && value.length <= max
const list = (value: unknown, max: number): value is string[] => Array.isArray(value) && value.length <= max && value.every((item) => text(item, 120))
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export function verifyLorebookExtraction(value: unknown, resourceId: string, expectedHash: string, lorebookId: string | null): value is LorebookExtractionResult {
    if (!object(value) || !exact(value, ['resource_id', 'lorebook_id', 'extraction', 'llm_execution'])
        || value.resource_id !== resourceId || value.lorebook_id !== lorebookId
        || !/^[a-f0-9]{64}$/.test(expectedHash) || !object(value.extraction) || !object(value.llm_execution)) return false
    const extraction = value.extraction
    if (!exact(extraction, ['keywords', 'shortSummary', 'longSummary', 'notes', 'snippets', 'model', 'schemaVersion', 'sourceHash', 'updatedAt'])
        || !list(extraction.keywords, 40) || !list(extraction.notes, 24)
        || !text(extraction.shortSummary, 600) || !text(extraction.longSummary, 4000) || !text(extraction.model, 255)
        || extraction.schemaVersion !== 'mw-lorebook-resource-v1' || extraction.sourceHash !== expectedHash
        || !text(extraction.updatedAt, 64) || !Array.isArray(extraction.snippets) || extraction.snippets.length > 16) return false
    const ids = new Set<string>()
    for (const snippet of extraction.snippets) {
        if (!object(snippet) || !exact(snippet, ['id', 'title', 'content', 'triggers', 'source'])
            || !text(snippet.id, 160) || ids.has(snippet.id) || !text(snippet.title, 160)
            || !text(snippet.content, 2400) || !list(snippet.triggers, 16) || !text(snippet.source, 255)) return false
        ids.add(snippet.id)
    }
    const plan = value.llm_execution
    return exact(plan, ['execution_id', 'profile_id', 'revision_id', 'resolution_source', 'credential_mode', 'replayed'])
        && [plan.execution_id, plan.profile_id, plan.revision_id].every(uuid)
        && ['user_feature', 'user_default', 'system_feature', 'system_default', 'explicit'].includes(plan.resolution_source as string)
        && ['platform', 'user_byok'].includes(plan.credential_mode as string) && typeof plan.replayed === 'boolean'
}

export function verifyLorebookExtractionStatus(value: unknown, resourceId: string, expectedHash: string, requestId: string, lorebookId: string | null): value is LorebookExtractionStatus {
    if (!object(value) || value.request_id !== requestId) return false
    if (value.status === 'pending' || value.status === 'recovery_required') return exact(value, ['request_id', 'status'])
    return value.status === 'completed' && exact(value, ['request_id', 'status', 'result'])
        && verifyLorebookExtraction(value.result, resourceId, expectedHash, lorebookId) && value.result.llm_execution.replayed === true
}

export function matchesLorebookExtractionProfile(result: LorebookExtractionResult, llm: Pick<LlmRequest, 'selection' | 'expected_revision_id'>): boolean {
    return (llm.selection?.mode !== 'profile' || result.llm_execution.profile_id === llm.selection.profile_id)
        && (llm.expected_revision_id === undefined || result.llm_execution.revision_id === llm.expected_revision_id)
}

export function extractionContainsCredential(value: unknown, credential: string): boolean {
    if (typeof value === 'string') return value.includes(credential)
    if (Array.isArray(value)) return value.some((item) => extractionContainsCredential(item, credential))
    if (object(value)) return Object.values(value).some((item) => extractionContainsCredential(item, credential))
    return false
}
