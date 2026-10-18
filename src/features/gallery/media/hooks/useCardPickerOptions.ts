import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * useCardPickerOptions — debounced, type-scoped card search feeding the media
 * gallery's "filter by card" picker (and the novel's "begin from a card").
 *
 * Workspace R1: only the committed workspace's cards. "All types" reads the
 * mixed library endpoint in one request; a single type keeps its per-kind list
 * route. Both go through the committed workspace's scoped client, and results
 * that arrive after a workspace switch are ignored.
 */
import { isContentTypeFeatureEnabled } from '@/shared/featureFlags'

import { useEffect, useRef, useState } from 'react'
import { i18n } from '@/app/i18n'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { CardMediaTargetType, LibraryItem } from '@/shared'
import type { CardSourceStatus } from '@/shared/types/workspace.types'
import { resolveMediaUrl, type ApiService } from '@/infrastructure/api'
import { asArray } from '../../../../utils/cardTransforms'
import type { CardRef, CardTypeFilter } from '../mediaGalleryTypes'

export interface CardPickerOption extends CardRef {
    name: string
    imageUrl?: string
    sourceStatus?: CardSourceStatus
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
    latest_version_id?: string | null
    latest_version_number?: number
    has_draft?: boolean
}

function toOption(row: RawCardRow, type: CardMediaTargetType): CardPickerOption {
    return {
        type,
        id: (row.id || row.uuid || '') as string,
        name: row.name?.trim() || i18n.t('mediaGallery.picker.untitled'),
        imageUrl: resolveMediaUrl(row.image_url),
        ...(type === 'adventure_template' || (typeof row.latest_version_number === 'number' && Number.isSafeInteger(row.latest_version_number)
            && row.latest_version_number >= 0 && (row.latest_version_number === 0 ? row.latest_version_id === null : typeof row.latest_version_id === 'string'))
            ? { sourceStatus: { card_type: type, card_id: row.id || row.uuid || '', available: true,
                latest_version_id: row.latest_version_id ?? null, latest_version_number: row.latest_version_number ?? 0,
                has_draft: row.has_draft ?? false } } : {}),
    }
}

function toOptions(raw: unknown, type: CardMediaTargetType): CardPickerOption[] {
    return (asArray(raw) as RawCardRow[]).map((row) => toOption(row, type)).filter((option) => option.id)
}

/** A mixed-library entry as a picker option (`null` when the card has no id). */
export function libraryItemToOption(item: LibraryItem): CardPickerOption | null {
    if (!isContentTypeFeatureEnabled(item.card_type)) return null
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
    if (!isContentTypeFeatureEnabled(cardType)) return []
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
    useFeatureFlags()
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
