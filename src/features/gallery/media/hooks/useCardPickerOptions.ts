/**
 * useCardPickerOptions — debounced, type-scoped card search feeding the media
 * gallery's "filter by card" picker (and the novel's "begin from a card").
 *
 * Workspace R1: only the committed workspace's cards. "All types" reads the
 * mixed library endpoint in one request; a single type keeps its per-kind list
 * route. Both go through the committed workspace's scoped client, and results
 * that arrive after a workspace switch are ignored.
 */

import { useEffect, useRef, useState } from 'react'
import { i18n } from '@/app/i18n'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { CardMediaTargetType, LibraryItem } from '@/shared'
import { resolveMediaUrl, type ApiService } from '@/infrastructure/api'
import { asArray } from '../../../../utils/cardTransforms'
import type { CardRef, CardTypeFilter } from '../mediaGalleryTypes'

export interface CardPickerOption extends CardRef {
    name: string
    imageUrl?: string
}

const SEARCH_DEBOUNCE_MS = 300
/** Few options per type — the picker is a narrowing search, not a browser. */
const OPTIONS_PER_TYPE = 8
const CARD_TYPE_COUNT = 4

interface RawCardRow {
    id?: string
    uuid?: string
    name?: string
    image_url?: string
}

function toOption(row: RawCardRow, type: CardMediaTargetType): CardPickerOption {
    return {
        type,
        id: (row.id || row.uuid || '') as string,
        name: row.name?.trim() || i18n.t('mediaGallery.picker.untitled'),
        imageUrl: resolveMediaUrl(row.image_url),
    }
}

function toOptions(raw: unknown, type: CardMediaTargetType): CardPickerOption[] {
    return (asArray(raw) as RawCardRow[]).map((row) => toOption(row, type)).filter((option) => option.id)
}

/** A mixed-library entry as a picker option (`null` when the card has no id). */
export function libraryItemToOption(item: LibraryItem): CardPickerOption | null {
    const option = toOption(item.card as RawCardRow, item.card_type)
    return option.id ? option : null
}

async function fetchCardOptions(
    api: ApiService,
    workspaceId: string,
    cardType: CardTypeFilter,
    q?: string,
    limit = OPTIONS_PER_TYPE,
): Promise<CardPickerOption[]> {
    if (cardType === 'all') {
        const page = await api.listLibraryCards(workspaceId, { q, limit: Math.min(limit * CARD_TYPE_COUNT, 100) })
        return page.items.map(libraryItemToOption).filter((option) => option !== null)
    }
    const raw =
        cardType === 'character'
            ? await api.getCharacters(0, limit, q)
            : cardType === 'world'
              ? await api.getWorlds(0, limit, q)
              : cardType === 'item'
                ? await api.getItems(0, limit, q)
                : await api.getAdventureTemplates(0, limit, q)
    return toOptions(raw, cardType)
}

export function useCardPickerOptions(
    cardType: CardTypeFilter,
    query: string,
    enabled: boolean,
    limit?: number,
): { options: CardPickerOption[]; loading: boolean } {
    const { api, selectedWorkspaceId, workspaceEpoch, capture, isCurrent } = useWorkspace()
    const [options, setOptions] = useState<CardPickerOption[]>([])
    const [loading, setLoading] = useState(false)
    const seqRef = useRef(0)

    // The previous workspace's cards are never offered after a switch.
    const [optionsEpoch, setOptionsEpoch] = useState(workspaceEpoch)
    if (optionsEpoch !== workspaceEpoch) {
        setOptionsEpoch(workspaceEpoch)
        setOptions([])
        setLoading(false)
    }

    useEffect(() => {
        if (!enabled || !api || !selectedWorkspaceId) return
        const seq = ++seqRef.current
        const scope = capture()
        setLoading(true)
        const timer = setTimeout(() => {
            fetchCardOptions(api, selectedWorkspaceId, cardType, query.trim() || undefined, limit)
                .then((next) => {
                    if (seq !== seqRef.current || !isCurrent(scope)) return
                    setOptions(next)
                })
                .catch(() => {
                    if (seq !== seqRef.current || !isCurrent(scope)) return
                    setOptions([])
                })
                .finally(() => {
                    if (seq === seqRef.current && isCurrent(scope)) setLoading(false)
                })
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [api, capture, cardType, enabled, isCurrent, limit, query, selectedWorkspaceId])

    return { options, loading }
}
