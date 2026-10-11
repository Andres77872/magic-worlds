import type {
    AssistantChatMessage,
    AssistantConversation,
    AssistantKind,
    AssistantTurnResponse,
} from '@/shared/types/assistant.types'

const SCOPES: Record<AssistantKind, Partial<AssistantConversation>> = {
    card: { card_type: 'world', card_id: null },
    lorebook: { lorebook_id: null },
    app: {},
}

/** An idle conversation of one kind, with that kind's scope fields. */
export function assistantConversationFixture(kind: AssistantKind, overrides: Partial<AssistantConversation> = {}): AssistantConversation {
    return { conversation_id: 2, kind, ...SCOPES[kind], active_request_id: null, ...overrides }
}

/**
 * Complete assistant result, including the frozen execution provenance. The
 * document kinds end with a tool message; `app` ends with the reply.
 */
export function assistantTurnFixture<K extends AssistantKind>(
    kind: K,
    requestId: string,
    overrides: Partial<AssistantTurnResponse<K>> = {},
): AssistantTurnResponse<K> {
    const conversation = overrides.conversation ?? assistantConversationFixture(kind)
    const base = { conversation_id: conversation.conversation_id, status: 'completed' as const, metadata: { request_id: requestId } }
    const user: AssistantChatMessage = overrides.user_message ?? { ...base, message_id: 20, sequence_no: 1, role: 'user', content: 'Generate it' }
    const core = {
        request_id: requestId,
        llm_execution: { execution_id: '11111111-1111-4111-8111-111111111111', profile_id: '22222222-2222-4222-8222-222222222222',
            revision_id: '33333333-3333-4333-8333-333333333333', resolution_source: 'system_default' as const, credential_mode: 'platform' as const, replayed: false },
        conversation,
        user_message: user,
    }
    if (kind === 'app') {
        const assistant: AssistantChatMessage = overrides.assistant_message
            ?? { ...base, message_id: 21, sequence_no: 2, role: 'assistant', content: 'Done.', metadata: { request_id: requestId, usage: null } }
        return { ...core, assistant_message: assistant, messages: [user, assistant], ...overrides } as AssistantTurnResponse<K>
    }
    const tool_name = kind === 'card' ? 'mw_no_card_change' : 'mw_no_lorebook_change'
    const assistant: AssistantChatMessage = overrides.assistant_message ?? { ...base, message_id: 21, sequence_no: 2, role: 'assistant', content: 'Done.',
        tool_name, tool_calls: [{ id: 'call-test', type: 'function', function: { name: tool_name, arguments: '{"response":"Done."}' } }] }
    const documentOverrides = overrides as Partial<AssistantTurnResponse<'card' | 'lorebook'>>
    const tool: AssistantChatMessage = documentOverrides.tool_message
        ?? { ...base, message_id: 22, sequence_no: 3, role: 'tool', content: '{"applied_actions":[],"target_id":null}', tool_call_id: 'call-test', tool_name }
    return {
        ...core, assistant_message: assistant, tool_message: tool,
        messages: [user, assistant, tool], target: null, target_cas: null, applied_actions: [],
        ...overrides,
    } as AssistantTurnResponse<K>
}
