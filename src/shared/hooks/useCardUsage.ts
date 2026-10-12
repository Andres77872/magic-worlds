import { useContext, useEffect, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import type { CardUsage, VersionableCardType } from '../types/cardVersion.types'

/**
 * Shared usage fetcher for versionable cards (character / world / item).
 *
 * `GET /{type}/{id}/usage` returns `{ sessions, stories }` — owner-scoped counts of
 * how many of the requester's sessions/stories reference the card. The numbers rarely
 * change within a view, and several surfaces (gallery grid, preview modal, version
 * drawer, adventure side panel) may ask for the same card at once, so results are
 * memoized in a module-level cache and concurrent requests are de-duplicated.
 *
 * Errors resolve to `null` (usage is informative-only — never block a surface on it).
 *
 * Workspace R1: usage is a private read of the card's workspace (the card's own
 * `organization.workspace_id` when known, else the committed workspace), and the
 * cache is keyed by that workspace. Without a selected workspace the hook stays idle.
 */

const cache = new Map<string, CardUsage>()
const inFlight = new Map<string, Promise<CardUsage | null>>()

function cacheKey(workspaceId: string, cardType: VersionableCardType, cardId: string): string {
    return `${workspaceId}:${cardType}:${cardId}`
}

async function loadUsage(workspaceId: string, cardType: VersionableCardType, cardId: string): Promise<CardUsage | null> {
    const key = cacheKey(workspaceId, cardType, cardId)
    const cached = cache.get(key)
    if (cached) return cached
    const existing = inFlight.get(key)
    if (existing) return existing
    const request = apiService
        .withWorkspace(workspaceId)
        .getCardUsage(cardType, cardId)
        .then((usage) => {
            cache.set(key, usage)
            return usage
        })
        .catch(() => null)
        .finally(() => {
            inFlight.delete(key)
        })
    inFlight.set(key, request)
    return request
}

/**
 * Drop a card's cached usage so the next read refetches. Call after an action that may
 * change usage display for a card (e.g. publishing a new version). No-op when uncached.
 */
export function invalidateCardUsage(cardType: VersionableCardType, cardId: string): void {
    const suffix = `:${cardType}:${cardId}`
    for (const map of [cache, inFlight]) {
        for (const key of [...map.keys()]) if (key.endsWith(suffix)) map.delete(key)
    }
}

export interface UseCardUsageOptions {
    /** When false the hook stays idle (no fetch) — e.g. off-screen cards or foreign previews. */
    enabled?: boolean
    /** The card's own workspace (its `organization.workspace_id`); default = the committed workspace. */
    workspaceId?: string | null
}

/**
 * Returns the cached `CardUsage` for a card, fetching it on demand. Returns `null`
 * while loading, when disabled, when the target is incomplete, or on error.
 */
export function useCardUsage(
    cardType: VersionableCardType | null | undefined,
    cardId: string | undefined,
    { enabled = true, workspaceId: requestedWorkspaceId }: UseCardUsageOptions = {},
): CardUsage | null {
    // Read the context directly: shared cards render in surfaces (stories, tests)
    // without a workspace, where usage simply stays hidden.
    const workspace = useContext(WorkspaceContext)
    const workspaceId = requestedWorkspaceId ?? workspace?.selectedWorkspaceId ?? null
    const key = workspaceId && cardType && cardId ? cacheKey(workspaceId, cardType, cardId) : null
    const [usage, setUsage] = useState<CardUsage | null>(() => (key ? cache.get(key) ?? null : null))

    useEffect(() => {
        if (!enabled || !cardType || !cardId || !workspaceId) {
            setUsage(null)
            return
        }
        const cached = cache.get(cacheKey(workspaceId, cardType, cardId))
        if (cached) {
            setUsage(cached)
            return
        }
        let cancelled = false
        void loadUsage(workspaceId, cardType, cardId).then((result) => {
            if (!cancelled) setUsage(result)
        })
        return () => {
            cancelled = true
        }
    }, [enabled, cardType, cardId, workspaceId])

    return usage
}
