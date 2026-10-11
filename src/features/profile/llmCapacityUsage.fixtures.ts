/** `GET /llm/capacity-usage` fixtures shared by the Usage tab stories and tests. */
import type { LlmCapacityUsage, LlmOperationCapacityUsage } from '@/shared/types/llmProfile.types'

const zero = { platform: 0, user_byok: 0, unattributed: 0 }

function operation(name: string, features: LlmOperationCapacityUsage['features'], byok: boolean,
    counts: Partial<Pick<LlmOperationCapacityUsage, 'today' | 'month'>> = {}): LlmOperationCapacityUsage {
    return { operation: name, features, byok_enabled: byok, app_credit_billed: byok, today: counts.today ?? zero, month: counts.month ?? zero }
}

/** Every LLM operation the server reports, all zero — an account that never used BYOK. */
export const emptyCapacityUsage: LlmCapacityUsage = {
    usage_day: '2026-06-10',
    month_start: '2026-06-01',
    operations: [
        operation('ai_card_generation', ['card_assistant', 'card_generation', 'lorebook_assistant', 'novel'], true),
        operation('chat_interaction', ['chat_adventure', 'chat_character', 'chat_group'], true),
        operation('image_generation', ['image_prompt'], false),
        operation('lorebook_resource_extraction', ['lorebook_extraction'], true),
        operation('theme_song_generation', ['theme_song_writer'], false),
        operation('voice_call', ['callbot'], false),
    ],
}

/** BYOK chat and story work alongside platform requests and converted card history. */
export const activeCapacityUsage: LlmCapacityUsage = {
    ...emptyCapacityUsage,
    operations: emptyCapacityUsage.operations.map((item) => {
        if (item.operation === 'chat_interaction') {
            return { ...item, today: { platform: 2, user_byok: 7, unattributed: 0 }, month: { platform: 20, user_byok: 64, unattributed: 0 } }
        }
        if (item.operation === 'ai_card_generation') {
            return { ...item, today: { platform: 0, user_byok: 1, unattributed: 0 }, month: { platform: 3, user_byok: 12, unattributed: 5 } }
        }
        return item
    }),
}
