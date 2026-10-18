import type { StoryVariantCreate, StoryVariantDecision, StoryVariantIntent, StoryVariantOperation,
    StoryVariantPage, StoryVariantQuery, StoryVariantRecord, StoryVariantReference, StoryVariantSnapshot, StoryVariantSummary } from '@/shared/types/storyVariant.types'
import { isNovelRequestId, isNovelRevision, isRecord } from '@/shared/novelMutationJournal'
import { applyStoryAnchorEdits, isStoryAnchorEdits } from '@/shared/storyAnchorEdits'
import { documentSignature, documentText, isStoryDocument } from '@/shared/storyDocument'
import { canonicalJson } from '@/utils/json'
import { isNovelGenerationReference, verifyNovelRefinement } from './novelRefinementContract'
import { isStoryVariantReference } from './storyVariantIdentityContract'
export { isStoryVariantReference } from './storyVariantIdentityContract'

const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(key => key in v)
const scalar = (v: unknown, max: number): v is string => typeof v === 'string' && Array.from(v).length <= max
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v)
const id = (v: unknown): v is string => scalar(v, 64) && Boolean(v) && v === v.trim()
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const title = (v: unknown): v is string => scalar(v, 255) && Boolean(v) && v === v.trim() && !/[\r\n]/u.test(v)
const timestamp = (v: unknown): v is string => scalar(v, 64) && Number.isFinite(Date.parse(v))
const status = (v: unknown) => ['candidate', 'stashed', 'accepted', 'rejected'].includes(String(v))
const applied = (state: unknown, revision: unknown, base: number) => state === 'accepted'
    ? isNovelRevision(revision) && revision === base + 1 : revision === null

export function isStoryVariantOperation(v: unknown): v is StoryVariantOperation {
    return isRecord(v) && exact(v, ['id', 'type', 'sceneId', 'expectedRevision', 'expectedContentHash', 'document', 'anchorEdits'])
        && id(v.id) && v.type === 'replace_scene_snapshot' && id(v.sceneId) && isNovelRevision(v.expectedRevision)
        && hash(v.expectedContentHash) && isStoryDocument(v.document) && (v.anchorEdits === null || isStoryAnchorEdits(v.anchorEdits))
}
export function isStoryVariantIntent(v: unknown): v is StoryVariantIntent {
    return isRecord(v) && exact(v, ['id', 'title', 'parent', 'operation']) && id(v.id) && title(v.title)
        && isNovelGenerationReference(v.parent) && isStoryVariantOperation(v.operation)
        && new Set([v.id, v.parent.generationId, v.operation.id]).size === 3
}
export function isStoryVariantCreate(v: unknown): v is StoryVariantCreate {
    return isRecord(v) && exact(v, ['requestId', 'reviewedHash', 'intent']) && isNovelRequestId(v.requestId)
        && hash(v.reviewedHash) && isStoryVariantIntent(v.intent)
        && ![v.intent.id, v.intent.parent.generationId, v.intent.operation.id].includes(v.requestId)
}
export function isStoryVariantDecision(v: unknown): v is StoryVariantDecision {
    return isRecord(v) && exact(v, ['requestId', 'reference', 'expectedStatus', 'decision']) && isNovelRequestId(v.requestId)
        && isStoryVariantReference(v.reference) && v.requestId !== v.reference.id
        && ['candidate', 'stashed'].includes(String(v.expectedStatus)) && ['stash', 'reject'].includes(String(v.decision))
}
export function isStoryVariantQuery(v: unknown): v is StoryVariantQuery {
    return isRecord(v) && Object.keys(v).every(key => ['generationId', 'before', 'limit'].includes(key))
        && (v.generationId === undefined || id(v.generationId)) && (v.before === undefined || id(v.before))
        && (v.limit === undefined || Number.isSafeInteger(v.limit) && Number(v.limit) >= 1 && Number(v.limit) <= 20)
}
/** Digests are opaque server CAS references. Validate every visible binding;
 * SQL revalidates the full frozen digest and source policy before committing. */
export function verifyStoryVariantSnapshot(v: unknown, storyId: string, intent?: StoryVariantIntent): v is StoryVariantSnapshot {
    if (!isRecord(v) || !exact(v, ['schemaVersion', 'projection', 'authorship', 'storyId', 'id', 'title', 'parent', 'operation', 'baseDocument', 'documentHash', 'variantHash'])
        || v.schemaVersion !== 1 || v.projection !== 'generation_variant' || v.authorship !== 'author_edited' || v.storyId !== storyId || !id(storyId)
        || !id(v.id) || !title(v.title) || !verifyNovelRefinement(v.parent, storyId) || !isStoryVariantOperation(v.operation)
        || !isStoryDocument(v.baseDocument) || !hash(v.documentHash) || !hash(v.variantHash)) return false
    const p = v.parent.parent, op = v.operation
    if (new Set([v.id, p.id, op.id]).size !== 3 || p.sceneId !== op.sceneId || p.baseRevision !== op.expectedRevision
        || op.anchorEdits !== null && applyStoryAnchorEdits(documentText(v.baseDocument), op.anchorEdits) !== documentText(op.document)) return false
    return intent === undefined || isStoryVariantIntent(intent) && v.id === intent.id && v.title === intent.title
        && p.id === intent.parent.generationId && v.parent.parentHash === intent.parent.parentHash && canonicalJson(op) === canonicalJson(intent.operation)
}
export function verifyStoryVariantRecord(v: unknown, storyId: string, reference?: StoryVariantReference): v is StoryVariantRecord {
    return isRecord(v) && exact(v, ['schemaVersion', 'storyId', 'variant', 'status', 'appliedRevision', 'createdAt', 'updatedAt'])
        && v.schemaVersion === 1 && v.storyId === storyId && verifyStoryVariantSnapshot(v.variant, storyId) && status(v.status)
        && applied(v.status, v.appliedRevision, v.variant.operation.expectedRevision) && timestamp(v.createdAt) && timestamp(v.updatedAt)
        && (reference === undefined || isStoryVariantReference(reference) && v.variant.id === reference.id && v.variant.variantHash === reference.variantHash)
}
export function verifyStoryVariantCreation(v: unknown, storyId: string, write: StoryVariantCreate): v is StoryVariantRecord {
    return isStoryVariantCreate(write) && verifyStoryVariantRecord(v, storyId, { id: write.intent.id, variantHash: write.reviewedHash })
        && v.status === 'candidate' && verifyStoryVariantSnapshot(v.variant, storyId, write.intent)
}
export function verifyStoryVariantDecision(v: unknown, storyId: string, write: StoryVariantDecision): v is StoryVariantRecord {
    return isStoryVariantDecision(write) && verifyStoryVariantRecord(v, storyId, write.reference)
        && v.status === (write.decision === 'stash' ? 'stashed' : 'rejected')
}
function summary(v: unknown, storyId: string, generationId: string | null): v is StoryVariantSummary {
    return isRecord(v) && exact(v, ['id', 'storyId', 'sceneId', 'generationId', 'variantHash', 'title', 'baseRevision', 'status', 'appliedRevision', 'createdAt', 'updatedAt'])
        && id(v.id) && v.storyId === storyId && id(v.sceneId) && id(v.generationId) && v.id !== v.generationId
        && (generationId === null || v.generationId === generationId) && hash(v.variantHash) && title(v.title) && isNovelRevision(v.baseRevision)
        && status(v.status) && applied(v.status, v.appliedRevision, v.baseRevision) && timestamp(v.createdAt) && timestamp(v.updatedAt)
}
export function verifyStoryVariantPage(v: unknown, storyId: string, query: StoryVariantQuery = {}): v is StoryVariantPage {
    if (!isStoryVariantQuery(query) || !isRecord(v) || !exact(v, ['schemaVersion', 'storyId', 'generationId', 'before', 'items', 'nextBefore'])
        || v.schemaVersion !== 1 || v.storyId !== storyId || v.generationId !== (query.generationId ?? null) || v.before !== (query.before ?? null)
        || !Array.isArray(v.items) || v.items.length > (query.limit ?? 20) || !v.items.every(row => summary(row, storyId, query.generationId ?? null))
        || new Set(v.items.map(row => row.id)).size !== v.items.length || v.items.some(row => row.id === query.before)) return false
    return v.nextBefore === null || id(v.nextBefore) && v.items.length === (query.limit ?? 20) && v.nextBefore === v.items[v.items.length - 1]?.id
}
export function storyVariantReference(v: StoryVariantSnapshot): StoryVariantReference { return { id: v.id, variantHash: v.variantHash } }
export function matchesVariantDocument(v: StoryVariantSnapshot, document: unknown): boolean {
    return isStoryDocument(document) && documentSignature(document) === documentSignature(v.operation.document)
}
