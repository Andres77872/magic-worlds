import type { AssistantKind, AssistantTurnResponse } from '@/shared/types/assistant.types'

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const messageFields = new Set(['message_id', 'conversation_id', 'user_id', 'project_hash', 'user_group_hash', 'sequence_no',
    'role', 'status', 'content', 'tool_calls', 'tool_call_id', 'tool_name', 'metadata', 'created_at', 'updated_at', 'completed_at'])
const conversationFields = new Set(['conversation_id', 'user_id', 'project_hash', 'user_group_hash', 'kind', 'card_type', 'card_id', 'lorebook_id',
    'title', 'conversation_version', 'active_request_id', 'active_request_started_at', 'created_at', 'updated_at'])
const coreFields = ['request_id', 'llm_execution', 'conversation', 'user_message', 'assistant_message', 'messages']
const documentFields = ['tool_message', 'target', 'target_cas', 'applied_actions']

/**
 * Shape check for one completed turn (the `final` event and turn reconciliation).
 * Every kind ends with the user message and its completed reply; the document
 * kinds (card, lorebook) add the tool message that applied the edit, so a turn
 * has three terminal messages there and two for `app`.
 */
export function verifyAssistantTurn<K extends AssistantKind>(value: unknown, kind: K, conversationId: number, requestId: string): value is AssistantTurnResponse<K> {
    const document = kind !== 'app'
    const fields = document ? [...coreFields, ...documentFields] : coreFields
    if (!object(value) || Object.keys(value).length !== fields.length || !fields.every((key) => key in value)
        || value.request_id !== requestId || !positiveId(conversationId) || !/^[A-Za-z0-9._:-]{1,64}$/.test(requestId)
        || !object(value.conversation) || Object.keys(value.conversation).some((key) => !conversationFields.has(key))
        || value.conversation.kind !== kind || value.conversation.conversation_id !== conversationId
        || value.conversation.active_request_id != null || value.conversation.active_request_started_at != null
        || !object(value.llm_execution)) return false
    const plan = value.llm_execution
    const keys = ['execution_id', 'profile_id', 'revision_id', 'resolution_source', 'credential_mode', 'replayed']
    if (Object.keys(plan).length !== keys.length || !keys.every((key) => key in plan)
        || ![plan.execution_id, plan.profile_id, plan.revision_id].every(uuid)
        || !['user_feature', 'user_default', 'system_feature', 'system_default', 'explicit'].includes(plan.resolution_source as string)
        || !['platform', 'user_byok'].includes(plan.credential_mode as string) || typeof plan.replayed !== 'boolean'
        || !Array.isArray(value.messages) || (document && !Array.isArray(value.applied_actions))) return false
    const messages = value.messages
    const roles = document ? ['user', 'assistant', 'tool'] : ['user', 'assistant']
    const terminal = document ? [value.user_message, value.assistant_message, value.tool_message] : [value.user_message, value.assistant_message]
    const count = terminal.length
    if (!terminal.every((message, index) => object(message) && message.role === roles[index]
        && message.status === 'completed' && object(message.metadata))) return false
    const first = terminal[0] as Record<string, unknown>
    const firstSequence = first.sequence_no
    const assistant = terminal[1] as Record<string, unknown>
    const tool = document ? terminal[2] as Record<string, unknown> : null
    const userMetadata = first.metadata as Record<string, unknown>
    const assistantMetadata = assistant.metadata as Record<string, unknown>
    const attempt = assistantMetadata.execution_attempt
    const retry = attempt !== undefined
    if (!positiveId(firstSequence) || assistantMetadata.request_id !== requestId
        || (tool && (tool.metadata as Record<string, unknown>).request_id !== requestId)) return false
    if (retry) {
        if (!object(attempt) || Object.keys(attempt).sort().join(',') !== 'execution_id,origin_request_id,parent_execution_id,user_message_id'
            || attempt.execution_id !== plan.execution_id || !uuid(attempt.parent_execution_id)
            || attempt.parent_execution_id === plan.execution_id || attempt.user_message_id !== first.message_id
            || typeof attempt.origin_request_id !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(attempt.origin_request_id)
            || attempt.origin_request_id === requestId || userMetadata.request_id !== attempt.origin_request_id
            || !positiveId(assistant.sequence_no) || assistant.sequence_no <= firstSequence + 1
            || (tool && tool.sequence_no !== assistant.sequence_no + 1)) return false
    } else if (userMetadata.request_id !== requestId
        || !terminal.every((message, index) => (message as Record<string, unknown>).sequence_no === firstSequence + index)) return false
    const ids = new Set<number>()
    let sequence = 0
    for (const message of messages) {
        if (!object(message) || Object.keys(message).some((key) => !messageFields.has(key))
            || !positiveId(message.message_id) || ids.has(message.message_id) || !positiveId(message.sequence_no)
            || message.sequence_no <= sequence || message.conversation_id !== conversationId
            || typeof message.content !== 'string' || ![...roles, 'system'].includes(message.role as string)
            || !['completed', 'failed'].includes(message.status as string)) return false
        ids.add(message.message_id); sequence = message.sequence_no
    }
    // A linked retry keeps the original user message earlier in the history.
    const tail = messages.slice(retry ? -(count - 1) : -count)
    if (retry) {
        const originIndex = messages.findIndex((message) => object(message) && message.message_id === first.message_id)
        const predecessor = messages[messages.length - count]
        if (originIndex < 0 || !object(predecessor) || predecessor.role !== 'assistant' || predecessor.status !== 'failed'
            || !object(predecessor.metadata) || predecessor.sequence_no !== (assistant.sequence_no as number) - 1
            || messages.slice(originIndex + 1).some((message) => object(message) && message.role === 'user')) return false
        const parentAttempt = predecessor.metadata.execution_attempt
        if (parentAttempt !== undefined ? !object(parentAttempt) || parentAttempt.execution_id !== (attempt as Record<string, unknown>).parent_execution_id
            : predecessor.metadata.request_id !== userMetadata.request_id) return false
    }
    return tail.length === (retry ? count - 1 : count) && terminal.every((message, index) => {
        if (!object(message) || Object.keys(message).some((key) => !messageFields.has(key)) || !positiveId(message.message_id)) return false
        const stored = retry && index === 0 ? messages.find((row) => object(row) && row.message_id === message.message_id)
            : tail[index - (retry ? 1 : 0)]
        return object(stored) && ['message_id', 'sequence_no', 'conversation_id', 'role', 'status', 'content'].every((key) => stored[key] === message[key])
            && object(stored.metadata) && stored.metadata.request_id === (index === 0 ? userMetadata.request_id : requestId)
            && JSON.stringify(stored.metadata) === JSON.stringify(message.metadata)
    })
}
