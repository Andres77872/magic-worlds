import type { LlmProfileCompatibility } from '@/shared/types/llmProfile.types'

/** A personal configuration whose metadata override lacks tool calling. */
export const mixedCompatibility: LlmProfileCompatibility = {
    configuration_issue: null,
    features: [
        { feature: 'novel', roles: ['primary'], compatible: true, issue: null },
        { feature: 'card_generation', roles: ['primary'], compatible: true, issue: null },
        { feature: 'chat_adventure', roles: ['primary', 'metadata', 'preflight'], compatible: false, issue: { code: 'PROFILE_INCOMPATIBLE', role: 'metadata' } },
        { feature: 'lorebook_extraction', roles: ['primary'], compatible: false, issue: { code: 'MODEL_CONTEXT_INSUFFICIENT', role: 'primary' } },
    ],
}

export const invalidConfiguration: LlmProfileCompatibility = {
    configuration_issue: { code: 'PROVIDER_MODEL_UNAVAILABLE', role: 'primary' }, features: [],
}
