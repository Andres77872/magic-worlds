/** One save queue per document. Late acknowledgements own only their snapshot. */
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth, useData } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import type { StorySceneDocument, StorySceneWrite, StoryManuscriptDocument,StoryAnchorEdit } from '@/shared'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import { dateFromApiTimestamp } from '@/utils/time'
import { generateUUID,makeRequestId } from '@/utils/uuid'
import { draftJournalKey, readCheckpoint, retireRecovery, writeCheckpoint, type DraftCheckpoint } from '../persistence/draftJournal'
import { documentMarkdown, documentSignature,documentText,isStoryDocument } from '@/shared/storyDocument'
import { applyStoryAnchorEdits } from '@/shared/storyAnchorEdits'
import type { NovelSaveState } from '../utils/novelUtils'
import type { StoryWorkspace } from './useStoryWorkspace'
import { browserCanConnect, useBrowserConnectivity } from './useBrowserConnectivity'
import { readRetainedSceneDrafts, retainSceneDraft, retainedSceneDraftPrefix, type RetainedSceneDraft } from '../persistence/retainedSceneDrafts'
import { canonicalJson } from '@/utils/json'
import type { WorkspaceStorageScope } from '@/shared/workspaceStorage'
import { apiStorageOrigin } from '@/shared/workspaceStorage'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import {confirmedGenerationApplicationRejection,type GenerationApplicationRejection} from '../persistence/generationApplication'
import type { StoryVariantSnapshot } from '@/shared/types/storyVariant.types'
import { matchesVariantDocument,storyVariantReference,verifyStoryVariantSnapshot } from '@/infrastructure/api/storyVariantContract'

export interface SceneConflictReview {
    applicationRejection?:GenerationApplicationRejection
    recoveryScope?: WorkspaceStorageScope & { isDefaultWorkspace?: boolean }
    id: string
    ownerKey: string
    sequence: number
    baseDocument: StoryManuscriptDocument | null
    deviceDocument: StoryManuscriptDocument
    deviceTitle: string
    account: StorySceneDocument
}

export interface SceneDraftApi {
    sceneId: string | null
    title: string
    setTitle: (title: string) => void
    body: string
    document: StoryManuscriptDocument
    onDocumentChange: (document: StoryManuscriptDocument,anchorEdits?:StoryAnchorEdit[]|null) => void
    saveState: NovelSaveState
    lastSavedAt: Date | null
    suspended: boolean
    setSuspended: (value: boolean) => void
    saveNow: () => Promise<boolean>
    flush: () => Promise<boolean>
    /** Checkpoint before leaving a device view; never reports an account save. */
    preserveLocal: () => boolean
    acceptGeneration: (generationId: string, variant?: StoryVariantSnapshot) => Promise<boolean>
    applicationRejection:GenerationApplicationRejection|null
    getApplicationRejection:()=>GenerationApplicationRejection|null
    recovery: DraftCheckpoint | null
    resumeRecovery: () => void
    useServerVersion: () => void
    contentKey: number
    titleError: 'blank' | 'tooLong' | null
    localSaved: boolean
    storageFailed: boolean
    conflictServer: StorySceneDocument | null
    compareConflict: () => Promise<void>
    resolveConflict: (choice: 'local' | 'server' | 'merge', candidate?: { document: StoryManuscriptDocument; title: string }) => boolean
    conflictReview: SceneConflictReview | null
    reviewStale: boolean
    retentionFailed: boolean
    retainedDrafts: RetainedSceneDraft[]
    retainedDraftsUnavailable: boolean
    online: boolean
    closeConflict: () => void
    getRevision: () => number | null
}
interface Options { storyId: string | null; scene: StorySceneDocument | null; workspace: StoryWorkspace; blocked?:boolean }
interface Session {
    storyId: string; sceneId: string; workspace: StoryWorkspace; userHash: string | null | undefined
    title: string; document: StoryManuscriptDocument; savedTitle: string; savedDocument: StoryManuscriptDocument
    revision: number; metadataRevision: number; sequence: number; key: string | null
    pending: DraftCheckpoint['pending']
    inFlight: Promise<boolean> | null
    recovery: DraftCheckpoint | null
    dirty: boolean; retryable: boolean; conflicted:boolean; recoveredFrom: DraftCheckpoint | null
    anchorEdits:StoryAnchorEdit[]|null
    needsRevalidate: boolean
    baseKnown: boolean
    applicationRejection:GenerationApplicationRejection|null
}
export function useSceneDraft({ storyId, scene, workspace,blocked=false }: Options): SceneDraftApi {
    const data = useData()
    const auth = useAuth()
    const online = useBrowserConnectivity()
    const workspaceReadOnly = useWorkspaceReadOnly(workspace.workspaceId)
    const isDefaultWorkspace = useContext(WorkspaceContext)?.workspaces?.find((item) => item.id === workspace.workspaceId)?.is_default
    const readOnly = blocked||workspaceReadOnly || Boolean(scene?.inheritance?.readOnly)
    const live = useRef({ data, auth, readOnly, workspace, isDefaultWorkspace })
    useLayoutEffect(() => { live.current = { data, auth, readOnly, workspace, isDefaultWorkspace } })
    const sessionRef = useRef<Session | null>(null)
    const [draftSceneId, setDraftSceneId] = useState(scene?.id ?? null)
    const [title, setTitleState] = useState(scene?.title ?? '')
    const [manuscript, setManuscript] = useState<StoryManuscriptDocument>(() => scene?.document ?? {schemaVersion:1,content:{type:'doc',content:[{type:'paragraph',attrs:{nodeId:generateUUID()}}]}})
    const [saveState, setSaveState] = useState<NovelSaveState>('idle')
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
    const [suspended, setSuspended] = useState(false)
    const [recovery, setRecovery] = useState<DraftCheckpoint | null>(null)
    const [contentKey, setContentKey] = useState(0)
    const [titleError, setTitleError] = useState<SceneDraftApi['titleError']>(null)
    const [localSaved, setLocalSaved] = useState(false)
    const [storageFailed, setStorageFailed] = useState(false)
    const [conflictServer, setConflictServer] = useState<StorySceneDocument | null>(null)
    const [conflictReview, setConflictReview] = useState<SceneConflictReview | null>(null)
    const [reviewStale, setReviewStale] = useState(false)
    const [retentionFailed, setRetentionFailed] = useState(false)
    const [applicationFailure,setApplicationFailure]=useState<{ownerKey:string;value:GenerationApplicationRejection}|null>(null)
    const reviewRef = useRef<{ id: string; session: Session; sequence: number; signature: string; title: string; value: SceneConflictReview; open: boolean } | null>(null)
    const ownerKey = JSON.stringify([auth.userHash, auth.accountKey ?? null, workspace.workspaceId, storyId, scene?.id ?? null])
    const ownerKeyRef = useRef(ownerKey)
    useLayoutEffect(() => { ownerKeyRef.current = ownerKey }, [ownerKey])
    const retainedPrefix = storyId && scene ? retainedSceneDraftPrefix(auth.userHash, workspace.workspaceId, storyId, scene.id) : null
    const [retained, setRetained] = useState<{ scope: string | null; items: RetainedSceneDraft[]; unavailable: boolean }>({ scope: null, items: [], unavailable: false })
    useEffect(() => {
        const refresh = () => setRetained({ scope: retainedPrefix, ...readRetainedSceneDrafts(retainedPrefix) })
        refresh()
        const changed = (event: StorageEvent) => { if (event.key === null || retainedPrefix && event.key.startsWith(retainedPrefix)) refresh() }
        window.addEventListener('storage', changed)
        return () => window.removeEventListener('storage', changed)
    }, [retainedPrefix])
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const publish = useCallback((session: Session, state: NovelSaveState) => {
        if (sessionRef.current === session && session.workspace.isCurrent()) setSaveState(state)
    }, [])
    const checkpoint = useCallback((session: Session) => {
        // A pending recovery belongs to the author until they choose a version.
        if (session.recovery) {
            const stored = readCheckpoint(session.recovery.storageKey ?? null)
            return Boolean(stored && stored.storageKey === session.recovery.storageKey && stored.sequence === session.recovery.sequence
                && stored.baseRevision === session.recovery.baseRevision && stored.baseMetadataRevision === session.recovery.baseMetadataRevision
                && stored.title === session.recovery.title && documentSignature(stored.document) === documentSignature(session.recovery.document)
                && canonicalJson(stored.pending) === canonicalJson(session.recovery.pending) && Boolean(stored.pendingInvalid) === Boolean(session.recovery.pendingInvalid)
                &&canonicalJson(stored.applicationRejection??null)===canonicalJson(session.recovery.applicationRejection??null))
        }
        const saved = writeCheckpoint(session.key, session.dirty || session.pending ||session.applicationRejection? {
            schema: 2, title: session.title, document: session.document, baseRevision: session.revision,
            baseMetadataRevision: session.metadataRevision, sequence: session.sequence, pending: session.pending,
            ...(session.applicationRejection?{applicationRejection:session.applicationRejection}:{}),
            anchorEdits:session.anchorEdits,
        } : null)
        if (sessionRef.current === session) {
            setLocalSaved(saved && session.dirty)
            setStorageFailed(Boolean(session.key) && !saved)
        }
        return saved
    }, [])
    const runSave = useCallback((session: Session): Promise<boolean> => {
        if (session.inFlight) return session.inFlight
        const run = async () => {
            if (session.workspace.deviceOnly) {
                const saved = checkpoint(session)
                if (session.dirty || session.pending) publish(session, 'offline')
                return saved && !session.dirty && !session.pending
            }
            if (session.conflicted||session.applicationRejection) return false
            if (!session.dirty && !session.pending && !session.needsRevalidate) return true
            if (session.recovery || live.current.readOnly || !live.current.auth.isAuthenticated) {
                if (!live.current.auth.isAuthenticated) live.current.auth.openLoginModal()
                return !session.dirty && !session.pending
            }
            if (session.userHash !== live.current.auth.userHash) return false
            while (session.dirty || session.pending || session.needsRevalidate) {
                if (live.current.readOnly || session.userHash !== live.current.auth.userHash || !live.current.auth.isAuthenticated) return false
                if (!browserCanConnect()) {
                    session.needsRevalidate = true
                    checkpoint(session)
                    publish(session, 'offline')
                    return !session.dirty && !session.pending
                }
                // Recover an already-sent immutable request before inspecting a
                // newer head. A fresh offline tail first reads its owned scene.
                if (session.needsRevalidate && !session.pending) {
                    publish(session, 'checking')
                    try {
                        const api = session.workspace.detachedApi()
                        if (!api) throw new Error('The writing account cannot be checked')
                        const [current, ownership] = await Promise.all([
                            session.workspace.isCurrent() && live.current.data.refreshStoryScene
                                ? live.current.data.refreshStoryScene(session.storyId, session.sceneId)
                                : api.getStoryScene(session.storyId, session.sceneId),
                            api.getWorkspace(session.workspace.workspaceId!),
                        ])
                        if (session.userHash !== live.current.auth.userHash || !live.current.auth.isAuthenticated || !session.workspace.detachedApi()) return false
                        if (!browserCanConnect()) { checkpoint(session); publish(session, 'offline'); return false }
                        if (ownership.id !== session.workspace.workspaceId) throw new Error('The writing workspace cannot be verified')
                        if (live.current.readOnly || ownership.archived_at !== null || current.inheritance?.readOnly) {
                            session.retryable = false; checkpoint(session); publish(session, 'error'); return false
                        }
                        if (current.id !== session.sceneId || current.storyId !== session.storyId || !isStoryDocument(current.document)
                            || current.revision < session.revision || current.metadataRevision < session.metadataRevision) throw new Error('The saved writing head cannot be verified')
                        const proseDirty = documentSignature(session.document) !== documentSignature(session.savedDocument)
                        const titleDirty = session.title !== session.savedTitle
                        if (current.revision > session.revision && proseDirty
                            || current.metadataRevision > session.metadataRevision && titleDirty && current.title !== session.savedTitle && current.title !== session.title.trim()) {
                            session.conflicted = true; session.retryable = false
                            checkpoint(session); publish(session, 'conflict'); return false
                        }
                        if (!proseDirty) {
                            const changed = documentSignature(session.document) !== documentSignature(current.document)
                            session.document = current.document; session.savedDocument = current.document; session.revision = current.revision; session.baseKnown = true
                            session.anchorEdits = []
                            if (sessionRef.current === session && session.workspace.isCurrent()) {
                                setManuscript(current.document)
                                if (changed) setContentKey((key) => key + 1)
                            }
                        }
                        session.metadataRevision = current.metadataRevision
                        session.savedTitle = current.title
                        if (!titleDirty || session.title.trim() === current.title) {
                            session.title = current.title
                            if (sessionRef.current === session && session.workspace.isCurrent()) setTitleState(current.title)
                        }
                        session.needsRevalidate = false
                        session.dirty = documentSignature(session.document) !== documentSignature(session.savedDocument) || session.title !== session.savedTitle
                        if (!session.dirty) { checkpoint(session); break }
                    } catch (error) {
                        session.needsRevalidate = true
                        session.retryable = !(error instanceof ApiError) || error.status >= 500 || error.status === 408 || error.status === 429
                        checkpoint(session); publish(session, browserCanConnect() ? 'error' : 'offline'); return false
                    }
                }
                const validTitle = session.title.trim()
                const invalidTitle = !validTitle ? 'blank' : [...validTitle].length > 255 ? 'tooLong' : null
                if (sessionRef.current === session) setTitleError(invalidTitle)
                if (!session.pending) {
                    const write: StorySceneWrite = { requestId: makeRequestId('novel-save') }
                    if (documentSignature(session.document) !== documentSignature(session.savedDocument)) {
                        write.document = session.document; write.expectedRevision = session.revision
                        if(session.anchorEdits?.length)write.anchorEdits=session.anchorEdits.map((edit)=>({...edit}))
                    }
                    if (!invalidTitle && validTitle !== session.savedTitle) { write.title = validTitle; write.expectedMetadataRevision = session.metadataRevision }
                    if (write.document === undefined && write.title === undefined) {
                        session.dirty = Boolean(invalidTitle)
                        session.retryable = !invalidTitle
                        if (!invalidTitle) { session.title = validTitle; if (sessionRef.current === session && session.workspace.isCurrent()) setTitleState(validTitle); checkpoint(session) }
                        publish(session, invalidTitle ? 'error' : 'saved')
                        return !invalidTitle
                    }
                    session.pending = { write }
                }
                const pending = session.pending
                if(!checkpoint(session)&&pending.generationId){publish(session,'error');return false}
                publish(session, 'saving')
                try {
                    const detached = !session.workspace.isCurrent() ? session.workspace.detachedApi() : null
                    if (!session.workspace.isCurrent() && !detached) return false
                    const updated = pending.generationId
                        ? await (detached ?? live.current.data).acceptStoryGeneration(session.storyId, pending.generationId, {
                            requestId: pending.write.requestId, sceneId: session.sceneId,
                            expectedRevision: pending.write.expectedRevision!, document: pending.write.document!,
                            ...(pending.write.anchorEdits?{anchorEdits:pending.write.anchorEdits}:{}),
                            ...(pending.variant?{variant:structuredClone(pending.variant)}:{}),
                        })
                        : await (detached ?? live.current.data).updateStoryScene(session.storyId, session.sceneId, pending.write)
                    session.revision = Math.max(session.revision,updated.revision)
                    session.baseKnown = true
                    session.metadataRevision = Math.max(session.metadataRevision,updated.metadataRevision)
                    if (pending.write.document !== undefined) {
                        if(session.anchorEdits&&pending.write.anchorEdits)session.anchorEdits=session.anchorEdits.slice(pending.write.anchorEdits.length)
                        else if(documentSignature(session.document)===documentSignature(pending.write.document))session.anchorEdits=[]
                        else if(documentText(session.savedDocument)!==documentText(pending.write.document))session.anchorEdits=null
                        session.savedDocument = pending.write.document
                    }
                    if (pending.write.title !== undefined) {
                        session.savedTitle = pending.write.title
                        if (session.title.trim() === pending.write.title) session.title = pending.write.title
                    }
                    session.pending = null
                    if (session.recoveredFrom) { retireRecovery(session.recoveredFrom); session.recoveredFrom = null }
                    session.dirty = documentSignature(session.document) !== documentSignature(session.savedDocument) || session.title !== session.savedTitle
                    session.retryable = true
                    checkpoint(session)
                    if (sessionRef.current === session && session.workspace.isCurrent()) {
                        setTitleState(session.title)
                        setLastSavedAt(dateFromApiTimestamp(updated.updatedAt) ?? new Date())
                    }
                } catch (error) {
                    session.dirty = true
                    session.conflicted=error instanceof ApiError && error.status===409
                    session.retryable = !(error instanceof ApiError) || error.status >= 500 || error.status === 408 || error.status === 429
                    const rejected=pending.generationId&&error instanceof ApiError?confirmedGenerationApplicationRejection(error):null
                    if(pending.generationId&&rejected){
                        session.applicationRejection={reason:rejected,generationId:pending.generationId,
                            ...(pending.variant?{variant:structuredClone(pending.variant)}:{}),
                            write:structuredClone(pending.write) as GenerationApplicationRejection['write']}
                        session.conflicted=true
                        if(sessionRef.current===session&&session.workspace.isCurrent())setApplicationFailure({ownerKey:ownerKeyRef.current,value:session.applicationRejection})
                    }
                    // Definite rejections did not commit. A transport failure keeps
                    // its exact request so a retry recovers its original receipt.
                    if (!session.retryable&&(!pending.generationId||rejected)) session.pending = null
                    if(pending.generationId&&!rejected)session.conflicted=false
                    checkpoint(session)
                    publish(session, session.applicationRejection||!pending.generationId&&error instanceof ApiError && error.status === 409 ? 'conflict' : browserCanConnect() ? 'error' : 'offline')
                    return false
                }
            }
            publish(session, 'saved')
            return true
        }
        // Publish the promise before starting work, including synchronous mocks.
        const promise = Promise.resolve().then(run)
        session.inFlight = promise
        void promise.finally(() => { if (session.inFlight === promise) session.inFlight = null })
        return promise
    }, [checkpoint, publish])

    const sceneId = scene?.id ?? null
    const seedRef = useRef({ scene, storyId, workspace, userHash: auth.userHash })
    useLayoutEffect(() => { seedRef.current = { scene, storyId, workspace, userHash: auth.userHash } })
    useEffect(() => {
        const old = sessionRef.current
        if (old) { checkpoint(old); if (old.dirty && !old.recovery) void runSave(old) }
        const seed = seedRef.current
        if (!seed.scene || !seed.storyId) {
            sessionRef.current = null
            setDraftSceneId(null)
            return
        }
        // A reopened editor is another writer even in this tab. An old queue's
        // late checkpoint/ack must never clear the new queue's journal key.
        const key = draftJournalKey(seed.userHash, seed.workspace.workspaceId, seed.storyId, seed.scene.id, generateUUID())
        const saved = readCheckpoint(key)
        const needsRecovery = saved && (documentSignature(saved.document) !== documentSignature(seed.scene.document) || saved.title !== seed.scene.title || saved.pending || saved.pendingInvalid) ? saved : null
        const session: Session = {
            storyId: seed.storyId, sceneId: seed.scene.id, workspace: seed.workspace, userHash: seed.userHash,
            title: seed.scene.title, document: seed.scene.document, savedTitle: seed.scene.title, savedDocument: seed.scene.document,
            revision: seed.scene.revision, metadataRevision: seed.scene.metadataRevision,
            sequence: 0, key, pending: null, inFlight: null, recovery: needsRecovery, dirty: false, retryable: true, conflicted:false, recoveredFrom: null,
            anchorEdits:[], needsRevalidate: !browserCanConnect() || Boolean(seed.workspace.deviceOnly), baseKnown: true,applicationRejection:null,
        }
        sessionRef.current = session
        setDraftSceneId(session.sceneId)
        setTitleState(session.title); setManuscript(session.document); setSaveState('idle')
        setLastSavedAt(dateFromApiTimestamp(seed.scene.updatedAt)); setRecovery(needsRecovery)
        setTitleError(null); setLocalSaved(false); setStorageFailed(false); setConflictServer(null); setConflictReview(null); reviewRef.current = null; setReviewStale(false); setRetentionFailed(false); setSuspended(false)
        setApplicationFailure(needsRecovery?.applicationRejection?{ownerKey:ownerKeyRef.current,value:needsRecovery.applicationRejection}:null)
    }, [auth.userHash, sceneId, storyId, workspace.workspaceId, checkpoint, runSave])

    useEffect(()=>{
        const session=sessionRef.current
        if (!scene || !session || session.sceneId!==scene.id || session.recovery || session.inFlight || session.pending ||session.applicationRejection|| !session.workspace.isCurrent()) return
        const proseDirty=documentSignature(session.document)!==documentSignature(session.savedDocument)
        const titleDirty=session.title!==session.savedTitle
        if (scene.revision>session.revision) {
            if (proseDirty) {
                session.conflicted=true;session.retryable=false;setSaveState('conflict');return
            }
            session.document=scene.document;session.savedDocument=scene.document;session.revision=scene.revision
            session.anchorEdits=[]
            setManuscript(scene.document);setContentKey((key)=>key+1)
        }
        if (scene.metadataRevision>session.metadataRevision) {
            if (titleDirty && scene.title!==session.savedTitle && scene.title!==session.title.trim()) {
                session.conflicted=true;session.retryable=false;setSaveState('conflict');return
            }
            session.metadataRevision=scene.metadataRevision;session.savedTitle=scene.title
            if (!titleDirty || session.title.trim()===scene.title) {session.title=scene.title;setTitleState(scene.title)}
        }
        session.dirty=documentSignature(session.document)!==documentSignature(session.savedDocument)||session.title!==session.savedTitle
    },[scene,saveState,recovery])

    const edit = useCallback((patch: {title?:string;document?:StoryManuscriptDocument;anchorEdits?:StoryAnchorEdit[]|null}) => {
        const session=sessionRef.current
        if (!session || live.current.readOnly || session.recovery || !session.workspace.isCurrent()) return
        if (patch.title !== undefined) {session.title=patch.title;setTitleState(patch.title)}
        if (patch.document !== undefined) {
            const next=patch.anchorEdits
            if(session.anchorEdits!==null&&next&&applyStoryAnchorEdits(documentText(session.document),next)===documentText(patch.document)){
                const combined=[...session.anchorEdits,...next.map((value)=>({...value}))]
                session.anchorEdits=applyStoryAnchorEdits(documentText(session.savedDocument),combined)===documentText(patch.document)?combined:null
            }else session.anchorEdits=null
            session.document=patch.document;setManuscript(patch.document)
        }
        session.dirty=true;session.sequence+=1;if(!session.pending)session.retryable=!session.conflicted
        setSaveState(session.conflicted?'conflict':browserCanConnect()&&!session.workspace.deviceOnly?session.pending&&!session.retryable?'error':'dirty':'offline');setLocalSaved(false)
        if (localTimerRef.current) clearTimeout(localTimerRef.current)
        localTimerRef.current=setTimeout(()=>checkpoint(session),150)
    },[checkpoint])
    const flush = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        const session = sessionRef.current
        if (!session) return Promise.resolve(true)
        checkpoint(session)
        return runSave(session)
    }, [checkpoint, runSave])
    const acceptGeneration = useCallback(async (generationId: string, variant?: StoryVariantSnapshot) => {
        const session = sessionRef.current
        if (!session || session.workspace.deviceOnly || session.recovery ||session.applicationRejection||session.conflicted
            ||!variant&&(live.current.readOnly||!browserCanConnect())) return false
        if (session.inFlight && !await session.inFlight) return false
        if(sessionRef.current!==session||!session.workspace.isCurrent()||session.userHash!==live.current.auth.userHash
            ||!live.current.auth.isAuthenticated||session.recovery||session.applicationRejection||session.conflicted
            ||!variant&&(live.current.readOnly||!browserCanConnect()))return false
        if(session.pending)return false
        if(variant){
            if(!verifyStoryVariantSnapshot(variant,session.storyId)||variant.parent.parent.id!==generationId
                ||variant.operation.sceneId!==session.sceneId||variant.operation.expectedRevision!==session.revision
                ||documentSignature(session.savedDocument)!==documentSignature(variant.baseDocument)||!matchesVariantDocument(variant,session.document))return false
            // The reviewed mapping is part of the immutable operation, including
            // the difference between an empty trace and an omitted trace.
            session.anchorEdits=structuredClone(variant.operation.anchorEdits)
        }
        session.pending = { generationId, ...(variant?{variant:storyVariantReference(variant)}:{}), write: {
            requestId: makeRequestId('novel-accept'), expectedRevision: session.revision, document: session.document,
            ...(variant?variant.operation.anchorEdits!==null?{anchorEdits:structuredClone(variant.operation.anchorEdits)}:{}
                :session.anchorEdits?.length?{anchorEdits:session.anchorEdits.map((edit)=>({...edit}))}:{}),
        } }
        checkpoint(session)
        return runSave(session)
    }, [checkpoint, runSave])
    useEffect(() => {
        const session = sessionRef.current
        if (!session) return
        if (!online) {
            session.needsRevalidate = true
            checkpoint(session)
            if ((session.dirty || session.pending) && !session.conflicted) publish(session, 'offline')
            return
        }
        if (session.needsRevalidate && !session.recovery && !session.conflicted && !suspended && !readOnly && auth.isAuthenticated) void runSave(session)
    }, [online, auth.isAuthenticated, readOnly, suspended, checkpoint, publish, runSave])
    useEffect(() => {
        const session = sessionRef.current
        if (!online || !session || suspended || readOnly || recovery || !auth.isAuthenticated) return
        const delay = saveState === 'dirty' ? 1200 : saveState === 'error' && session.retryable ? 5000 : null
        if (delay === null) return
        timerRef.current = setTimeout(() => void runSave(session), delay)
        return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }, [online, auth.isAuthenticated, manuscript, title, readOnly, recovery, runSave, saveState, suspended])
    useEffect(() => {
        const hidden = () => { if (document.visibilityState === 'hidden' && sessionRef.current) checkpoint(sessionRef.current) }
        const unload = (event: BeforeUnloadEvent) => {
            const session = sessionRef.current
            if (!session) return
            checkpoint(session)
            if (session.dirty || session.pending) { event.preventDefault(); event.returnValue = '' }
        }
        document.addEventListener('visibilitychange', hidden); window.addEventListener('beforeunload', unload)
        return () => {
            document.removeEventListener('visibilitychange', hidden); window.removeEventListener('beforeunload', unload)
            if (localTimerRef.current) clearTimeout(localTimerRef.current)
            const session = sessionRef.current
            if (session) { checkpoint(session); if (session.dirty && !session.recovery) void runSave(session) }
        }
    }, [checkpoint, runSave])
    const resumeRecovery = useCallback(() => {
        const session = sessionRef.current
        const saved = session?.recovery
        if (!session || !saved || saved.pendingInvalid) return
        session.baseKnown = session.revision === saved.baseRevision
        session.title = saved.title; session.document = saved.document; session.revision = saved.baseRevision
        session.metadataRevision = saved.baseMetadataRevision; session.pending = saved.pending
        session.anchorEdits=saved.anchorEdits??null
        session.dirty = true; session.recoveredFrom = saved; session.recovery = null
        session.applicationRejection=saved.applicationRejection?structuredClone(saved.applicationRejection):null
        session.conflicted=Boolean(session.applicationRejection)
        setRecovery(null); setTitleState(session.title); setManuscript(session.document); setContentKey((n) => n+1)
        setSaveState(session.applicationRejection?'conflict':browserCanConnect() && !session.workspace.deviceOnly ? 'dirty' : 'offline'); checkpoint(session)
    }, [checkpoint])
    const useServerVersion = useCallback(() => {
        const session = sessionRef.current
        if (!session) return
        if(session.applicationRejection||session.recovery?.applicationRejection)return
        const remote=seedRef.current.scene
        if (!remote || remote.id!==session.sceneId) return
        retireRecovery(session.recovery); session.recovery = null; setRecovery(null)
        session.document=remote.document;session.savedDocument=remote.document;session.title=remote.title;session.savedTitle=remote.title
        session.revision=remote.revision;session.metadataRevision=remote.metadataRevision;session.pending=null;session.dirty=false;session.conflicted=false
        session.anchorEdits=[]
        setManuscript(remote.document);setTitleState(remote.title);setContentKey((key)=>key+1);setSaveState('saved');checkpoint(session)
    }, [checkpoint])
    const compareConflict = useCallback(async () => {
        const session = sessionRef.current
        if(session?.recovery?.applicationRejection&&!session.recovery.pendingInvalid)resumeRecovery()
        const api = session?.workspace.isCurrent() && !session.workspace.deviceOnly ? session.workspace.detachedApi() : null
        if (!session || !api || session.pending || session.inFlight || session.userHash !== live.current.auth.userHash || !browserCanConnect()) return
        const capturedOwner = ownerKeyRef.current, sequence = session.sequence
        const signature = documentSignature(session.document), title = session.title
        const current = await api.getStoryScene(session.storyId, session.sceneId)
        let baseDocument: StoryManuscriptDocument | null = session.baseKnown ? session.savedDocument : null
        if (!baseDocument) {
            try {
                const base = await api.getStoryRevision(session.storyId, session.sceneId, session.revision)
                if (base.sceneId === session.sceneId && base.storyId === session.storyId && base.revision === session.revision && isStoryDocument(base.document)) baseDocument = base.document
            } catch { /* Both full versions remain reviewable without a trusted base. */ }
        }
        if (sessionRef.current !== session || !session.workspace.isCurrent() || session.userHash !== live.current.auth.userHash || ownerKeyRef.current !== capturedOwner) return
        if (session.sequence !== sequence || documentSignature(session.document) !== signature || session.title !== title) { setReviewStale(true); return }
        if (current.id !== session.sceneId || current.storyId !== session.storyId || !isStoryDocument(current.document)) throw new Error('The comparison source cannot be verified')
        const prior = reviewRef.current
        if (prior?.session === session && prior.sequence === sequence && prior.signature === signature && prior.title === title
            && canonicalJson(prior.value.account) === canonicalJson(current) && canonicalJson(prior.value.baseDocument) === canonicalJson(baseDocument)) {
            prior.open = true
            setConflictServer(current); setConflictReview(prior.value); setReviewStale(false)
            return
        }
        const id = makeRequestId('novel-reconcile')
        const value: SceneConflictReview = { id, ownerKey: capturedOwner, sequence, baseDocument: baseDocument ? structuredClone(baseDocument) : null,
            deviceDocument: structuredClone(session.document), deviceTitle: title, account: current,
            ...(session.applicationRejection?{applicationRejection:structuredClone(session.applicationRejection)}:{}),
            ...(session.userHash && session.workspace.workspaceId ? { recoveryScope: { apiOrigin: apiStorageOrigin(API_BASE_URL), userHash: session.userHash, workspaceId: session.workspace.workspaceId,
                ...(live.current.isDefaultWorkspace !== undefined ? { isDefaultWorkspace: live.current.isDefaultWorkspace } : {}) } } : {}) }
        reviewRef.current = { id, session, sequence, signature, title, value, open: true }
        setConflictReview(value)
        setConflictServer(current); setReviewStale(false); setRetentionFailed(false)
    }, [resumeRecovery])
    const resolveConflict = useCallback((choice: 'local' | 'server' | 'merge', candidate?: { document: StoryManuscriptDocument; title: string }): boolean => {
        const session = sessionRef.current, reviewed = reviewRef.current
        if (!session || !reviewed?.open || !conflictReview || reviewed.id !== conflictReview.id || reviewed.session !== session
            || !session.workspace.isCurrent() || session.userHash !== live.current.auth.userHash || conflictReview.ownerKey !== ownerKeyRef.current
            || session.pending || session.inFlight || choice !== 'server' && live.current.readOnly) return false
        if(session.applicationRejection&&choice!=='server')return false
        if (session.sequence !== reviewed.sequence || documentSignature(session.document) !== reviewed.signature || session.title !== reviewed.title) { setReviewStale(true); return false }
        const remote = conflictReview.account
        const document = choice === 'server' ? remote.document : choice === 'local' ? session.document : candidate?.document
        const title = choice === 'server' ? remote.title : choice === 'local' ? session.title : candidate?.title
        if (!document || !isStoryDocument(document) || typeof title !== 'string' || !title.trim() || [...title.trim()].length > 255) return false
        const prefix = retainedSceneDraftPrefix(session.userHash, session.workspace.workspaceId, session.storyId, session.sceneId)
        const preserved = retainSceneDraft(prefix, { title: session.title, document: session.document, baseRevision: session.revision, baseMetadataRevision: session.metadataRevision,
            ...(session.applicationRejection?{applicationRejection:structuredClone(session.applicationRejection)}:{}) })
        if (!preserved) { setRetentionFailed(true); return false }
        setRetained({ scope: prefix, ...readRetainedSceneDrafts(prefix) })
        session.pending = null; session.conflicted = false; session.retryable = true
        session.applicationRejection=null;setApplicationFailure(null)
        if(session.recoveredFrom){retireRecovery(session.recoveredFrom);session.recoveredFrom=null}
        session.revision = remote.revision; session.metadataRevision = remote.metadataRevision
        session.savedDocument = remote.document; session.savedTitle = remote.title; session.baseKnown = true
        session.anchorEdits = null
        session.document = structuredClone(document); session.title = title
        session.sequence += 1
        session.dirty = documentSignature(session.document) !== documentSignature(remote.document) || title !== remote.title
        session.needsRevalidate = !browserCanConnect()
        setManuscript(session.document); setTitleState(title); setContentKey((n) => n + 1)
        setConflictServer(null); setConflictReview(null); reviewRef.current = null
        setReviewStale(false); setRetentionFailed(false); checkpoint(session)
        setSaveState(session.dirty ? browserCanConnect() ? 'dirty' : 'offline' : 'saved')
        return true
    }, [checkpoint, conflictReview])
    const visibleReview = conflictReview?.ownerKey === ownerKey ? conflictReview : null
    return { sceneId: draftSceneId, title, setTitle: (value) => edit({title:value}), document:manuscript, body:documentMarkdown(manuscript), onDocumentChange: (value,anchorEdits) => edit({document:value,anchorEdits}),
        saveState, lastSavedAt, suspended, setSuspended, saveNow: () => live.current.readOnly ? Promise.resolve(false) : flush(), flush, acceptGeneration,
        applicationRejection:applicationFailure?.ownerKey===ownerKey?applicationFailure.value:null,
        getApplicationRejection:()=>{
            const session=sessionRef.current
            return session?.workspace.isCurrent()&&session.userHash===live.current.auth.userHash
                ?session.applicationRejection??session.recovery?.applicationRejection??null:null
        },
        preserveLocal: () => {
            const session = sessionRef.current
            if (!session || !session.workspace.isCurrent() || session.userHash !== live.current.auth.userHash) return false
            return !session.dirty && !session.pending && !session.recovery || checkpoint(session)
        },
        recovery, resumeRecovery, useServerVersion, contentKey, titleError, localSaved, storageFailed, conflictServer: visibleReview ? conflictServer : null, conflictReview: visibleReview, reviewStale, retentionFailed,
        retainedDrafts: retained.scope === retainedPrefix ? retained.items : [], retainedDraftsUnavailable: retained.scope === retainedPrefix && retained.unavailable, online,
        compareConflict, resolveConflict, closeConflict: () => { setConflictServer(null); if (reviewRef.current) reviewRef.current.open = false }, getRevision: () => sessionRef.current?.revision ?? null }
}
