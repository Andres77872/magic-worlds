/** Shared Storybook fixtures for the card assistant module. Not shipped in the app bundle. */

import type { CardAssistantConversation, CardAssistantMessage } from '@/shared/types/aiCard.types'
import type { AssistantTurn } from './useCardAssistant'

let sequence = 0

export function assistantMessage(overrides: Partial<CardAssistantMessage>): CardAssistantMessage {
    sequence += 1
    return {
        message_id: sequence,
        conversation_id: 1,
        sequence_no: sequence,
        role: 'user',
        status: 'completed',
        content: '',
        created_at: '2026-06-10T18:42:00Z',
        ...overrides,
    }
}

export function turn(overrides: {
    message: Partial<CardAssistantMessage>
    appliedChanges?: AssistantTurn['appliedChanges']
    isStreaming?: boolean
    isInterrupted?: boolean
}): AssistantTurn {
    return {
        message: assistantMessage(overrides.message),
        appliedChanges: overrides.appliedChanges ?? [],
        isStreaming: overrides.isStreaming ?? false,
        isInterrupted: overrides.isInterrupted ?? false,
    }
}

export const SAMPLE_CONVERSATION_TURNS: AssistantTurn[] = [
    turn({ message: { role: 'user', content: 'Invent a desert world made of glass.' } }),
    turn({
        message: {
            role: 'assistant',
            content:
                'I drafted **The Vitrine Expanse** — an endless sea of fused sand where storms polish the dunes to mirrors.\n\n- **Type:** desert\n- **Triggers:** glass, desert, mirage\n\nWant me to deepen the factions next?',
        },
        appliedChanges: [{ kind: 'replace', cardId: 'world-1', fields: [] }],
    }),
    turn({ message: { role: 'user', content: 'Yes — add a faction that harvests the glass.' } }),
    turn({
        message: {
            role: 'assistant',
            content:
                'Added the *Shardwrights* — nomadic artisans who carve caravans straight out of the dunes. The description and triggers now mention them.',
        },
        appliedChanges: [{ kind: 'patch', cardId: 'world-1', fields: ['description', 'triggers'] }],
    }),
]

export function conversation(overrides: Partial<CardAssistantConversation> = {}): CardAssistantConversation {
    return {
        conversation_id: 1,
        card_type: 'world',
        card_id: 'world-1',
        title: 'The Vitrine Expanse',
        updated_at: new Date(Date.now() - 6 * 60_000).toISOString(),
        ...overrides,
    }
}

export const SAMPLE_CONVERSATIONS: CardAssistantConversation[] = [
    conversation(),
    conversation({
        conversation_id: 2,
        title: 'Glassworm ecology brainstorm',
        updated_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    }),
    conversation({
        conversation_id: 3,
        title: null,
        updated_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    }),
]
