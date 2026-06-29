import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    isCallsFeatureEnabled,
    isCommunityCardsFeatureEnabled,
    isFeatureEnabled,
    isGroupChatsFeatureEnabled,
    isLorebookResourcesFeatureEnabled,
    isLorebooksFeatureEnabled,
    isNovelsFeatureEnabled,
    isPageFeatureEnabled,
    isVoicesFeatureEnabled,
} from './featureFlags'
import { isFrontendVoiceModeEnabled } from './voiceFeatureFlag'

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('frontend feature flags', () => {
    it('enables each feature only for the exact string "true"', () => {
        const cases = [
            ['VITE_FEATURE_COMMUNITY_CARDS_ENABLED', isCommunityCardsFeatureEnabled],
            ['VITE_FEATURE_LOREBOOKS_ENABLED', isLorebooksFeatureEnabled],
            ['VITE_FEATURE_VOICES_ENABLED', isVoicesFeatureEnabled],
            ['VITE_FEATURE_CALLS_ENABLED', isCallsFeatureEnabled],
            ['VITE_FEATURE_NOVELS_ENABLED', isNovelsFeatureEnabled],
            ['VITE_FEATURE_GROUP_CHATS_ENABLED', isGroupChatsFeatureEnabled],
        ] as const

        for (const [envName, read] of cases) {
            vi.stubEnv(envName, 'true')
            expect(read()).toBe(true)

            for (const value of ['false', '1', 'TRUE', 'yes', '']) {
                vi.stubEnv(envName, value)
                expect(read()).toBe(false)
            }

            vi.stubEnv(envName, undefined as unknown as string)
            expect(read()).toBe(false)
        }
    })

    it('requires both lorebook and resource flags for lorebook resources', () => {
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', 'true')
        expect(isLorebookResourcesFeatureEnabled()).toBe(false)

        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
        expect(isLorebookResourcesFeatureEnabled()).toBe(true)
    })

    it('maps page availability through the owning feature', () => {
        expect(isPageFeatureEnabled('character-chat')).toBe(true)
        expect(isPageFeatureEnabled('interaction')).toBe(true)
        expect(isPageFeatureEnabled('community')).toBe(false)
        expect(isPageFeatureEnabled('gallery-lorebooks')).toBe(false)
        expect(isPageFeatureEnabled('gallery-resources')).toBe(false)
        expect(isPageFeatureEnabled('voice-studio')).toBe(false)
        expect(isPageFeatureEnabled('calls')).toBe(false)
        expect(isPageFeatureEnabled('gallery-stories')).toBe(false)

        vi.stubEnv('VITE_FEATURE_COMMUNITY_CARDS_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'true')

        expect(isPageFeatureEnabled('community')).toBe(true)
        expect(isPageFeatureEnabled('gallery-lorebooks')).toBe(true)
        expect(isPageFeatureEnabled('voice-studio')).toBe(true)
        expect(isPageFeatureEnabled('calls')).toBe(true)
        expect(isPageFeatureEnabled('gallery-stories')).toBe(true)
    })

    it('keeps the legacy voice helper pointed at the calls flag', () => {
        vi.stubEnv('VITE_VOICE_MODE_ENABLED', 'true')
        expect(isFrontendVoiceModeEnabled()).toBe(false)

        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
        expect(isFrontendVoiceModeEnabled()).toBe(true)
        expect(isFeatureEnabled('calls')).toBe(true)
    })
})
