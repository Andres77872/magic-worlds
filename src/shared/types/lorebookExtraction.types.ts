import type { LlmExecutionProvenance, LlmRequest } from './llm.types'

export interface LorebookExtractionCommand {
    expected_evaluation_hash: string
    llm: LlmRequest
}

export interface LorebookExtractionOptions {
    requestId: string
    signal?: AbortSignal
    timeoutMs?: number
}

export interface LorebookExtractionResult {
    resource_id: string
    lorebook_id: string | null
    extraction: {
        keywords: string[]
        shortSummary: string
        longSummary: string
        notes: string[]
        snippets: { id: string; title: string; content: string; triggers: string[]; source: string }[]
        model: string
        schemaVersion: 'mw-lorebook-resource-v1'
        sourceHash: string
        updatedAt: string
    }
    llm_execution: LlmExecutionProvenance
}

export type LorebookExtractionStatus =
    | { request_id: string; status: 'completed'; result: LorebookExtractionResult }
    | { request_id: string; status: 'pending' | 'recovery_required' }
