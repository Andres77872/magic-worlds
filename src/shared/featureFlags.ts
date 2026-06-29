import type { PageType } from './types'

export type FrontendFeatureFlag =
    | 'communityCards'
    | 'lorebooks'
    | 'lorebookResources'
    | 'voices'
    | 'calls'
    | 'novels'
    | 'groupChats'

function envFlag(name: string): boolean {
    return import.meta.env[name] === 'true'
}

export function isCommunityCardsFeatureEnabled(): boolean {
    return envFlag('VITE_FEATURE_COMMUNITY_CARDS_ENABLED')
}

export function isLorebooksFeatureEnabled(): boolean {
    return envFlag('VITE_FEATURE_LOREBOOKS_ENABLED')
}

export function isLorebookResourcesFeatureEnabled(): boolean {
    return isLorebooksFeatureEnabled() && envFlag('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED')
}

export function isVoicesFeatureEnabled(): boolean {
    return envFlag('VITE_FEATURE_VOICES_ENABLED')
}

export function isCallsFeatureEnabled(): boolean {
    return envFlag('VITE_FEATURE_CALLS_ENABLED')
}

export function isNovelsFeatureEnabled(): boolean {
    return envFlag('VITE_FEATURE_NOVELS_ENABLED')
}

export function isGroupChatsFeatureEnabled(): boolean {
    return envFlag('VITE_FEATURE_GROUP_CHATS_ENABLED')
}

export function isFeatureEnabled(feature: FrontendFeatureFlag): boolean {
    switch (feature) {
        case 'communityCards':
            return isCommunityCardsFeatureEnabled()
        case 'lorebooks':
            return isLorebooksFeatureEnabled()
        case 'lorebookResources':
            return isLorebookResourcesFeatureEnabled()
        case 'voices':
            return isVoicesFeatureEnabled()
        case 'calls':
            return isCallsFeatureEnabled()
        case 'novels':
            return isNovelsFeatureEnabled()
        case 'groupChats':
            return isGroupChatsFeatureEnabled()
    }
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
        case 'admin-voices':
            return isVoicesFeatureEnabled()
        case 'calls':
            return isCallsFeatureEnabled()
        case 'story':
        case 'gallery-stories':
            return isNovelsFeatureEnabled()
        default:
            return true
    }
}

