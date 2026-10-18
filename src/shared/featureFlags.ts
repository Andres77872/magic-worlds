import type { BackgroundTaskPublic, LlmFeature, PageType } from './types'

import { isActiveFeatureEnabled } from './featureFlagRuntime'
import type { ActiveFeatureFlag } from './featureFlagCatalog'

export type FrontendFeatureFlag = ActiveFeatureFlag

/** Active rollout permission. Missing/null grants are off; root bypasses. */
export const isFeatureEnabled = isActiveFeatureEnabled

export function isCommunityCardsFeatureEnabled(): boolean {
    return isFeatureEnabled('communityCards')
}

export function isLorebooksFeatureEnabled(): boolean {
    return isFeatureEnabled('lorebooks')
}

export function isLorebookResourcesFeatureEnabled(): boolean {
    return isFeatureEnabled('lorebookResources')
}

export function isVoicesFeatureEnabled(): boolean {
    return isFeatureEnabled('voices')
}

export function isCallsFeatureEnabled(): boolean {
    return isFeatureEnabled('calls')
}

export function isNovelsFeatureEnabled(): boolean {
    return isFeatureEnabled('novels')
}

export function isGroupChatsFeatureEnabled(): boolean {
    return isFeatureEnabled('groupChats')
}

export function isAdventuresFeatureEnabled(): boolean {
    return isFeatureEnabled('adventures')
}

/** The app-wide assistant chat (`#/assistant`); off until the BFF serves the `app` kind of `/assistant/conversations`. */
export function isAppAssistantFeatureEnabled(): boolean {
    return isFeatureEnabled('appAssistant')
}

const CONTENT_FEATURES: Record<string, FrontendFeatureFlag> = {
    adventure: 'adventures', adventure_template: 'adventures', adventure_session: 'adventures',
    lorebook: 'lorebooks', lorebook_entry: 'lorebooks',
    resource: 'lorebookResources',
    story: 'novels', novel: 'novels',
    character_group: 'groupChats',
}

/** Shared by mixed listings, card pickers, imports and generic card actions. */
export function isContentTypeFeatureEnabled(type: string): boolean {
    const feature = Object.prototype.hasOwnProperty.call(CONTENT_FEATURES, type) ? CONTENT_FEATURES[type] : undefined
    return !feature || isFeatureEnabled(feature)
}

export const LIBRARY_CARD_TYPES = ['character', 'world', 'item', 'adventure_template'] as const

/** Raw collection totals are displayable only when every counted kind is available. */
export function isLibraryCardCountAvailable(): boolean {
    return LIBRARY_CARD_TYPES.every(isContentTypeFeatureEnabled)
}

/** The usage DTO combines adventures and all chat kinds without a breakdown. */
export function isSessionUsageCountAvailable(): boolean {
    return isAdventuresFeatureEnabled() && isGroupChatsFeatureEnabled()
}

const LLM_FEATURES: Partial<Record<LlmFeature, FrontendFeatureFlag>> = {
    novel: 'novels', chat_adventure: 'adventures', chat_group: 'groupChats',
    lorebook_assistant: 'lorebooks', lorebook_extraction: 'lorebookResources',
    novel_assistant:'novels', app_assistant: 'appAssistant', callbot: 'calls',
}

export function isLlmFeatureEnabled(feature: LlmFeature): boolean {
    const owner = LLM_FEATURES[feature]
    return !owner || isFeatureEnabled(owner)
}

/** Task and membership-operation names use different transport vocabularies. */
const OPERATION_FEATURES: Record<string, FrontendFeatureFlag> = {
    tts: 'voices', tts_job: 'voices', text_to_speech: 'voices', tts_generation: 'voices', voice_preview: 'voices', voice_call: 'calls',
    pdf_import: 'lorebookResources', lorebook_extraction: 'lorebookResources',
    lorebook_resource_extraction: 'lorebookResources',
}

export function isOperationFeatureEnabled(operation: string): boolean {
    const feature = Object.prototype.hasOwnProperty.call(OPERATION_FEATURES, operation) ? OPERATION_FEATURES[operation] : undefined
    return !feature || isFeatureEnabled(feature)
}

export function isTaskFeatureEnabled(task: Pick<BackgroundTaskPublic, 'operation' | 'target'>): boolean {
    return isOperationFeatureEnabled(task.operation) && isContentTypeFeatureEnabled(task.target.type)
}

export function assertFeatureEnabled(feature: FrontendFeatureFlag): void {
    if (!isFeatureEnabled(feature)) throw new Error(FEATURE_DISABLED_MESSAGES[feature])
}

const FEATURE_DISABLED_MESSAGES: Record<FrontendFeatureFlag, string> = {
    communityCards: 'Community card sharing is disabled.', lorebooks: 'Lorebooks are disabled.',
    lorebookResources: 'Lorebook resources are disabled.', voices: 'Voices are disabled.',
    calls: 'Calls are disabled.', novels: 'Novels are disabled.', groupChats: 'Group chats are disabled.',
    adventures: 'Adventures are disabled.', appAssistant: 'The app assistant is disabled.',
}

export function assertContentTypeFeatureEnabled(type: string): void {
    const feature = Object.prototype.hasOwnProperty.call(CONTENT_FEATURES, type) ? CONTENT_FEATURES[type] : undefined
    if (feature) assertFeatureEnabled(feature)
}

export function assertLlmFeatureEnabled(feature: LlmFeature): void {
    const owner = LLM_FEATURES[feature]
    if (owner) assertFeatureEnabled(owner)
}

export function isPageFeatureEnabled(page: PageType): boolean {
    switch (page) {
        case 'community':
        case 'shared-card':
            return isCommunityCardsFeatureEnabled()
        case 'lorebook':
        case 'gallery-lorebooks':
            return isLorebooksFeatureEnabled()
        case 'gallery-resources':
            return isLorebookResourcesFeatureEnabled()
        case 'voice-studio':
            return isVoicesFeatureEnabled()
        case 'calls':
            return isCallsFeatureEnabled()
        case 'story':
        case 'gallery-stories':
            return isNovelsFeatureEnabled()
        case 'adventure':
        case 'gallery-adventures':
        case 'active-adventures':
        case 'interaction':
            return isAdventuresFeatureEnabled()
        case 'assistant':
            return isAppAssistantFeatureEnabled()
        default:
            return true
    }
}
