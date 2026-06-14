import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Adventure, Character, CharacterChatSession, Item, Lorebook, Story, World } from '@/shared'
import { useDashboardModel } from './useDashboardModel'

const characters = [
    { id: 'p1', name: 'Aria', race: 'Human', stats: {}, role: 'persona', is_default_persona: true },
    ...Array.from({ length: 15 }, (_, i) => ({ id: `c${i}`, name: `Char ${i}`, race: 'Elf', stats: {}, role: 'character' })),
] as unknown as Character[]

const inProgressAdventures = Array.from({ length: 12 }, (_, i) => ({
    id: `a${i}`,
    scenario: `Adventure ${i}`,
    characters: [],
    turns: [],
    updatedAt: `2026-06-${String(i + 1).padStart(2, '0')} 00:00:00`,
})) as unknown as Adventure[]

const characterChats = Array.from({ length: 12 }, (_, i) => ({
    id: `ch${i}`,
    character: { id: `c${i}`, name: `Char ${i}`, race: 'Elf', stats: {} },
    turns: [],
})) as unknown as CharacterChatSession[]

const stories = Array.from({ length: 12 }, (_, i) => ({
    id: `s${i}`,
    title: `Story ${i}`,
    scenes: [],
    activeCardRefs: [],
    activeContext: {},
})) as unknown as Story[]

const worlds = Array.from({ length: 12 }, (_, i) => ({ id: `w${i}`, name: `World ${i}`, details: {} })) as unknown as World[]
const items = Array.from({ length: 12 }, (_, i) => ({ id: `it${i}`, name: `Item ${i}` })) as unknown as Item[]
const lorebooks = Array.from({ length: 12 }, (_, i) => ({
    id: `l${i}`,
    name: `Lore ${i}`,
    entries: [],
    attachments: [],
    tags: [],
})) as unknown as Lorebook[]

const mockData = { characters, worlds, items, inProgressAdventures, characterChats, stories, lorebooks }

vi.mock('@/app/hooks', () => ({ useData: () => mockData }))

describe('useDashboardModel', () => {
    it('caps the carousel at 8 and the per-type rails at 9', () => {
        const { result } = renderHook(() => useDashboardModel())
        expect(result.current.resumeSessions).toHaveLength(8)
        expect(result.current.activeAdventureSessions).toHaveLength(9)
        expect(result.current.activeChatSessions).toHaveLength(9)
        expect(result.current.activeNovelSessions).toHaveLength(9)
        expect(result.current.railWorlds).toHaveLength(9)
        expect(result.current.railItems).toHaveLength(9)
        expect(result.current.railLorebooks).toHaveLength(9)
    })

    it('splits cast from personas and keeps novels out of the search sessions', () => {
        const { result } = renderHook(() => useDashboardModel())
        expect(result.current.personaCards).toHaveLength(1)
        expect(result.current.aiCharacters).toHaveLength(15)
        expect(result.current.searchSessions).toHaveLength(24)
        expect(result.current.searchSessions.every((s) => s.kind !== 'novel')).toBe(true)
        expect(result.current.counts.novels).toBe(12)
    })
})
