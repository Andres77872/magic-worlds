import type { LlmCapacityUsage } from '@/shared/types/llmProfile.types'

export const personalCapacityUsage: LlmCapacityUsage = {
    usage_day: '2026-10-09', month_start: '2026-10-01',
    operations: [{
        operation: 'chat_interaction', features: ['chat_adventure', 'chat_character', 'chat_group'],
        byok_enabled: true, app_credit_billed: true,
        today: { platform: 1, user_byok: 2, unattributed: 0 },
        month: { platform: 4, user_byok: 9, unattributed: 3 },
    }, {
        operation: 'image_generation', features: ['image_prompt'], byok_enabled: false, app_credit_billed: false,
        today: { platform: 0, user_byok: 0, unattributed: 0 },
        month: { platform: 0, user_byok: 0, unattributed: 0 },
    }],
}
