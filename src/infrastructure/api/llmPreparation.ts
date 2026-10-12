import type { LlmFeature, LlmRequest, LlmSelection } from '@/shared/types/llm.types'
import { API_BASE_URL } from './baseUrl'

/**
 * `workspaceId` is the origin workspace of a content execution (Workspace R1):
 * retained retry/recovery profile reads of chat, assistant, story and card
 * executions need it as their `X-Workspace-Id`; profile/Studio tests omit it.
 */
type Preparation = (feature: LlmFeature, signal?: AbortSignal, selection?: LlmSelection, retryOfExecutionId?: string, recoveryRequestId?: string, workspaceId?: string) => Promise<() => LlmRequest>
let prepare: Preparation | null = null

/** Install the authenticated UI's credential dialog; never store request credentials here. */
export function configureLlmPreparation(handler: Preparation): () => void {
    prepare = handler
    return () => { if (prepare === handler) prepare = null }
}

export async function prepareLlmRequest(feature: LlmFeature, supplied?: LlmRequest, signal?: AbortSignal, recoveryRequestId?: string, workspaceId?: string | null): Promise<LlmRequest> {
    signal?.throwIfAborted()
    const value = recoveryRequestId || supplied?.retry_of_execution_id
        ? (await prepareLlmDispatch(feature, signal, supplied?.selection, supplied?.retry_of_execution_id, recoveryRequestId, workspaceId))()
        : supplied?.credentials || supplied?.expected_revision_id ? supplied : (await prepareLlmDispatch(feature, signal, supplied?.selection))()
    signal?.throwIfAborted()
    if (value.credentials && !API_BASE_URL.startsWith('https://')) throw new Error('LLM_CREDENTIAL_HTTPS_REQUIRED')
    return { ...(supplied?.retry_of_execution_id ? { retry_of_execution_id: supplied.retry_of_execution_id } : {}), selection: value.selection ? { ...value.selection } : { mode: 'inherit' },
        ...(value.expected_revision_id ? { expected_revision_id: value.expected_revision_id } : {}),
        ...(value.credentials ? { credentials: { ...value.credentials } } : {}) }
}

/** A disconnected socket queues this secret-free factory, never a serialized key. */
export async function prepareLlmDispatch(feature: LlmFeature, signal?: AbortSignal, selection?: LlmSelection, retryOfExecutionId?: string, recoveryRequestId?: string, workspaceId?: string | null): Promise<() => LlmRequest> {
    signal?.throwIfAborted()
    if ((retryOfExecutionId || recoveryRequestId) && !prepare) throw new Error('LLM_RETRY_PREPARATION_REQUIRED')
    // The origin workspace only matters to retained retry/recovery reads.
    const origin = workspaceId && (retryOfExecutionId || recoveryRequestId) ? workspaceId : undefined
    const materialize = prepare ? await (origin ? prepare(feature, signal, selection, retryOfExecutionId, recoveryRequestId, origin)
        : recoveryRequestId ? prepare(feature, signal, selection, retryOfExecutionId, recoveryRequestId)
        : prepare(feature, signal, selection, retryOfExecutionId)) : () => ({ selection: selection ?? { mode: 'inherit' as const } })
    signal?.throwIfAborted()
    return materialize
}

/** Materialize a fresh key against the parent, preserving the original public command exactly. */
export async function prepareRetainedLlmRequest(feature: LlmFeature, target: LlmRequest, signal?: AbortSignal, recoveryRequestId?: string, workspaceId?: string | null): Promise<LlmRequest> {
    const prepared = await prepareLlmRequest(feature, target, signal, recoveryRequestId, workspaceId)
    if (target.expected_revision_id && prepared.expected_revision_id !== target.expected_revision_id
        || target.selection?.mode === 'profile' && (prepared.selection?.mode !== 'profile' || prepared.selection.profile_id !== target.selection.profile_id)
        || prepared.credentials && !target.expected_revision_id) {
        delete prepared.credentials
        throw Object.assign(new Error('LLM_EXECUTION_INTENT_CHANGED'), { code: 'LLM_EXECUTION_INTENT_CHANGED' })
    }
    return { selection: target.selection ? { ...target.selection } : { mode: 'inherit' },
        ...(target.expected_revision_id ? { expected_revision_id: target.expected_revision_id } : {}),
        ...(target.retry_of_execution_id ? { retry_of_execution_id: target.retry_of_execution_id } : {}),
        ...(prepared.credentials ? { credentials: prepared.credentials } : {}) }
}
