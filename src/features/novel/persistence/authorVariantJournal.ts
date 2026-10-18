import type { StoryAnchorEdit, StoryManuscriptDocument, StorySelection, StoryVariantCreate, StoryVariantDecision, StoryVariantIntent, StoryVariantReference } from '@/shared'
import type { NovelRefinementContext } from '@/shared/types/storyAssistant.types'
import { isNovelRequestId, isRecord, listNovelMutations, readNovelMutation, retireNovelMutation, scopedNovelMutationKey, writeNovelMutation, type NovelJournalRecord, type NovelJournalScope } from '@/shared/novelMutationJournal'
import type { AccountStorageScope, WorkspaceStorageScope } from '@/shared/workspaceStorage'
import { documentSignature, documentText, isStoryDocument } from '@/shared/storyDocument'
import { applyStoryAnchorEdits, isStoryAnchorEdits } from '@/shared/storyAnchorEdits'
import { verifyNovelRefinement } from '@/infrastructure/api/novelRefinementContract'
import { isStoryVariantCreate, isStoryVariantDecision, isStoryVariantReference } from '@/infrastructure/api/storyVariantContract'
import { generateUUID } from '@/utils/uuid'
import { canonicalJson } from '@/utils/json'

export const AUTHOR_VARIANT_DOMAIN = 'author-variant'
// Two complete scene documents plus a frozen in-flight operation, never media.
export const AUTHOR_VARIANT_MAX_RECORD = 8_300_000
export interface AuthorVariantContext {
    parent: NovelRefinementContext
    baseDocument: StoryManuscriptDocument
    baseContentHash: string
    inputRange: StorySelection | null
    chapterTitle: string
    sceneTitle: string
}
export type AuthorVariantPending = { kind: 'create'; sequence: number; write: StoryVariantCreate }
    | { kind: 'decision'; generationId: string; write: StoryVariantDecision }
export interface AuthorVariantDraft {
    isDefaultWorkspace?: boolean
    refusal?: { reason: 'sources_changed' | 'candidate_changed' | 'unavailable'; pending: AuthorVariantPending }
    storyId: string
    id: string
    sequence: number
    variantId: string
    operationId: string
    title: string
    context: AuthorVariantContext
    document: StoryManuscriptDocument
    anchorEdits: StoryAnchorEdit[] | null
    seeded: boolean
    pending: AuthorVariantPending | null
    saved: { reference: StoryVariantReference; sequence: number } | null
}
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(key => key in v)
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const text = (v: unknown, max: number): v is string => typeof v === 'string' && Array.from(v).length <= max
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v)
const sequence = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0
export function isAuthorVariantContext(v: unknown, storyId: string): v is AuthorVariantContext {
    if (!isRecord(v) || !exact(v, ['parent', 'baseDocument', 'baseContentHash', 'inputRange', 'chapterTitle', 'sceneTitle'])
        || !verifyNovelRefinement(v.parent, storyId) || !isStoryDocument(v.baseDocument) || !hash(v.baseContentHash)
        || !text(v.chapterTitle, 255) || !text(v.sceneTitle, 255)) return false
    const range = v.inputRange, original = v.parent.parent.range
    if (range === null) return original === null
    if (!original || !isRecord(range) || !exact(range, ['startOffset', 'endOffset', 'text']) || !text(range.text, 2_000_000)
        || range.startOffset !== original.startOffset || range.endOffset !== original.endOffset) return false
    const plain = documentText(v.baseDocument)
    return original.endOffset <= plain.length && plain.slice(original.startOffset, original.endOffset) === range.text
}
export function authorVariantIntent(draft: AuthorVariantDraft): StoryVariantIntent {
    return { id: draft.variantId, title: draft.title.trim(), parent: { generationId: draft.context.parent.parent.id, parentHash: draft.context.parent.parentHash },
        operation: { id: draft.operationId, type: 'replace_scene_snapshot', sceneId: draft.context.parent.parent.sceneId,
            expectedRevision: draft.context.parent.parent.baseRevision, expectedContentHash: draft.context.baseContentHash,
            document: structuredClone(draft.document), anchorEdits: structuredClone(draft.anchorEdits) } }
}
export function newAuthorVariantDraft(context: AuthorVariantContext, isDefaultWorkspace?: boolean): AuthorVariantDraft {
    return { storyId: context.parent.parent.storyId, id: generateUUID(), sequence: 0, variantId: generateUUID(), operationId: generateUUID(), title: '',
        context: structuredClone(context), document: structuredClone(context.baseDocument), anchorEdits: [], seeded: false, pending: null, saved: null,
        ...(isDefaultWorkspace === undefined ? {} : { isDefaultWorkspace }) }
}
export function isAuthorVariantDraft(v: unknown): v is AuthorVariantDraft {
    if (!isRecord(v) || !exact(v, ['storyId', 'id', 'sequence', 'variantId', 'operationId', 'title', 'context', 'document', 'anchorEdits', 'seeded', 'pending', 'saved', ...('refusal'in v?['refusal']:[]), ...('isDefaultWorkspace'in v?['isDefaultWorkspace']:[])])
        || typeof v.storyId !== 'string' || !isNovelRequestId(v.id) || !sequence(v.sequence) || !isNovelRequestId(v.variantId) || !isNovelRequestId(v.operationId)
        || String(v.variantId).length > 64 || String(v.operationId).length > 64 || !text(v.title, 1024) || /[\r\n]/u.test(v.title)
        || !isAuthorVariantContext(v.context, v.storyId) || !isStoryDocument(v.document) || typeof v.seeded !== 'boolean'
        || 'isDefaultWorkspace' in v && typeof v.isDefaultWorkspace !== 'boolean') return false
    const parent = v.context.parent.parent, plain = documentText(v.context.baseDocument)
    if (new Set([v.id, v.variantId, v.operationId, parent.id]).size !== 4
        || v.anchorEdits !== null && (!isStoryAnchorEdits(v.anchorEdits) || applyStoryAnchorEdits(plain, v.anchorEdits) !== documentText(v.document))) return false
    if (v.saved !== null && (!isRecord(v.saved) || !exact(v.saved, ['reference', 'sequence']) || !isStoryVariantReference(v.saved.reference)
        || !sequence(v.saved.sequence) || v.saved.sequence > v.sequence || v.saved.reference.id === parent.id)) return false
    const context=v.context,draftSequence=v.sequence,draftId=v.id,currentIntent=authorVariantIntent(v as unknown as AuthorVariantDraft)
    function validPending(pending:unknown,current:boolean):boolean {
        if(pending===null)return true
        if (!isRecord(pending)) return false
        if (pending.kind === 'decision') return exact(pending, ['kind', 'generationId', 'write']) && pending.generationId === parent.id
            && isStoryVariantDecision(pending.write) && pending.write.reference.id !== parent.id
        if (pending.kind !== 'create' || !exact(pending, ['kind', 'sequence', 'write']) || !sequence(pending.sequence) || pending.sequence>draftSequence || !isStoryVariantCreate(pending.write)) return false
        const intent = pending.write.intent, op = intent.operation
        return intent.parent.generationId === parent.id && intent.parent.parentHash === context.parent.parentHash
            && op.sceneId === parent.sceneId && op.expectedRevision === parent.baseRevision && op.expectedContentHash === context.baseContentHash
            && ![draftId, parent.id].includes(pending.write.requestId)
            && (op.anchorEdits === null || applyStoryAnchorEdits(plain, op.anchorEdits) === documentText(op.document))
            && (!current || pending.sequence !== draftSequence || canonicalJson(intent) === canonicalJson(currentIntent))
    }
    return validPending(v.pending,true)&&(!('refusal'in v)||isRecord(v.refusal)&&exact(v.refusal,['reason','pending'])
        &&['sources_changed','candidate_changed','unavailable'].includes(String(v.refusal.reason))&&v.refusal.pending!==null&&validPending(v.refusal.pending,false))
}
export function readAuthorVariantDraft(key: string | null): NovelJournalRecord<AuthorVariantDraft> | null {
    return readNovelMutation(key, isAuthorVariantDraft, AUTHOR_VARIANT_MAX_RECORD)
}
export function writeAuthorVariantDraft(key: string | null, draft: AuthorVariantDraft): boolean {
    const written = isAuthorVariantDraft(draft) && writeNovelMutation(key, draft, AUTHOR_VARIANT_MAX_RECORD)
    if (written) notifyAuthorVariantDrafts()
    return written
}
export function retireAuthorVariantDraft(record: NovelJournalRecord<AuthorVariantDraft>): void {
    retireNovelMutation(record, null)
    notifyAuthorVariantDrafts()
}
const CHANGE_EVENT = 'novel:author-variant-drafts'
function notifyAuthorVariantDrafts() {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
}
export function subscribeAuthorVariantDrafts(refresh: () => void): () => void {
    const stored = (event: StorageEvent) => { if (event.key === null || event.key.startsWith(`magic-worlds:novel-${AUTHOR_VARIANT_DOMAIN}:v1:`)) refresh() }
    window.addEventListener(CHANGE_EVENT, refresh); window.addEventListener('storage', stored)
    return () => { window.removeEventListener(CHANGE_EVENT, refresh); window.removeEventListener('storage', stored) }
}

export interface RetainedAuthorVariant { scope: WorkspaceStorageScope; record: NovelJournalRecord<AuthorVariantDraft> }
export interface RetainedAuthorVariants { items: RetainedAuthorVariant[]; unreadableKeys: string[]; unavailable: boolean }
function retainedKeyScope(key: string, account: AccountStorageScope): WorkspaceStorageScope | null {
    const parts = key.split('::'), prefix = `magic-worlds:novel-${AUTHOR_VARIANT_DOMAIN}:v1:`
    if (!key.startsWith(prefix) || parts.length !== 5 || parts[1] !== encodeURIComponent(account.apiOrigin)
        || parts[2] !== encodeURIComponent(account.userHash) || !parts[3] || !parts[4].startsWith('writer:')) return null
    try {
        const ids = parts[0].slice(prefix.length).split(':'), workspaceId = decodeURIComponent(parts[3]), writer = decodeURIComponent(parts[4].slice(7))
        if (ids.length !== 2 || !workspaceId || !writer || writer.length > 256) return null
        const storyId = decodeURIComponent(ids[0]), generationId = decodeURIComponent(ids[1]), scope = { ...account, workspaceId }
        if (!storyId || !generationId || scopedNovelMutationKey(AUTHOR_VARIANT_DOMAIN, { ...scope, storyId }, generationId, writer) !== key) return null
        return scope
    } catch { return null }
}
export function retainedAuthorVariantTarget(key: string, account: AccountStorageScope): { scope: WorkspaceStorageScope; storyId: string; generationId: string } | null {
    const scope = retainedKeyScope(key, account)
    if (!scope) return null
    const prefix = `magic-worlds:novel-${AUTHOR_VARIANT_DOMAIN}:v1:`, ids = key.split('::')[0].slice(prefix.length).split(':')
    return { scope, storyId: decodeURIComponent(ids[0]), generationId: decodeURIComponent(ids[1]) }
}
/** Exact lookup only: a missing selected writer must not substitute a neighbour. */
export function readRetainedAuthorVariant(key: string, account: AccountStorageScope): RetainedAuthorVariant | null {
    const scope = retainedKeyScope(key, account)
    if (!scope) return null
    try {
        const raw = localStorage.getItem(key)
        if (!raw || raw.length > AUTHOR_VARIANT_MAX_RECORD) return null
        const value: unknown = JSON.parse(raw)
        if (!isRecord(value) || !exact(value, ['schema', 'write', 'writtenAt']) || value.schema !== 1 || typeof value.writtenAt !== 'number'
            || !Number.isFinite(value.writtenAt) || !isAuthorVariantDraft(value.write)) return null
        const expected = scopedNovelMutationKey(AUTHOR_VARIANT_DOMAIN, { ...scope, storyId: value.write.storyId }, value.write.context.parent.parent.id, key.split('::writer:')[1] ? decodeURIComponent(key.split('::writer:')[1]) : '')
        if (expected !== key) return null
        return { scope, record: { schema: 1, write: value.write, writtenAt: value.writtenAt, storageKey: key } }
    } catch { return null }
}
/** No cache/remote manuscript is needed to discover this account's private writers. */
export function listRetainedAuthorVariants(account: AccountStorageScope): RetainedAuthorVariants {
    const result: RetainedAuthorVariants = { items: [], unreadableKeys: [], unavailable: false }
    try {
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index)
            if (!key || !retainedKeyScope(key, account)) continue
            const value = readRetainedAuthorVariant(key, account)
            if (value) result.items.push(value)
            else result.unreadableKeys.push(key)
        }
        result.items.sort((a, b) => (b.record.writtenAt ?? 0) - (a.record.writtenAt ?? 0) || a.record.storageKey!.localeCompare(b.record.storageKey!))
    } catch { result.unavailable = true }
    return result
}
/** Invalid matching records stay downloadable as bytes, without granting request authority. */
export function readRetainedAuthorVariantRaw(key: string, account: AccountStorageScope): string | null {
    if (!retainedKeyScope(key, account)) return null
    try { return localStorage.getItem(key) } catch { return null }
}
export function hasPrivateAuthorVariant(draft: AuthorVariantDraft): boolean {
    return draft.seeded || draft.sequence > 0 || Boolean(draft.title || draft.pending || draft.refusal)
}

export function editAuthorVariantDraft(current: AuthorVariantDraft, patch: { title?: string; document?: StoryManuscriptDocument; anchorEdits?: StoryAnchorEdit[] | null }): AuthorVariantDraft | null {
    if (patch.document && !isStoryDocument(patch.document)) return null
    if ((patch.title === undefined || patch.title === current.title) && (!patch.document || documentSignature(patch.document) === documentSignature(current.document))) return null
    let anchorEdits = current.anchorEdits
    if (patch.document) {
        const combined = anchorEdits && patch.anchorEdits ? [...anchorEdits, ...patch.anchorEdits] : null
        anchorEdits = combined && applyStoryAnchorEdits(documentText(current.context.baseDocument), combined) === documentText(patch.document) ? combined : null
    }
    const value = { ...current, ...(patch.title === undefined ? {} : { title: patch.title }), ...(patch.document ? { document: structuredClone(patch.document) } : {}),
        anchorEdits, sequence: current.sequence + 1, variantId: generateUUID(), operationId: generateUUID() }
    return isAuthorVariantDraft(value) ? value : null
}
export function listAuthorVariantDrafts(scope: NovelJournalScope, generationId: string): NovelJournalRecord<AuthorVariantDraft>[] {
    return listNovelMutations(AUTHOR_VARIANT_DOMAIN, scope, isAuthorVariantDraft,
        value => ({ storyId: value.storyId, target: value.context.parent.parent.id }), AUTHOR_VARIANT_MAX_RECORD)
        .filter(record => record.write.storyId === scope.storyId && record.write.context.parent.parent.id === generationId)
}
export function sameAuthorVariantContent(a: AuthorVariantDraft, b: AuthorVariantDraft): boolean {
    return a.title === b.title && documentSignature(a.document) === documentSignature(b.document) && canonicalJson(a.anchorEdits) === canonicalJson(b.anchorEdits)
}
/** Only domain errors emitted after the mutation's exact-receipt lookup prove
 * refusal. Transport, auth, route, DTO and corrupt-record errors stay uncertain. */
export function confirmedAuthorVariantRefusal(kind:AuthorVariantPending['kind'],error:{status:number;code?:string;message?:string}):NonNullable<AuthorVariantDraft['refusal']>['reason']|null {
    const common:Record<string,NonNullable<AuthorVariantDraft['refusal']>['reason']>={STORY_VARIANT_REVIEW_CHANGED:'candidate_changed',STORY_VARIANT_TARGET_UNAVAILABLE:'unavailable'}
    const creating:Record<string,NonNullable<AuthorVariantDraft['refusal']>['reason']>={STORY_VARIANT_ID_REUSED:'candidate_changed',STORY_VARIANT_TARGET_CHANGED:'sources_changed',
        STORY_VARIANT_BASE_UNAVAILABLE:'unavailable',STORY_VARIANT_BASE_CHANGED:'sources_changed',STORY_VARIANT_PARENT_CHANGED:'candidate_changed',
        NOVEL_REFINEMENT_PARENT_CHANGED:'candidate_changed',NOVEL_REFINEMENT_PARENT_UNAVAILABLE:'unavailable',STORY_ASSISTANT_SOURCE_CHANGED:'sources_changed'}
    const code=error.code??error.message??'',reason=common[code]??(kind==='create'?creating[code]:code==='STORY_VARIANT_DECISION_CHANGED'?'candidate_changed':null)
    if(reason&&error.status===409)return reason
    return error.status===404&&(kind==='create'?code==='NOVEL_REFINEMENT_PARENT_NOT_FOUND':code==='STORY_VARIANT_NOT_FOUND')?'unavailable':null
}
