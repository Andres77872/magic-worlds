import { describe, expect, it } from 'vitest'
import type { Adventure, CharacterChatSession } from '@/shared'
import { toResumeSessions } from './resumeModel'

const NOW = Date.parse('2026-06-12T12:00:00Z')

function adventure(overrides: Partial<Adventure>): Adventure {
    return {
        id: 'a1',
        scenario: 'The ember road',
        characters: [],
        turns: [],
        ...overrides,
    } as Adventure
}

function chat(overrides: Partial<CharacterChatSession>): CharacterChatSession {
    return {
        id: 'c1',
        character_id: 'ch1',
        character: { id: 'ch1', name: 'Lyra', race: 'human', stats: {} },
        turns: [],
        ...overrides,
    } as CharacterChatSession
}

describe('resumeModel', () => {
    it('merges adventures and chats newest-first', () => {
        const sessions = toResumeSessions(
            [
                adventure({ id: 'old', updatedAt: '2026-06-10 08:00:00' }),
                adventure({ id: 'newest', updatedAt: '2026-06-12 09:00:00' }),
            ],
            [chat({ id: 'mid', updatedAt: '2026-06-11 10:00:00' })],
            NOW,
        )
        expect(sessions.map((s) => s.id)).toEqual(['newest', 'mid', 'old'])
        expect(sessions.map((s) => s.kind)).toEqual(['adventure', 'chat', 'adventure'])
    })

    it('sorts untimestamped sessions after timestamped ones, later-appended first', () => {
        const sessions = toResumeSessions(
            [adventure({ id: 'no-stamp-1' }), adventure({ id: 'no-stamp-2' })],
            [chat({ id: 'stamped', updatedAt: '2026-06-01 00:00:00' })],
            NOW,
        )
        expect(sessions.map((s) => s.id)).toEqual(['stamped', 'no-stamp-2', 'no-stamp-1'])
    })

    it('derives adventure titles with snapshot/scenario/persona/world fallbacks', () => {
        const [fromSnapshot] = toResumeSessions(
            [
                adventure({
                    scenario: '',
                    snapshot: { template: { name: 'The Hollow Wood' } } as Adventure['snapshot'],
                }),
            ],
            [],
            NOW,
        )
        expect(fromSnapshot.title).toBe('The Hollow Wood')

        const [fromPersona] = toResumeSessions(
            [adventure({ scenario: '', persona: { id: 'p', name: 'Wren', race: 'fey', stats: {} } })],
            [],
            NOW,
        )
        expect(fromPersona.title).toBe("Wren's adventure")

        const [untitled] = toResumeSessions([adventure({ scenario: '' })], [], NOW)
        expect(untitled.title).toBe('Untitled session')
    })

    it('builds snippet from the last non-empty turn and a mono meta line', () => {
        const [session] = toResumeSessions(
            [
                adventure({
                    updatedAt: '2026-06-12 10:00:00',
                    turns: [
                        { type: 'narration', content: 'The door creaks open.' },
                        { type: 'narration', content: '   ' },
                    ] as unknown as Adventure['turns'],
                }),
            ],
            [],
            NOW,
        )
        expect(session.snippet).toBe('The door creaks open.')
        expect(session.meta).toContain('2 turns')
    })

    it('labels chat meta in messages and falls back when empty', () => {
        const [withTurns] = toResumeSessions(
            [],
            [chat({ turns: [{ type: 'dialogue', content: 'Hello.' }] as unknown as CharacterChatSession['turns'] })],
            NOW,
        )
        expect(withTurns.meta).toContain('1 message')

        const [empty] = toResumeSessions([], [chat({})], NOW)
        expect(empty.meta).toBe('Ready to continue')
    })
})
