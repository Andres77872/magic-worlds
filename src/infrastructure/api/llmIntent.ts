import type { LlmFeature, LlmRequest, LlmSelection } from '@/shared/types/llm.types'
import { authSession } from './authSession'

type Target = { account: string; selection: LlmSelection; expected_revision_id: string; retry_of_execution_id?: string }

/**
 * Secret-free memory of the target each unfinished request ID resolved to. The
 * server fingerprints selection and revision with the intent, so a retry of the
 * same request keeps that target while supplying request-scoped credentials anew.
 */
const targets = new Map<string, Target>()
const LIMIT = 64
// An expired token keeps its owner; logout or another account forgets every target.
authSession.subscribe((next) => { if (next.sessionPhase !== 'authenticated' && next.sessionPhase !== 'expired') targets.clear() })

/** Outcomes that spend a request ID: the next attempt must be a new request. */
const SPENT = new Set([
    'LLM_EXECUTION_FINISHED', 'LLM_EXECUTION_UPSTREAM_FAILED', 'LLM_EXECUTION_INTENT_CHANGED',
    'BYOK_CREDENTIAL_REJECTED', 'PROVIDER_AUTHENTICATION_REJECTED', 'PROVIDER_PERMISSION_DENIED',
    'PROVIDER_RATE_LIMITED', 'PROVIDER_QUOTA_EXCEEDED', 'PROVIDER_UNAVAILABLE', 'BYOK_TRANSPORT_UNSUPPORTED',
    'PROFILE_REVISION_CHANGED', 'PROFILE_UNAVAILABLE', 'PLATFORM_CREDENTIAL_FORBIDDEN', 'BYOK_EXPECTED_REVISION_REQUIRED',
])

export function isLlmRequestSpent(error: unknown): boolean {
    const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
    return typeof code === 'string' && SPENT.has(code)
}

const slot = (feature: LlmFeature, requestId: string) => JSON.stringify([feature, requestId])

export const llmIntents = {
    /** The frozen target a retry of this request reuses; never a credential. */
    retained(feature: LlmFeature, requestId: string): LlmRequest | null {
        const target = targets.get(slot(feature, requestId))
        if (!target || target.account !== authSession.getSnapshot().accountKey) return null
        return { selection: { ...target.selection }, expected_revision_id: target.expected_revision_id,
            ...(target.retry_of_execution_id ? { retry_of_execution_id: target.retry_of_execution_id } : {}) }
    },
    retain(feature: LlmFeature, requestId: string, llm: LlmRequest): void {
        if (!llm.selection || !llm.expected_revision_id) return
        const key = slot(feature, requestId)
        targets.delete(key)
        targets.set(key, { account: authSession.getSnapshot().accountKey, selection: { ...llm.selection }, expected_revision_id: llm.expected_revision_id,
            ...(llm.retry_of_execution_id ? { retry_of_execution_id: llm.retry_of_execution_id } : {}) })
        for (const oldest of targets.keys()) {
            if (targets.size <= LIMIT) break
            targets.delete(oldest)
        }
    },
    /** True when a fresh resolution still names the frozen profile revision. */
    matches(target: LlmRequest, candidate: LlmRequest): boolean {
        const [a, b] = [target.selection, candidate.selection]
        return target.retry_of_execution_id === candidate.retry_of_execution_id && Boolean(target.expected_revision_id) && target.expected_revision_id === candidate.expected_revision_id
            && a?.mode === b?.mode && (a?.mode !== 'profile' || b?.mode === 'profile' && a.profile_id === b.profile_id)
    },
    settle(feature: LlmFeature, requestId: string): void { targets.delete(slot(feature, requestId)) },
    clear(): void { targets.clear() },
}
