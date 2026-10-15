import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    FRONTEND_FEATURE_ENV,
    isAppAssistantFeatureEnabled,
    isContentTypeFeatureEnabled,
    isLlmFeatureEnabled,
    isOperationFeatureEnabled,
    isAdventuresFeatureEnabled,
    isCallsFeatureEnabled,
    isCommunityCardsFeatureEnabled,
    isFeatureEnabled,
    isGroupChatsFeatureEnabled,
    isLorebookResourcesFeatureEnabled,
    isLorebooksFeatureEnabled,
    isNovelsFeatureEnabled,
    isPageFeatureEnabled,
    isVoicesFeatureEnabled,
    isWorkspacesFeatureEnabled,
} from './featureFlags'
import { isFrontendVoiceModeEnabled } from './voiceFeatureFlag'

beforeEach(() => {
    for (const name of Object.values(FRONTEND_FEATURE_ENV)) vi.stubEnv(name, 'true')
})

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('frontend feature flags', () => {
    it('enables each feature only for the exact string "true"', () => {
        const cases = [
            ['VITE_FEATURE_APP_ASSISTANT_ENABLED', isAppAssistantFeatureEnabled],
            ['VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', isLorebookResourcesFeatureEnabled],
            ['VITE_FEATURE_COMMUNITY_CARDS_ENABLED', isCommunityCardsFeatureEnabled],
            ['VITE_FEATURE_LOREBOOKS_ENABLED', isLorebooksFeatureEnabled],
            ['VITE_FEATURE_VOICES_ENABLED', isVoicesFeatureEnabled],
            ['VITE_FEATURE_CALLS_ENABLED', isCallsFeatureEnabled],
            ['VITE_FEATURE_NOVELS_ENABLED', isNovelsFeatureEnabled],
            ['VITE_FEATURE_GROUP_CHATS_ENABLED', isGroupChatsFeatureEnabled],
            ['VITE_FEATURE_ADVENTURES_ENABLED', isAdventuresFeatureEnabled],
            ['VITE_FEATURE_WORKSPACES_ENABLED', isWorkspacesFeatureEnabled],
        ] as const

        for (const [envName, read] of cases) {
            for (const name of Object.values(FRONTEND_FEATURE_ENV)) vi.stubEnv(name, 'true')
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
        vi.stubEnv('VITE_FEATURE_COMMUNITY_CARDS_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'false')
        expect(isPageFeatureEnabled('character-chat')).toBe(true)
        expect(isPageFeatureEnabled('adventure')).toBe(false)
        expect(isPageFeatureEnabled('gallery-adventures')).toBe(false)
        expect(isPageFeatureEnabled('active-adventures')).toBe(false)
        expect(isPageFeatureEnabled('interaction')).toBe(false)
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
        vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'true')

        expect(isPageFeatureEnabled('community')).toBe(true)
        expect(isPageFeatureEnabled('gallery-lorebooks')).toBe(true)
        expect(isPageFeatureEnabled('voice-studio')).toBe(true)
        expect(isPageFeatureEnabled('calls')).toBe(true)
        expect(isPageFeatureEnabled('gallery-stories')).toBe(true)
        expect(isPageFeatureEnabled('adventure')).toBe(true)
        expect(isPageFeatureEnabled('gallery-adventures')).toBe(true)
        expect(isPageFeatureEnabled('active-adventures')).toBe(true)
        expect(isPageFeatureEnabled('interaction')).toBe(true)
    })

    it('keeps the voice helper pointed at the calls flag', () => {
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
        expect(isFrontendVoiceModeEnabled()).toBe(true)
        expect(isFeatureEnabled('calls')).toBe(true)
    })
})


describe('composed frontend availability', () => {
    it('honors parent gates across every combination of the ten product switches', () => {
        const entries = Object.entries(FRONTEND_FEATURE_ENV)
        for (let bits = 0; bits < 1024; bits++) {
            const raw = Object.fromEntries(entries.map(([feature, env], index) => {
                const enabled = Boolean(bits & (1 << index))
                vi.stubEnv(env, String(enabled))
                return [feature, enabled]
            }))
            const calls = raw.voices && raw.calls
            const resources = raw.lorebooks && raw.lorebookResources
            expect(isCallsFeatureEnabled()).toBe(calls)
            expect(isFrontendVoiceModeEnabled()).toBe(calls)
            expect(isPageFeatureEnabled('calls')).toBe(calls)
            expect(isLlmFeatureEnabled('callbot')).toBe(calls)
            expect(isOperationFeatureEnabled('voice_call')).toBe(calls)
            expect(isPageFeatureEnabled('voice-studio')).toBe(raw.voices)
            expect(isOperationFeatureEnabled('text_to_speech')).toBe(raw.voices)
            expect(isPageFeatureEnabled('gallery-resources')).toBe(resources)
            expect(isLlmFeatureEnabled('lorebook_extraction')).toBe(resources)
            expect(isContentTypeFeatureEnabled('resource')).toBe(resources)
            expect(isContentTypeFeatureEnabled('adventure_template')).toBe(raw.adventures)
            expect(isLlmFeatureEnabled('chat_group')).toBe(raw.groupChats)
            expect(isPageFeatureEnabled('story')).toBe(raw.novels)
            expect(isLlmFeatureEnabled('app_assistant')).toBe(raw.appAssistant)
            expect(isPageFeatureEnabled('library')).toBe(raw.workspaces)
            expect(isPageFeatureEnabled('character-chat')).toBe(true)
            expect(isContentTypeFeatureEnabled('character')).toBe(true)
        }
    })

    it('keeps unknown operation labels and ungated content available', () => {
        for (const name of Object.values(FRONTEND_FEATURE_ENV)) vi.stubEnv(name, 'false')
        expect(isOperationFeatureEnabled('constructor')).toBe(true)
        expect(isContentTypeFeatureEnabled('toString')).toBe(true)
        expect(isLlmFeatureEnabled('card_generation')).toBe(true)
        expect(isLlmFeatureEnabled('chat_character')).toBe(true)
    })
})
