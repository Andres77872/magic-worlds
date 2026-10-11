import type { LorebookExtractionResult } from '@/shared/types/lorebookExtraction.types'

export const EXTRACTION_HASH = 'a'.repeat(64)
export function extractionResult(overrides: Partial<LorebookExtractionResult> = {}): LorebookExtractionResult {
    return {
        resource_id: 'resource-1', lorebook_id: null,
        extraction: { keywords: ['court'], shortSummary: 'Court notes.', longSummary: 'The court keeps seals.', notes: [], snippets: [], model: 'writer', schemaVersion: 'mw-lorebook-resource-v1', sourceHash: EXTRACTION_HASH, updatedAt: '2026-10-09T00:00:00Z' },
        llm_execution: { execution_id: '11111111-1111-4111-8111-111111111111', profile_id: '22222222-2222-4222-8222-222222222222', revision_id: '33333333-3333-4333-8333-333333333333', resolution_source: 'system_default', credential_mode: 'platform', replayed: false },
        ...overrides,
    }
}
