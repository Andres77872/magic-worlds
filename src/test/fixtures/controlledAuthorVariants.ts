import type { StoryVariantCreate, StoryVariantRecord, StoryVariantSnapshot } from '@/shared'
import type { AuthorVariantSource } from '@/features/novel/hooks/useAuthorVariantSource'
import { documentSignature } from '@/shared/storyDocument'
import { canonicalJson } from '@/utils/json'
import { authorVariantFixture } from './authorVariants'

/** In-memory fictional transport for UI tests/stories; hashes are opaque test
 * references, not evidence for the server's cryptographic digest implementation. */
export function controlledAuthorVariants({ empty = false, changedSources = false } = {}) {
    const f = authorVariantFixture(), records = new Map<string, StoryVariantRecord>(), receipts = new Map<string, StoryVariantRecord>()
    const previews = new Map<string, StoryVariantSnapshot>(); let counter = 1, current = true
    if (!empty) records.set(f.record.variant.id, structuredClone(f.record))
    const check = (signal: AbortSignal) => { signal.throwIfAborted(); if (!current) throw new Error('Fictional owner retired') }
    const source: AuthorVariantSource = {
        key: 'fictional-author-variants', storyId: f.snapshot.storyId,
        scope: { userHash: 'fictional-version-author', workspaceId: 'fictional-writing-desk', storyId: f.snapshot.storyId }, isCurrent: () => current,
        context: async (_generationId, signal) => { check(signal); return structuredClone(f.context) },
        preview: async (intent, signal) => {
            check(signal); if (changedSources) throw new Error('The fictional saved sources changed')
            const value: StoryVariantSnapshot = { ...structuredClone(f.snapshot), id: intent.id, title: intent.title, operation: structuredClone(intent.operation),
                variantHash: (counter++).toString(16).padStart(64, '0'), documentHash: 'd'.repeat(64) }
            previews.set(value.variantHash, value); return structuredClone(value)
        },
        create: async (write: StoryVariantCreate, signal) => {
            check(signal); const prior = receipts.get(write.requestId); if (prior) return structuredClone(prior)
            const value = previews.get(write.reviewedHash)
            if (!value || value.id !== write.intent.id || canonicalJson(value.operation) !== canonicalJson(write.intent.operation)) throw new Error('Fictional review changed')
            const record: StoryVariantRecord = { schemaVersion: 1, storyId: f.snapshot.storyId, variant: structuredClone(value), status: 'candidate', appliedRevision: null,
                createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z' }
            records.set(value.id, record); receipts.set(write.requestId, structuredClone(record)); return structuredClone(record)
        },
        decide: async (write, signal) => {
            check(signal); const prior = receipts.get(write.requestId); if (prior) return structuredClone(prior)
            const record = records.get(write.reference.id)
            if (!record || record.variant.variantHash !== write.reference.variantHash || record.status !== write.expectedStatus) throw new Error('Fictional decision changed')
            record.status = write.decision === 'stash' ? 'stashed' : 'rejected'
            receipts.set(write.requestId, structuredClone(record)); return structuredClone(record)
        },
        result: async (write, signal) => { check(signal); return structuredClone(receipts.get(write.requestId) ?? null) },
        read: async (id, signal) => { check(signal); const record = records.get(id); if (!record) throw new Error('Fictional version unavailable'); return structuredClone(record) },
        page: async (query, signal) => {
            check(signal); const all = [...records.values()].sort((a, b) => b.variant.id.localeCompare(a.variant.id))
            const offset = query.before ? all.findIndex(row => row.variant.id === query.before) + 1 : 0, limit = query.limit ?? 20
            const rows = all.slice(offset, offset + limit), items = rows.map(row => ({ id: row.variant.id, storyId: row.storyId,
                sceneId: row.variant.operation.sceneId, generationId: row.variant.parent.parent.id, variantHash: row.variant.variantHash, title: row.variant.title,
                baseRevision: row.variant.operation.expectedRevision, status: row.status, appliedRevision: row.appliedRevision, createdAt: row.createdAt, updatedAt: row.updatedAt }))
            return { schemaVersion: 1, storyId: f.snapshot.storyId, generationId: query.generationId ?? null, before: query.before ?? null, items,
                nextBefore: offset + limit < all.length ? items[items.length - 1].id : null }
        },
        review: async (record, signal) => {
            check(signal); if (changedSources) throw new Error('The fictional saved sources changed')
            return { index: f.index, detail: f.detail, variant: structuredClone(record.variant), documentSignature: documentSignature(record.variant.baseDocument) }
        },
    }
    return { ...f, source, records, receipts, retire: () => { current = false } }
}
