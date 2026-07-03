import { describe, expect, it } from 'vitest'
import type { Character, CharacterChatSession } from '@/shared'
import { chatDisplayTitle } from './chatTitle'

const LYRA = { id: 'c1', name: 'Lyra', stats: {}, role: 'character' } as Character
const SABLE = { id: 'c2', name: 'Sable', stats: {}, role: 'character' } as Character

describe('chatDisplayTitle', () => {
    it('prefers the room title over cast names', () => {
        const chat = { id: '1', kind: 'character_group', title: 'Lyra, Sable +1', characters: [LYRA, SABLE] } as CharacterChatSession
        expect(chatDisplayTitle(chat)).toBe('Lyra, Sable +1')
    })

    it('joins group cast names when there is no title', () => {
        const chat = { id: '1', kind: 'character_group', characters: [LYRA, SABLE] } as CharacterChatSession
        expect(chatDisplayTitle(chat)).toBe('Lyra, Sable')
    })

    it('uses the single character name for 1:1 chats', () => {
        const chat = { id: '1', character: LYRA } as CharacterChatSession
        expect(chatDisplayTitle(chat)).toBe('Lyra')
    })

    it('returns an empty string when nothing is available, so callers can localize the fallback', () => {
        expect(chatDisplayTitle({ id: '1' } as CharacterChatSession)).toBe('')
        expect(chatDisplayTitle(null)).toBe('')
        expect(chatDisplayTitle(undefined)).toBe('')
    })
})
