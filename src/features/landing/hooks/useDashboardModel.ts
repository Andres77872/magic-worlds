/**
 * useDashboardModel — the returning dashboard's derived view-model. One place
 * for every memoized, capped selector the landing sections read, so LandingPage
 * stays a thin composition layer and the caps (which bound how many image-laden
 * cards ever mount) live at the data boundary where the arrays stay referentially
 * stable.
 *
 * Two session lists are exposed on purpose: `resumeSessions` (carousel, includes
 * novels) and `searchSessions` (adventures + chats only) — global search has its
 * own novels group, so folding novels into the search sessions would list every
 * novel twice.
 */

import { useMemo } from 'react'
import { useData } from '@/app/hooks'
import type { Character, Item, Lorebook, Story, World } from '@/shared'
import { isGroupChatsFeatureEnabled, isLorebooksFeatureEnabled, isNovelsFeatureEnabled } from '@/shared/featureFlags'
import { isAiCharacterCard, isPersonaCard } from '@/utils/characterRoles'
import { toResumeSessions, type ResumeSession } from '../components/resumeModel'

/** A shelf teases; the galleries exhaust. */
const CAP = {
    carousel: 8,
    active: 9,
    library: 9,
} as const

const EMPTY_STORIES: Story[] = []
const EMPTY_LOREBOOKS: Lorebook[] = []

export interface DashboardModel {
    /** Recent across adventures + chats + novels, capped — the hero carousel. */
    resumeSessions: ResumeSession[]
    /** Adventures + chats only (no novels) — fed to global search. */
    searchSessions: ResumeSession[]
    activeAdventureSessions: ResumeSession[]
    activeChatSessions: ResumeSession[]
    activeNovelSessions: ResumeSession[]
    /** Player persona cards — search + persona picker (no dedicated rail). */
    personaCards: Character[]
    /** AI character cards — the cast rail (caps internally) and search. */
    aiCharacters: Character[]
    railWorlds: World[]
    railItems: Item[]
    railLorebooks: Lorebook[]
    counts: {
        adventures: number
        chats: number
        novels: number
        worlds: number
        items: number
        lorebooks: number
    }
}

export function useDashboardModel(): DashboardModel {
    const { characters, worlds, items, inProgressAdventures, characterChats, stories, lorebooks } = useData()
    const visibleChats = useMemo(
        () => isGroupChatsFeatureEnabled() ? characterChats : characterChats.filter((chat) => chat.kind !== 'character_group'),
        [characterChats],
    )
    const visibleStories = isNovelsFeatureEnabled() ? stories : EMPTY_STORIES
    const visibleLorebooks = isLorebooksFeatureEnabled() ? lorebooks : EMPTY_LOREBOOKS

    const personaCards = useMemo(() => characters.filter(isPersonaCard), [characters])
    const aiCharacters = useMemo(() => characters.filter(isAiCharacterCard), [characters])

    const resumeSessions = useMemo(
        () => toResumeSessions(inProgressAdventures, visibleChats, visibleStories).slice(0, CAP.carousel),
        [inProgressAdventures, visibleChats, visibleStories],
    )
    const searchSessions = useMemo(
        () => toResumeSessions(inProgressAdventures, visibleChats),
        [inProgressAdventures, visibleChats],
    )

    const activeAdventureSessions = useMemo(
        () => toResumeSessions(inProgressAdventures, [], []).slice(0, CAP.active),
        [inProgressAdventures],
    )
    const activeChatSessions = useMemo(
        () => toResumeSessions([], visibleChats, []).slice(0, CAP.active),
        [visibleChats],
    )
    const activeNovelSessions = useMemo(
        () => toResumeSessions([], [], visibleStories).slice(0, CAP.active),
        [visibleStories],
    )

    const railWorlds = useMemo(() => worlds.slice(0, CAP.library), [worlds])
    const railItems = useMemo(() => items.slice(0, CAP.library), [items])
    const railLorebooks = useMemo(() => visibleLorebooks.slice(0, CAP.library), [visibleLorebooks])

    const counts = useMemo(
        () => ({
            adventures: inProgressAdventures.length,
            chats: visibleChats.length,
            novels: visibleStories.length,
            worlds: worlds.length,
            items: items.length,
            lorebooks: visibleLorebooks.length,
        }),
        [inProgressAdventures.length, visibleChats.length, visibleStories.length, worlds.length, items.length, visibleLorebooks.length],
    )

    return {
        resumeSessions,
        searchSessions,
        activeAdventureSessions,
        activeChatSessions,
        activeNovelSessions,
        personaCards,
        aiCharacters,
        railWorlds,
        railItems,
        railLorebooks,
        counts,
    }
}
