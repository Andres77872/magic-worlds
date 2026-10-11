import { describe, expect, it } from 'vitest'
import { takeAssistantConversation, withAssistantConversation } from './assistantHandoff'

describe('assistant hand-off links', () => {
    it('adds the conversation to an editor route and takes it back out', () => {
        const hash = withAssistantConversation('#/character?card=c1', 12)
        expect(hash).toBe('#/character?card=c1&assistant=12')
        expect(takeAssistantConversation(hash)).toEqual({ conversationId: 12, hash: '#/character?card=c1' })
    })

    it('works on a route without a query', () => {
        const hash = withAssistantConversation('#/lorebook', 4)
        expect(hash).toBe('#/lorebook?assistant=4')
        expect(takeAssistantConversation(hash)).toEqual({ conversationId: 4, hash: '#/lorebook' })
    })

    it.each(['#/lorebook', '#/world?card=w1', '#/item?assistant=0', '#/item?assistant=abc', '#/item?assistant=1.5', ''])(
        'hands nothing off for %j',
        (hash) => {
            expect(takeAssistantConversation(hash)).toBeNull()
        },
    )
})
