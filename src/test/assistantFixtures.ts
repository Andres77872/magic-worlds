import type { CardAssistantMessage, CardAssistantTurnResponse } from '@/shared/types/aiCard.types'

/** Complete assistant result, including the frozen execution provenance. */
export function cardAssistantTurnFixture(
    requestId: string,
    overrides: Partial<CardAssistantTurnResponse> = {},
): CardAssistantTurnResponse {
    const conversation = overrides.conversation ?? { conversation_id: 2, card_type: 'world', card_id: null, active_request_id: null }
    const base = { conversation_id: conversation.conversation_id, status: 'completed' as const, metadata: { request_id: requestId } }
    const user: CardAssistantMessage = overrides.user_message ?? { ...base, message_id: 20, sequence_no: 1, role: 'user', content: 'Generate it' }
    const assistant: CardAssistantMessage = overrides.assistant_message ?? { ...base, message_id: 21, sequence_no: 2, role: 'assistant', content: 'Done.',
        tool_name: 'mw_no_card_change', tool_calls: [{ id: 'call-test', type: 'function', function: { name: 'mw_no_card_change', arguments: '{"response":"Done."}' } }] }
    const tool: CardAssistantMessage = overrides.tool_message ?? { ...base, message_id: 22, sequence_no: 3, role: 'tool', content: '{"applied_actions":[]}', tool_call_id: 'call-test', tool_name: 'mw_no_card_change' }
    return {
        request_id: requestId,
        llm_execution: { execution_id: '11111111-1111-4111-8111-111111111111', profile_id: '22222222-2222-4222-8222-222222222222',
            revision_id: '33333333-3333-4333-8333-333333333333', resolution_source: 'system_default', credential_mode: 'platform', replayed: false },
        conversation, user_message: user, assistant_message: assistant, tool_message: tool,
        messages: [user, assistant, tool], card: null, applied_actions: [], target_cas: null,
        ...overrides,
    }
}
