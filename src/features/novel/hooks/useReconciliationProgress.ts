import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SceneConflictReview } from './useSceneDraft'
import type { SceneReconciliation } from '../persistence/sceneReconciliation'
import { reconciliationJournal, reconciliationKey, reconciliationSceneScope, type ReconciliationCheckpoint, type ReconciliationChoices, type ReconciliationJournal, type ReconciliationSource } from '../persistence/reconciliationJournal'
import { generateUUID } from '@/utils/uuid'
import { canonicalJson } from '@/utils/json'

/** Presentation accepts a saved comparison without inventing a full account DTO. */
export type ReconciliationReview = Omit<SceneConflictReview, 'account'> & {
    account: Pick<SceneConflictReview['account'], 'id' | 'storyId' | 'chapterId' | 'document' | 'title' | 'revision' | 'metadataRevision' | 'contentHash' | 'inheritance'>
    accountReadOnly?: boolean
}
type ProgressStatus = 'disabled' | 'loading' | 'clean' | 'recovered' | 'saving' | 'saved' | 'failed'
interface ProgressState { identity: string; value: ReconciliationChoices; status: ProgressStatus; sequence: number; changed: boolean; unreadable: number }
export function reconciliationSource(review: ReconciliationReview): ReconciliationSource {
    return { storyId: review.account.storyId, sceneId: review.account.id, chapterId: review.account.chapterId,
        base: review.baseDocument, device: review.deviceDocument, deviceTitle: review.deviceTitle,
        account: review.account.document, accountTitle: review.account.title, accountRevision: review.account.revision,
        accountMetadataRevision: review.account.metadataRevision, accountContentHash: review.account.contentHash,
        accountReadOnly: review.accountReadOnly ?? Boolean(review.account.inheritance?.readOnly),
        ...(review.applicationRejection?{applicationRejection:structuredClone(review.applicationRejection)}:{}) }
}
/** Review choices never contain a server intent and never apply themselves. */
export function useReconciliationProgress(review: ReconciliationReview, plan: SceneReconciliation | null, journal: ReconciliationJournal = reconciliationJournal) {
    const source = useMemo(() => reconciliationSource(review), [review]), scope = review.recoveryScope ?? null
    const identity = canonicalJson([scope, source])
    const defaults = useMemo<ReconciliationChoices>(() => ({ choices: {}, order: plan?.orderConflict ? '' : plan?.preferredOrder ?? '', title: review.deviceTitle === review.account.title ? 'device' : '' }), [plan, review.deviceTitle, review.account.title])
    const initial: ProgressState = { identity, value: defaults, status: scope ? 'loading' : 'disabled', sequence: 0, changed: false, unreadable: 0 }
    const [state, setState] = useState<ProgressState>(initial)
    const shown = state.identity === identity ? state : initial
    const live = useRef({ state: shown, source, scope }), alive = useRef(true)
    const writer = useMemo(() => ({ identity, id: generateUUID() }), [identity])
    const seed = useRef({ source, scope, defaults, plan })
    const latest = useRef<{ identity: string; checkpoint: ReconciliationCheckpoint; promise: Promise<boolean> } | null>(null)
    useLayoutEffect(() => { live.current = { state: shown, source, scope } })
    useLayoutEffect(() => { seed.current = { source, scope, defaults, plan } })
    useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
    useEffect(() => {
        const captured = seed.current
        if (!captured.scope) return
        let current = true
        void journal.load(captured.scope, captured.source).then((result) => {
            if (!current || !alive.current || live.current.state.identity !== identity) return
            const checkpoint = result.checkpoint, allowed = new Set(captured.plan?.conflicts.map((conflict) => conflict.id))
            const usable = checkpoint && Object.keys(checkpoint.value.choices).every((id) => allowed.has(id))
            const next: ProgressState = { identity, value: usable ? checkpoint.value : captured.defaults,
                status: result.unavailable ? 'failed' : usable ? 'recovered' : 'clean', sequence: 0, changed: false,
                unreadable: result.unreadable + (checkpoint && !usable ? 1 : 0) }
            live.current.state = next; setState(next)
        }).catch(() => {
            if (current && alive.current && live.current.state.identity === identity) {
                const next: ProgressState = { ...live.current.state, status: 'failed' }; live.current.state = next; setState(next)
            }
        })
        return () => { current = false }
    }, [identity, journal])
    const persist = (checkpoint: ReconciliationCheckpoint, ownedScope: NonNullable<typeof scope>): Promise<boolean> => {
        const owner = identity
        return journal.save(ownedScope, checkpoint).then((result) => {
            const current = live.current.state
            if (alive.current && current.identity === owner && current.sequence === checkpoint.sequence) {
                const next: ProgressState = { ...current, status: result === 'saved' ? 'saved' : 'failed' }
                live.current.state = next; setState(next)
            }
            return result === 'saved'
        }).catch(() => {
            if (alive.current && live.current.state.identity === owner && live.current.state.sequence === checkpoint.sequence) {
                const next: ProgressState = { ...live.current.state, status: 'failed' }; live.current.state = next; setState(next)
            }
            return false
        })
    }
    const update = (value: ReconciliationChoices) => {
        const current = live.current
        if (!alive.current || current.state.identity !== identity || current.state.status === 'loading') return
        const next: ProgressState = { ...current.state, value, sequence: current.state.sequence + 1, changed: true, status: scope ? 'saving' : 'disabled' }
        live.current.state = next; setState(next)
        if (!scope) return
        const checkpoint: ReconciliationCheckpoint = { schema: 1, key: reconciliationKey(scope, writer.id),
            sceneScope: reconciliationSceneScope(scope, source.storyId, source.sceneId), source, value,
            sequence: next.sequence, writtenAt: Date.now(), ...(scope.isDefaultWorkspace !== undefined ? { isDefaultWorkspace: scope.isDefaultWorkspace } : {}) }
        latest.current = { identity, checkpoint, promise: persist(checkpoint, scope) }
    }
    const flush = async () => {
        while (alive.current && live.current.state.identity === identity) {
            const current = live.current, pending = latest.current
            if (!scope || !current.state.changed || current.state.status === 'saved') return true
            if (!pending || pending.identity !== identity) return false
            if (current.state.status === 'failed') pending.promise = persist(pending.checkpoint, scope)
            const saved = await pending.promise
            if (live.current.state.identity !== identity) return false
            if (live.current.state.sequence !== pending.checkpoint.sequence) continue
            return saved
        }
        return false
    }
    const actions = useRef({ flush })
    useLayoutEffect(() => { actions.current = { flush } })
    useEffect(() => {
        const unload = (event: BeforeUnloadEvent) => {
            const current = live.current.state
            if (live.current.scope && current.changed && current.status !== 'saved') { event.preventDefault(); event.returnValue = '' }
        }
        const hidden = () => { if (document.visibilityState === 'hidden') void actions.current.flush() }
        window.addEventListener('beforeunload', unload); document.addEventListener('visibilitychange', hidden)
        return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('visibilitychange', hidden) }
    }, [])
    return { value: shown.value, status: shown.status, changed: shown.changed, unreadable: shown.unreadable, update, flush, source }
}
