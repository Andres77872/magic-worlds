import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { StoryAnchorEdit, StoryManuscriptDocument, StoryVariantRecord, StoryVariantSnapshot } from '@/shared'
import { novelMutationKey, type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { documentSignature, documentText } from '@/shared/storyDocument'
import { canonicalJson } from '@/utils/json'
import { generateUUID, makeRequestId } from '@/utils/uuid'
import { ApiError } from '@/infrastructure/api'
import { isStoryVariantIntent, storyVariantReference, verifyStoryVariantCreation, verifyStoryVariantDecision, verifyStoryVariantRecord, verifyStoryVariantSnapshot } from '@/infrastructure/api/storyVariantContract'
import { AUTHOR_VARIANT_DOMAIN, authorVariantIntent, confirmedAuthorVariantRefusal, editAuthorVariantDraft, isAuthorVariantContext, isAuthorVariantDraft, listAuthorVariantDrafts, newAuthorVariantDraft, readAuthorVariantDraft, retireAuthorVariantDraft, writeAuthorVariantDraft,
    type AuthorVariantDraft, type AuthorVariantPending } from '../persistence/authorVariantJournal'
import type { AuthorVariantSource } from './useAuthorVariantSource'

type Work = 'load' | 'preview' | 'save' | 'recover' | 'read' | 'decision'
export type AuthorVariantError = 'load' | 'preview' | 'pending' | 'read' | 'storage' | 'changed' | 'readOnly' | null
function privateDraftFromRecord(record: StoryVariantRecord, isDefaultWorkspace?: boolean): AuthorVariantDraft {
    const v = record.variant, range = v.parent.parent.range
    const context = { parent: v.parent, baseDocument: v.baseDocument, baseContentHash: v.operation.expectedContentHash,
        inputRange: range ? { startOffset: range.startOffset, endOffset: range.endOffset, text: documentText(v.baseDocument).slice(range.startOffset, range.endOffset) } : null,
        chapterTitle: '', sceneTitle: '' }
    if (!isAuthorVariantContext(context, record.storyId)) throw new Error('Saved version context changed')
    return { ...newAuthorVariantDraft(context, isDefaultWorkspace), title: v.title, document: structuredClone(v.operation.document), anchorEdits: structuredClone(v.operation.anchorEdits),
        seeded: true, saved: { reference: storyVariantReference(v), sequence: 0 } }
}
export function useAuthorVariantDraft({ source, generationId, readOnly, startEditing = true, isDefaultWorkspace, recoveryRecord }: { source: AuthorVariantSource; generationId: string; readOnly: boolean; startEditing?: boolean; isDefaultWorkspace?: boolean; recoveryRecord?: NovelJournalRecord<AuthorVariantDraft> }) {
    const [writer] = useState(generateUUID)
    const key = novelMutationKey(AUTHOR_VARIANT_DOMAIN, source.scope, generationId, writer)
    const [draft, setDraft] = useState<AuthorVariantDraft | null>(null), currentDraft = useRef(draft)
    const [recoveries] = useState(() => listAuthorVariantDrafts(source.scope, generationId))
    const [recovery, setRecovery] = useState<NovelJournalRecord<AuthorVariantDraft> | null>(() => {
        const record = recoveryRecord ?? readAuthorVariantDraft(key)
        return key && record?.storageKey && record.storageKey.split('::writer:')[0] === key.split('::writer:')[0]
            && isAuthorVariantDraft(record.write) && record.write.storyId === source.storyId && record.write.context.parent.parent.id === generationId ? structuredClone(record) : null
    })
    const initialRecovery = useRef(recovery)
    const [working, setWorking] = useState<Work | null>(startEditing && !recovery ? 'load' : null), [error, setError] = useState<AuthorVariantError>(null)
    const [storageFailed, setStorageFailed] = useState(false), [savedLocally, setSavedLocally] = useState(false)
    const [preview, setPreview] = useState<{ sequence: number; value: StoryVariantSnapshot } | null>(null)
    const [record, setRecord] = useState<StoryVariantRecord | null>(null)
    const [editorEpoch, setEditorEpoch] = useState(0), [seedUnavailable, setSeedUnavailable] = useState(false)
    const live = useRef({ source, generationId, readOnly, key, isDefaultWorkspace }), mounted = useRef(true), serial = useRef(0)
    const job = useRef<AbortController | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    useLayoutEffect(() => { live.current = { source, generationId, readOnly, key, isDefaultWorkspace } })
    const validOwner = useCallback(() => mounted.current && source.isCurrent() && live.current.source.key === source.key && live.current.generationId === generationId, [source, generationId])
    const persist = useCallback((value: AuthorVariantDraft) => {
        const stored = writeAuthorVariantDraft(key, value)
        if (validOwner()) { setStorageFailed(!stored); setSavedLocally(stored) }
        return stored
    }, [key, validOwner])
    const commit = useCallback((value: AuthorVariantDraft, immediate = false) => {
        if (!validOwner()) return false
        currentDraft.current = value; setDraft(value); setSavedLocally(false)
        if (timer.current) clearTimeout(timer.current)
        if (immediate) return persist(value)
        timer.current = setTimeout(() => { if (validOwner() && currentDraft.current === value) persist(value) }, 150)
        return true
    }, [persist, validOwner])
    const run = useCallback(async (kind: Work, action: (signal: AbortSignal, current: () => boolean) => Promise<void>) => {
        if (!validOwner() || job.current) return false
        const controller = new AbortController(), ticket = ++serial.current
        job.current = controller; setWorking(kind); setError(null)
        const current = () => validOwner() && serial.current === ticket && !controller.signal.aborted
        try { await action(controller.signal, current); return current() }
        catch { if (current()) setError(currentDraft.current?.pending ? 'pending' : kind === 'load' ? 'load' : kind === 'preview' ? 'preview' : 'read'); return false }
        finally { if (job.current === controller) { job.current = null; if (validOwner()) setWorking(null) } }
    }, [validOwner])
    const loadFresh = useCallback(async () => run('load', async (signal, current) => {
        const context = await source.context(generationId, signal)
        if (!current()) return
        const value = newAuthorVariantDraft(context, live.current.isDefaultWorkspace)
        setRecovery(null); setPreview(null); setRecord(null); setSeedUnavailable(false)
        commit(value, true); setEditorEpoch(epoch => epoch + 1)
    }), [source, generationId, run, commit])
    useEffect(() => {
        mounted.current = true
        if (!initialRecovery.current && startEditing) {
            const controller = new AbortController(); job.current = controller
            const current = () => validOwner() && !controller.signal.aborted && job.current === controller
            void source.context(generationId, controller.signal).then(context => {
                if (current()) { commit(newAuthorVariantDraft(context, live.current.isDefaultWorkspace), true); setEditorEpoch(epoch => epoch + 1) }
            }).catch(() => { if (current()) setError('load') }).finally(() => {
                if (job.current === controller) { job.current = null; if (validOwner()) setWorking(null) }
            })
        }
        return () => {
            mounted.current = false; serial.current++; job.current?.abort(); job.current = null
            if (timer.current) clearTimeout(timer.current)
            if (currentDraft.current) writeAuthorVariantDraft(key, currentDraft.current)
        }
    }, [source, generationId, key, startEditing, validOwner, commit])
    useEffect(() => {
        const hidden = () => { if (document.visibilityState === 'hidden' && currentDraft.current) persist(currentDraft.current) }
        const unload = (event: BeforeUnloadEvent) => { if (currentDraft.current && !persist(currentDraft.current)) { event.preventDefault(); event.returnValue = '' } }
        document.addEventListener('visibilitychange', hidden); window.addEventListener('beforeunload', unload)
        return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('beforeunload', unload) }
    }, [persist])
    const edit = useCallback((patch: { title?: string; document?: StoryManuscriptDocument; anchorEdits?: StoryAnchorEdit[] | null }) => {
        const current = currentDraft.current
        if (!current || !validOwner() || live.current.readOnly) return
        const next = editAuthorVariantDraft(current, patch)
        if (!next) return
        setPreview(null); commit(next)
    }, [commit, validOwner])
    const seed = useCallback((document: StoryManuscriptDocument | null) => {
        const value = currentDraft.current
        if (!value || value.seeded || !validOwner() || live.current.readOnly) return
        const chosen = document ?? value.context.baseDocument
        const next = { ...value, seeded: true, document: structuredClone(chosen),
            anchorEdits: documentSignature(chosen) === documentSignature(value.context.baseDocument) ? [] : null }
        setSeedUnavailable(document === null); commit(next, true); setEditorEpoch(epoch => epoch + 1)
    }, [commit, validOwner])
    const resume = useCallback((selected = recovery) => {
        if (!selected || !validOwner() || currentDraft.current || selected.write.storyId !== source.storyId || selected.write.context.parent.parent.id !== generationId
            || !isAuthorVariantDraft(selected.write)) return false
        const value = structuredClone(selected.write)
        if (!commit(value, true)) return false
        if(selected.storageKey!==key)retireAuthorVariantDraft(selected)
        setRecovery(null); setEditorEpoch(epoch => epoch + 1)
        return true
    }, [recovery, validOwner, source.storyId, generationId, key, commit])
    const prepare = useCallback(async () => {
        const value = currentDraft.current
        if (!value || value.pending || !value.seeded || live.current.readOnly || !isStoryVariantIntent(authorVariantIntent(value))) return false
        const frozen = structuredClone(value)
        return run('preview', async (signal, current) => {
            const checked = await source.preview(authorVariantIntent(frozen), signal)
            if (!current() || currentDraft.current?.sequence !== frozen.sequence || currentDraft.current.variantId !== frozen.variantId) return
            if (!verifyStoryVariantSnapshot(checked, source.storyId, authorVariantIntent(frozen))
                || documentSignature(checked.baseDocument) !== documentSignature(frozen.context.baseDocument) || canonicalJson(checked.parent) !== canonicalJson(frozen.context.parent)) throw new Error('Review changed')
            setPreview({ sequence: frozen.sequence, value: checked })
        })
    }, [source, run])
    const recoverPending = useCallback(async (pending: AuthorVariantPending, signal: AbortSignal, current: () => boolean) => {
        let result = await source.result(pending.write, signal)
        if (!current()) return
        if (!result) {
            if (live.current.readOnly) { setError('readOnly'); return }
            if (pending.kind === 'decision') {
                const target = await source.read(pending.write.reference.id, signal)
                if (!current()) return
                if (!verifyStoryVariantRecord(target, source.storyId, pending.write.reference) || target.variant.parent.parent.id !== generationId) throw new Error('Decision source changed')
            }
            try { result = pending.kind==='decision'?await source.decide(pending.write, signal):await source.create(pending.write, signal) }
            catch(error){
                const reason=error instanceof ApiError?confirmedAuthorVariantRefusal(pending.kind,error):null,value=currentDraft.current
                if(!reason||!current()||!value||canonicalJson(value.pending)!==canonicalJson(pending))throw error
                if(value.refusal){
                    const retainedKey=novelMutationKey(AUTHOR_VARIANT_DOMAIN,source.scope,generationId,'refused:'+value.refusal.pending.write.requestId)
                    if(!writeAuthorVariantDraft(retainedKey,{...value,pending:null})){setError('storage');return}
                }
                const next={...value,pending:null,refusal:{reason,pending:structuredClone(pending)},variantId:generateUUID(),operationId:generateUUID()}
                if(!commit(next,true)){currentDraft.current=value;setDraft(value);setError('storage');return}
                setPreview(null);setError('changed');return
            }
        }
        if (!current()) return
        const checked = pending.kind === 'create' ? verifyStoryVariantCreation(result, source.storyId, pending.write) : verifyStoryVariantDecision(result, source.storyId, pending.write)
        const value = currentDraft.current
        if (!checked || !value || canonicalJson(value.pending) !== canonicalJson(pending)) throw new Error('Receipt changed')
        const saved = pending.kind === 'create' ? { reference: storyVariantReference(result.variant), sequence: pending.sequence } : value.saved
        const next = { ...value, pending: null, saved }
        // Preserve a confirmed receipt locally before clearing the visible pending state.
        if (!commit(next, true)) { currentDraft.current = value; setDraft(value); setError('storage'); return }
        setPreview(null); setRecord(null)
        const fresh = await source.read(result.variant.id, signal)
        if (current() && verifyStoryVariantRecord(fresh, source.storyId, storyVariantReference(result.variant))) setRecord(fresh)
    }, [source, generationId, commit])
    const save = useCallback(async () => {
        const value = currentDraft.current
        if (!value || value.pending || live.current.readOnly || !preview || preview.sequence !== value.sequence
            || !verifyStoryVariantSnapshot(preview.value, source.storyId, authorVariantIntent(value))) return false
        const pending: AuthorVariantPending = { kind: 'create', sequence: value.sequence,
            write: { requestId: makeRequestId('author-version'), reviewedHash: preview.value.variantHash, intent: authorVariantIntent(value) } }
        if (!commit({ ...value, pending }, true)) { setError('storage'); return false }
        return run('save', (signal, current) => recoverPending(pending, signal, current))
    }, [preview, source, commit, run, recoverPending])
    const recover = useCallback(async () => {
        const value = currentDraft.current
        if (!value?.pending || !persist(value)) { if (value?.pending) setError('storage'); return false }
        const pending = structuredClone(value.pending)
        return run('recover', (signal, current) => recoverPending(pending, signal, current))
    }, [persist, run, recoverPending])
    const read = useCallback(async (id: string) => run('read', async (signal, current) => {
        const saved = await source.read(id, signal)
        if (current()) {
            if (!verifyStoryVariantRecord(saved, source.storyId) || saved.variant.parent.parent.id !== generationId) throw new Error('Foreign version')
            setRecord(saved)
        }
    }), [run, source, generationId])
    const decide = useCallback(async (decision: 'stash' | 'reject') => {
        const value = currentDraft.current, selected = record
        if (value?.pending || !selected || live.current.readOnly) return false
        return run('decision', async (signal, current) => {
            const fresh = await source.read(selected.variant.id, signal)
            if (!current()) return
            if (!verifyStoryVariantRecord(fresh, source.storyId, storyVariantReference(selected.variant)) || fresh.variant.parent.parent.id !== generationId) throw new Error('Decision changed')
            setRecord(fresh)
            if(!['candidate','stashed'].includes(fresh.status)){setError('changed');return}
            const pending: AuthorVariantPending = { kind: 'decision', generationId, write: { requestId: makeRequestId('author-decision'),
                reference: storyVariantReference(fresh.variant), expectedStatus: fresh.status as 'candidate' | 'stashed', decision } }
            const latest = currentDraft.current ?? privateDraftFromRecord(fresh, live.current.isDefaultWorkspace)
            if (!commit({ ...latest, pending }, true)) { setError('storage'); return }
            await recoverPending(pending, signal, current)
        })
    }, [record, run, source, generationId, commit, recoverPending])
    const preserve = useCallback(() => !currentDraft.current || persist(currentDraft.current), [persist])
    const editSaved = useCallback(() => {
        const value = currentDraft.current ?? (record ? privateDraftFromRecord(record, live.current.isDefaultWorkspace) : null), saved = record?.variant
        if (!value || !saved || !validOwner() || live.current.readOnly || canonicalJson(saved.parent) !== canonicalJson(value.context.parent)
            || documentSignature(saved.baseDocument) !== documentSignature(value.context.baseDocument)) return false
        setPreview(null)
        commit({ ...value, title: saved.title, document: structuredClone(saved.operation.document), anchorEdits: structuredClone(saved.operation.anchorEdits),
            seeded: true, sequence: value.sequence + 1, variantId: generateUUID(), operationId: generateUUID() }, true)
        setEditorEpoch(epoch => epoch + 1)
        return true
    }, [record, validOwner, commit])
    return { draft, recovery, recoveries, working, error, storageFailed, savedLocally, preview: preview && preview.sequence === draft?.sequence ? preview.value : null,
        record, editorEpoch, seedUnavailable, edit, seed, resume, loadFresh, prepare, save, recover, read, decide, preserve, editSaved,
        canPrepare: Boolean(draft?.seeded && !draft.pending && isStoryVariantIntent(authorVariantIntent(draft))),
        isCurrentSaved: Boolean(draft?.saved && draft.saved.sequence === draft.sequence),
        isValid: draft === null || isAuthorVariantDraft(draft) }
}
