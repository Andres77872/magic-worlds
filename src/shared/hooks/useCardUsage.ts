import { useEffect, useState } from 'react'
import { apiService } from '@/infrastructure/api'
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
 */

const cache = new Map<string, CardUsage>()
const inFlight = new Map<string, Promise<CardUsage | null>>()

function cacheKey(cardType: VersionableCardType, cardId: string): string {
    return `${cardType}:${cardId}`
}

async function loadUsage(cardType: VersionableCardType, cardId: string): Promise<CardUsage | null> {
    const key = cacheKey(cardType, cardId)
    const cached = cache.get(key)
    if (cached) return cached
    const existing = inFlight.get(key)
    if (existing) return existing
    const request = apiService
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
    const key = cacheKey(cardType, cardId)
    cache.delete(key)
    inFlight.delete(key)
}

export interface UseCardUsageOptions {
    /** When false the hook stays idle (no fetch) — e.g. off-screen cards or foreign previews. */
    enabled?: boolean
}

/**
 * Returns the cached `CardUsage` for a card, fetching it on demand. Returns `null`
 * while loading, when disabled, when the target is incomplete, or on error.
 */
export function useCardUsage(
    cardType: VersionableCardType | null | undefined,
    cardId: string | undefined,
    { enabled = true }: UseCardUsageOptions = {},
): CardUsage | null {
    const key = cardType && cardId ? cacheKey(cardType, cardId) : null
    const [usage, setUsage] = useState<CardUsage | null>(() => (key ? cache.get(key) ?? null : null))

    useEffect(() => {
        if (!enabled || !cardType || !cardId) {
            setUsage(null)
            return
        }
        const cached = cache.get(cacheKey(cardType, cardId))
        if (cached) {
            setUsage(cached)
            return
        }
        let cancelled = false
        void loadUsage(cardType, cardId).then((result) => {
            if (!cancelled) setUsage(result)
        })
        return () => {
            cancelled = true
        }
    }, [enabled, cardType, cardId])

    return usage
}
