import type { PageType } from './types'

export type FrontendFeatureFlag =
    | 'communityCards'
    | 'lorebooks'
    | 'lorebookResources'
    | 'voices'
    | 'calls'
    | 'novels'
    | 'groupChats'
    | 'adventures'
    | 'appAssistant'
    | 'workspaces'

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

export function isAdventuresFeatureEnabled(): boolean {
    return envFlag('VITE_FEATURE_ADVENTURES_ENABLED')
}

/** The app-wide assistant chat (`#/assistant`); off until the BFF serves the `app` kind of `/assistant/conversations`. */
export function isAppAssistantFeatureEnabled(): boolean {
    return envFlag('VITE_FEATURE_APP_ASSISTANT_ENABLED')
}

/**
 * Workspace R1 product surfaces (Library, switcher, collections, create/archive
 * workspace). The workspace transport itself is always on: with this flag off
 * every private request still carries the protected default workspace, the
 * startup handshake still runs, and a user who already has other workspaces
 * sees a notice that their content is safe.
 */
export function isWorkspacesFeatureEnabled(): boolean {
    return envFlag('VITE_FEATURE_WORKSPACES_ENABLED')
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
        case 'adventures':
            return isAdventuresFeatureEnabled()
        case 'appAssistant':
            return isAppAssistantFeatureEnabled()
        case 'workspaces':
            return isWorkspacesFeatureEnabled()
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
        case 'adventure':
        case 'gallery-adventures':
        case 'active-adventures':
        case 'interaction':
            return isAdventuresFeatureEnabled()
        case 'assistant':
            return isAppAssistantFeatureEnabled()
        case 'library':
            return isWorkspacesFeatureEnabled()
        default:
            return true
    }
}


/** Disable during rollout until the BFF streaming routes are deployed. Chosen before POST. */
export function isTextStreamingFeatureEnabled(): boolean {
    return import.meta.env.VITE_FEATURE_TEXT_STREAMING_ENABLED !== 'false'
}
