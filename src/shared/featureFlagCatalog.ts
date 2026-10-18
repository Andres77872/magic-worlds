/** Generated from the BFF active catalog. Regenerate with scripts/sync-feature-flags.mjs. */
export const FEATURE_FLAG_SCHEMA_VERSION = 1
export const ACTIVE_FEATURE_FLAGS = {
    "communityCards": {
        "requires": []
    },
    "lorebooks": {
        "requires": []
    },
    "lorebookResources": {
        "requires": [
            "lorebooks"
        ]
    },
    "voices": {
        "requires": []
    },
    "calls": {
        "requires": [
            "voices"
        ]
    },
    "novels": {
        "requires": []
    },
    "groupChats": {
        "requires": []
    },
    "adventures": {
        "requires": []
    },
    "appAssistant": {
        "requires": []
    }
} as const
export type ActiveFeatureFlag = keyof typeof ACTIVE_FEATURE_FLAGS
export const ACTIVE_FEATURE_KEYS = Object.keys(ACTIVE_FEATURE_FLAGS) as ActiveFeatureFlag[]
