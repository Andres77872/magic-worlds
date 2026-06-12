/**
 * useCardPickerOptions — debounced, type-scoped card search feeding the media
 * gallery's "filter by card" picker. Reads the three per-type list endpoints
 * (merged client-side when the scope is "all"); swapping in a future unified
 * `/cards` endpoint only touches `fetchCardOptions`.
 */

import { useEffect, useRef, useState } from 'react'
import type { CardMediaTargetType } from '@/shared'
import { apiService, resolveMediaUrl } from '@/infrastructure/api'
import { asArray } from '../../../../utils/cardTransforms'
import type { CardRef, CardTypeFilter } from '../mediaGalleryTypes'

export interface CardPickerOption extends CardRef {
    name: string
    imageUrl?: string
}

const SEARCH_DEBOUNCE_MS = 300
/** Few options per type — the picker is a narrowing search, not a browser. */
const OPTIONS_PER_TYPE = 8

interface RawCardRow {
    id?: string
    uuid?: string
    name?: string
    image_url?: string
}

function toOptions(raw: unknown, type: CardMediaTargetType): CardPickerOption[] {
    return (asArray(raw) as RawCardRow[])
        .map((row) => ({
            type,
            id: (row.id || row.uuid || '') as string,
            name: row.name?.trim() || 'Untitled',
            imageUrl: resolveMediaUrl(row.image_url),
        }))
        .filter((option) => option.id)
}

async function fetchCardOptions(cardType: CardTypeFilter, q?: string, limit = OPTIONS_PER_TYPE): Promise<CardPickerOption[]> {
    const sources: Array<[CardMediaTargetType, Promise<unknown>]> =
        cardType === 'all'
            ? [
                  ['character', apiService.getCharacters(0, limit, q)],
                  ['world', apiService.getWorlds(0, limit, q)],
                  ['item', apiService.getItems(0, limit, q)],
                  ['adventure_template', apiService.getAdventureTemplates(0, limit, q)],
              ]
            : cardType === 'character'
              ? [['character', apiService.getCharacters(0, limit, q)]]
              : cardType === 'world'
                ? [['world', apiService.getWorlds(0, limit, q)]]
                : cardType === 'item'
                  ? [['item', apiService.getItems(0, limit, q)]]
                  : [['adventure_template', apiService.getAdventureTemplates(0, limit, q)]]
    const results = await Promise.all(sources.map(([, promise]) => promise))
    return results.flatMap((raw, index) => toOptions(raw, sources[index][0]))
}

export function useCardPickerOptions(
    cardType: CardTypeFilter,
    query: string,
    enabled: boolean,
    limit?: number,
): { options: CardPickerOption[]; loading: boolean } {
    const [options, setOptions] = useState<CardPickerOption[]>([])
    const [loading, setLoading] = useState(false)
    const seqRef = useRef(0)

    useEffect(() => {
        if (!enabled) return
        const seq = ++seqRef.current
        setLoading(true)
        const timer = setTimeout(() => {
            fetchCardOptions(cardType, query.trim() || undefined, limit)
                .then((next) => {
                    if (seq !== seqRef.current) return
                    setOptions(next)
                })
                .catch(() => {
                    if (seq !== seqRef.current) return
                    setOptions([])
                })
                .finally(() => {
                    if (seq === seqRef.current) setLoading(false)
                })
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [cardType, query, enabled, limit])

    return { options, loading }
}
