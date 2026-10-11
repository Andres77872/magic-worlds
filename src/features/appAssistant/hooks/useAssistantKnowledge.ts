/**
 * useAssistantKnowledge — gathers what the assistant may read and remembers the
 * viewer's choices. Library lists come from DataProvider (already loaded for
 * the galleries); lorebook resources are the one list it fetches itself.
 *
 * Source switches and the focus shelf are per-viewer conveniences, so they live
 * in localStorage (focus is scoped per account) and fall back to defaults when
 * storage is unavailable.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, useData } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import type { LorebookResource, PageType } from '@/shared'
import {
    isAdventuresFeatureEnabled,
    isLorebookResourcesFeatureEnabled,
    isLorebooksFeatureEnabled,
    isNovelsFeatureEnabled,
    isPageFeatureEnabled,
} from '@/shared/featureFlags'
import { normalizeLorebookResource } from '@/features/lorebook/lorebookResources'
import { isPersonaCard } from '@/utils/characterRoles'
import {
    composeKnowledge,
    findFocusRecord,
    KNOWLEDGE_SOURCE_KEYS,
    type AppKnowledge,
    type FocusRef,
    type KnowledgeLibrary,
    type KnowledgeSourceKey,
} from '../appKnowledge'
import type { FocusCandidate } from '../components/AssistantFocusPicker'
import type { FocusChip } from '../components/knowledgeIcons'

export const FOCUS_LIMIT = 6
const RESOURCE_FETCH_LIMIT = 100
const SOURCES_STORAGE_KEY = 'magic-worlds-assistant-sources-off'
const FOCUS_STORAGE_PREFIX = 'magic-worlds-assistant-focus:'

function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = window.localStorage.getItem(key)
        return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
        return fallback
    }
}

function writeJson(key: string, value: unknown) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
        // Private mode / blocked storage: the choice simply lasts for this visit.
    }
}

function isFocusRef(value: unknown): value is FocusRef {
    return !!value && typeof value === 'object' && typeof (value as FocusRef).id === 'string' && typeof (value as FocusRef).kind === 'string'
}

function readFocus(key: string): FocusRef[] {
    const stored = readJson<unknown>(key, [])
    return Array.isArray(stored) ? stored.filter(isFocusRef).slice(0, FOCUS_LIMIT) : []
}

/** Sources whose feature is on for this build. */
export function availableSources(): KnowledgeSourceKey[] {
    return KNOWLEDGE_SOURCE_KEYS.filter((key) => {
        if (key === 'lorebooks') return isLorebooksFeatureEnabled()
        if (key === 'resources') return isLorebookResourcesFeatureEnabled()
        if (key === 'novels') return isNovelsFeatureEnabled()
        return true
    })
}

function normalizeResourceList(raw: unknown): LorebookResource[] {
    const source = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items) ? (raw as { items: unknown[] }).items : []
    return source.map(normalizeLorebookResource).filter((resource): resource is LorebookResource => Boolean(resource))
}

export interface UseAssistantKnowledgeResult {
    knowledge: AppKnowledge
    library: KnowledgeLibrary
    sources: KnowledgeSourceKey[]
    enabled: ReadonlySet<KnowledgeSourceKey>
    toggleSource: (key: KnowledgeSourceKey, on: boolean) => void
    focus: FocusRef[]
    focusChips: FocusChip[]
    setFocus: (refs: FocusRef[]) => void
    removeFocus: (ref: FocusRef) => void
    candidates: FocusCandidate[]
    resourcesLoading: boolean
}

export function useAssistantKnowledge(originPage: PageType | null): UseAssistantKnowledgeResult {
    const { t } = useTranslation()
    const { isAuthenticated, accountKey } = useAuth()
    const { characters, worlds, items, templateAdventures, lorebooks, stories } = useData()
    const sources = useMemo(() => availableSources(), [])

    const [disabled, setDisabled] = useState<KnowledgeSourceKey[]>(() => {
        const stored = readJson<unknown>(SOURCES_STORAGE_KEY, [])
        return Array.isArray(stored) ? stored.filter((key): key is KnowledgeSourceKey => KNOWLEDGE_SOURCE_KEYS.includes(key)) : []
    })
    const enabled = useMemo(() => new Set(sources.filter((key) => !disabled.includes(key))), [sources, disabled])

    const toggleSource = useCallback((key: KnowledgeSourceKey, on: boolean) => {
        setDisabled((current) => {
            const next = on ? current.filter((value) => value !== key) : [...new Set([...current, key])]
            writeJson(SOURCES_STORAGE_KEY, next)
            return next
        })
    }, [])

    const focusKey = `${FOCUS_STORAGE_PREFIX}${accountKey || 'anonymous'}`
    const [focusState, setFocusState] = useState<{ key: string; refs: FocusRef[] }>(() => ({ key: focusKey, refs: readFocus(focusKey) }))
    // A different account reads its own shelf (the page normally remounts on auth changes).
    const focus = useMemo(() => (focusState.key === focusKey ? focusState.refs : readFocus(focusKey)), [focusState, focusKey])

    const setFocus = useCallback((refs: FocusRef[]) => {
        const next = refs.slice(0, FOCUS_LIMIT)
        writeJson(focusKey, next)
        setFocusState({ key: focusKey, refs: next })
    }, [focusKey])

    const removeFocus = useCallback((ref: FocusRef) => {
        setFocus(focus.filter((entry) => entry.kind !== ref.kind || entry.id !== ref.id))
    }, [focus, setFocus])

    // Resources are not part of DataProvider; fetch one page while the source is usable.
    const wantsResources = isAuthenticated && sources.includes('resources')
    // `account` records whose list arrived; until it matches, the list is loading.
    const [resources, setResources] = useState<{ account: string | null; items: LorebookResource[] }>({ account: null, items: [] })
    useEffect(() => {
        if (!wantsResources) return
        let cancelled = false
        apiService.getLorebookResources(0, RESOURCE_FETCH_LIMIT)
            .then((raw) => {
                if (!cancelled) setResources({ account: accountKey, items: normalizeResourceList(raw) })
            })
            .catch((error) => {
                console.warn('Assistant could not load resources:', error)
                if (!cancelled) setResources({ account: accountKey, items: [] })
            })
        return () => {
            cancelled = true
        }
    }, [wantsResources, accountKey])

    const library = useMemo<KnowledgeLibrary>(() => ({
        characters: isAuthenticated ? characters : [],
        worlds: isAuthenticated ? worlds : [],
        items: isAuthenticated ? items : [],
        adventures: isAuthenticated && isAdventuresFeatureEnabled() ? templateAdventures : [],
        lorebooks: isAuthenticated && isLorebooksFeatureEnabled() ? lorebooks : [],
        resources: wantsResources && resources.account === accountKey ? resources.items : [],
        stories: isAuthenticated && isNovelsFeatureEnabled() ? stories : [],
    }), [isAuthenticated, characters, worlds, items, templateAdventures, lorebooks, stories, wantsResources, resources, accountKey])

    const liveFocus = useMemo(() => focus.filter((ref) => findFocusRecord(library, ref)), [focus, library])

    const knowledge = useMemo(() => composeKnowledge({
        t,
        library,
        enabled,
        focus: liveFocus,
        isPageVisible: isPageFeatureEnabled,
        originPage,
    }), [t, library, enabled, liveFocus, originPage])

    const focusChips = useMemo<FocusChip[]>(() => liveFocus.map((ref) => ({ ...ref, name: findFocusRecord(library, ref)?.name ?? ref.id })), [liveFocus, library])

    const candidates = useMemo<FocusCandidate[]>(() => [
        ...library.characters.map((card): FocusCandidate => ({
            kind: isPersonaCard(card) ? 'persona' : 'character', id: card.id, name: card.name, detail: [card.race, card.class].filter(Boolean).join(' · '),
        })),
        ...library.worlds.map((world): FocusCandidate => ({ kind: 'world', id: world.id, name: world.name, detail: world.type })),
        ...library.items.map((item): FocusCandidate => ({ kind: 'item', id: item.id, name: item.name, detail: [item.type, item.rarity].filter(Boolean).join(' · ') })),
        ...library.adventures.map((adventure): FocusCandidate => ({
            kind: 'adventure', id: adventure.id, name: findFocusRecord(library, { kind: 'adventure', id: adventure.id })?.name ?? adventure.id,
            detail: adventure.world?.name,
        })),
        ...library.lorebooks.map((lorebook): FocusCandidate => ({
            kind: 'lorebook', id: lorebook.id, name: lorebook.name, detail: t('appAssistant.knowledge.entryCount', { count: lorebook.entries.length }),
        })),
        ...library.resources.map((resource): FocusCandidate => ({ kind: 'resource', id: resource.id, name: resource.title, detail: resource.fileName })),
        ...library.stories.map((story): FocusCandidate => ({
            kind: 'novel', id: story.id, name: story.title, detail: t('appAssistant.knowledge.chapterCount', { count: story.chapters?.length ?? 0 }),
        })),
    ], [library, t])

    return {
        knowledge,
        library,
        sources,
        enabled,
        toggleSource,
        focus: liveFocus,
        focusChips,
        setFocus,
        removeFocus,
        candidates,
        resourcesLoading: wantsResources && resources.account !== accountKey,
    }
}
