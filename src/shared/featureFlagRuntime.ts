/** In-memory permission bridge shared by React and delayed API/socket dispatch. */
import { authSession } from '@/infrastructure/api/authSession'
import { ACTIVE_FEATURE_FLAGS, type ActiveFeatureFlag } from './featureFlagCatalog'

export interface FeatureFlagDefinition { key: string; requires: string[] }
export interface FeatureFlagSnapshot {
    schema_version: 1
    catalog_revision: string
    user_hash: string
    plan_code: string | null
    membership_revision: string | null
    plan_feature_revision: string | null
    flags: FeatureFlagDefinition[]
    permissions: Record<string, boolean>
    valid_for_seconds: number
    bypass?: boolean
}
export interface FeatureFlagState {
    phase: 'idle' | 'loading' | 'ready' | 'unavailable' | 'reload-required'
    accountKey: string | null
    userHash: string | null
    root: boolean
    generation: number
    expiresAt: number
    snapshot: FeatureFlagSnapshot | null
}
let state: FeatureFlagState = { phase: 'idle', accountKey: null, userHash: null, root: false, generation: 0, expiresAt: 0, snapshot: null }
const listeners = new Set<() => void>()
function publish(next: FeatureFlagState) { state = next; for (const listener of listeners) listener() }

export const featureFlagRuntime = {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    setOwner(accountKey: string | null, userHash: string | null, root = false) {
        if (state.accountKey === accountKey && state.userHash === userHash && state.root === root) return
        publish({ phase: root ? 'ready' : accountKey ? 'loading' : 'idle', accountKey, userHash, root,
            generation: state.generation + 1, expiresAt: 0, snapshot: null })
    },
    invalidate() {
        if (state.root || !state.accountKey) return
        publish({ ...state, phase: 'loading', generation: state.generation + 1, snapshot: null, expiresAt: 0 })
    },
    accept(snapshot: FeatureFlagSnapshot, accountKey: string, generation: number) {
        if (state.accountKey !== accountKey || state.generation !== generation || snapshot.user_hash !== state.userHash) return false
        publish({ ...state, phase: 'ready', snapshot, generation: state.generation + 1,
            expiresAt: performance.now() + snapshot.valid_for_seconds * 1000 })
        return true
    },
    fail(accountKey: string, generation: number, mismatch: boolean) {
        if (state.accountKey !== accountKey || state.generation !== generation) return
        publish({ ...state, phase: mismatch ? 'reload-required' : 'unavailable', expiresAt: 0, snapshot: null })
    },
}

export function isActiveFeatureEnabled(key: ActiveFeatureFlag): boolean {
    if (!Object.prototype.hasOwnProperty.call(ACTIVE_FEATURE_FLAGS, key)) return false
    const owner = authSession.getSnapshot()
    if (owner.sessionPhase !== 'authenticated' || owner.accountKey !== state.accountKey || owner.userHash !== state.userHash) return false
    if (state.root) return true
    if (state.phase !== 'ready' || performance.now() >= state.expiresAt) return false
    const granted = state.snapshot?.permissions[key] === true
    return granted && ACTIVE_FEATURE_FLAGS[key].requires.every(parent => isActiveFeatureEnabled(parent))
}

