import { describe, expect, it } from 'vitest'
import type { Adventure, CharacterChatSession, Story } from '@/shared'
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

function story(overrides: Partial<Story>): Story {
    return {
        id: 's1',
        title: 'The Long Night',
        scenes: [],
        activeCardRefs: [],
        activeContext: {},
        ...overrides,
    } as unknown as Story
}

describe('resumeModel', () => {
    it('merges adventures, chats, and novels newest-first', () => {
        const sessions = toResumeSessions(
            [
                adventure({ id: 'old', updatedAt: '2026-06-10 08:00:00' }),
                adventure({ id: 'newest', updatedAt: '2026-06-12 09:00:00' }),
            ],
            [chat({ id: 'mid', updatedAt: '2026-06-11 10:00:00' })],
            [story({ id: 'novel', updatedAt: '2026-06-11 23:00:00' })],
            NOW,
        )
        expect(sessions.map((s) => s.id)).toEqual(['newest', 'novel', 'mid', 'old'])
        expect(sessions.map((s) => s.kind)).toEqual(['adventure', 'novel', 'chat', 'adventure'])
    })

    it('sorts untimestamped sessions after timestamped ones, later-appended first', () => {
        const sessions = toResumeSessions(
            [adventure({ id: 'no-stamp-1' }), adventure({ id: 'no-stamp-2' })],
            [chat({ id: 'stamped', updatedAt: '2026-06-01 00:00:00' })],
            [],
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
            [],
            NOW,
        )
        expect(fromSnapshot.title).toBe('The Hollow Wood')

        const [fromPersona] = toResumeSessions(
            [adventure({ scenario: '', persona: { id: 'p', name: 'Wren', race: 'fey', stats: {} } })],
            [],
            [],
            NOW,
        )
        expect(fromPersona.title).toBe("Wren's adventure")

        const [untitled] = toResumeSessions([adventure({ scenario: '' })], [], [], NOW)
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
            [],
            NOW,
        )
        expect(withTurns.meta).toContain('1 message')

        const [empty] = toResumeSessions([], [chat({})], [], NOW)
        expect(empty.meta).toBe('Ready to continue')
    })

    it('flags group chats and collects their avatars', () => {
        const [group] = toResumeSessions(
            [],
            [
                chat({
                    id: 'g1',
                    kind: 'character_group',
                    character: undefined,
                    characters: [
                        { id: 'a', name: 'Ada', race: 'human', stats: {}, image_url: 'a.png' },
                        { id: 'b', name: 'Bo', race: 'elf', stats: {}, image_url: 'b.png' },
                    ],
                } as unknown as CharacterChatSession),
            ],
            [],
            NOW,
        )
        expect(group.isGroupChat).toBe(true)
        expect(group.title).toBe('Ada, Bo')
        expect(group.imageUrls).toEqual(['a.png', 'b.png'])
    })

    it('maps a novel to a keep-writing session with chapter meta', () => {
        const [novel] = toResumeSessions(
            [],
            [],
            [
                story({
                    title: 'Siege of Ash',
                    description: 'A siege told from the walls.',
                    chapters: [
                        { id: '1', title: 'Chapter 1', body: 'one two three', order: 0 },
                        { id: '2', title: 'Chapter 2', body: 'four five', order: 1 },
                    ] as unknown as Story['chapters'],
                }),
            ],
            NOW,
        )
        expect(novel.kind).toBe('novel')
        expect(novel.title).toBe('Siege of Ash')
        expect(novel.snippet).toBe('A siege told from the walls.')
        expect(novel.meta).toContain('2 chapters')
        expect(novel.meta).toContain('5 words')
    })
})
