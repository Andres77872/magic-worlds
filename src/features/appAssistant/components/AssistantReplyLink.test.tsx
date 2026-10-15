import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FRONTEND_FEATURE_ENV } from '@/shared/featureFlags'
import { availableAssistantSuggestions } from '../assistantSuggestions'
import { isAssistantLinkFeatureEnabled } from '../replyLinks'
import { AssistantReplyLink } from './AssistantReplyLink'

beforeEach(() => { for (const env of Object.values(FRONTEND_FEATURE_ENV)) vi.stubEnv(env, 'true') })
afterEach(() => vi.unstubAllEnvs())

describe('assistant availability with mixed product flags', () => {
    it('offers only available product starters while the guide and library stay usable', () => {
        vi.stubEnv(FRONTEND_FEATURE_ENV.voices, 'false')
        vi.stubEnv(FRONTEND_FEATURE_ENV.adventures, 'false')
        vi.stubEnv(FRONTEND_FEATURE_ENV.lorebooks, 'false')
        expect(availableAssistantSuggestions(['guide', 'library', 'lorebooks', 'resources']).map(item => item.key)).toEqual(['tour', 'library'])
    })

    it.each(['#/voices', '#/calls', '#/gallery/adventures?card=old', '#/lorebook?lorebook=old', '#/story?story=old',
        '#/gallery/resources?resource=old', '#/community', '#/assistant', '#/library'])(
        'keeps historical prose but removes the unavailable link %s', (href) => {
            for (const env of Object.values(FRONTEND_FEATURE_ENV)) vi.stubEnv(env, 'false')
            const message = { href, text: 'Stored historical reference' }
            const original = structuredClone(message)
            render(<AssistantReplyLink href={message.href}>{message.text}</AssistantReplyLink>)
            expect(screen.getByText(message.text)).toBeInTheDocument()
            expect(screen.queryByRole('link')).not.toBeInTheDocument()
            expect(message).toEqual(original)
        },
    )

    it('keeps narration-related navigation when voices are on but calls are off', () => {
        vi.stubEnv(FRONTEND_FEATURE_ENV.calls, 'false')
        expect(availableAssistantSuggestions(['guide']).map(item => item.key)).toContain('voices')
        expect(isAssistantLinkFeatureEnabled('#/voices')).toBe(true)
        expect(isAssistantLinkFeatureEnabled('#/calls')).toBe(false)
        render(<AssistantReplyLink href="#/voices">Voice studio</AssistantReplyLink>)
        expect(screen.getByRole('link', { name: 'Voice studio' })).toHaveAttribute('href', '#/voices')
    })

    it('checks same-origin absolute links and leaves external and core links intact', () => {
        vi.stubEnv(FRONTEND_FEATURE_ENV.voices, 'false')
        expect(isAssistantLinkFeatureEnabled(`${window.location.origin}/#/voices`)).toBe(false)
        expect(isAssistantLinkFeatureEnabled('https://example.com/#/voices')).toBe(true)
        expect(isAssistantLinkFeatureEnabled('#/gallery/characters?card=character')).toBe(true)
    })

    it('blocks disabled public and group gallery modes while keeping ordinary character links', () => {
        vi.stubEnv(FRONTEND_FEATURE_ENV.communityCards, 'false')
        vi.stubEnv(FRONTEND_FEATURE_ENV.groupChats, 'false')
        expect(isAssistantLinkFeatureEnabled('#/gallery/characters?view=public')).toBe(false)
        expect(isAssistantLinkFeatureEnabled('#/gallery/characters?mode=group-chat')).toBe(false)
        expect(isAssistantLinkFeatureEnabled('#/gallery/characters?card=old')).toBe(true)
    })
})
