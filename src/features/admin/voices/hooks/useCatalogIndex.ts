import { useCallback, useMemo } from 'react'
import { apiService } from '@/infrastructure/api'
import type { AdminCatalogSummary, AdminCatalogVoice } from '@/shared'
import { CATALOG_INDEX_PAGE_SIZE } from '../constants'
import { useAbortableLoad } from './useAbortableLoad'

/** Hard stop for the index walk: 20 × 100 voices is far above the launch catalog. */
const MAX_INDEX_PAGES = 20

interface CatalogIndexData {
    voices: AdminCatalogVoice[]
    summary: AdminCatalogSummary | null
}

export interface CatalogIndex {
    voices: AdminCatalogVoice[]
    byKey: Map<string, AdminCatalogVoice>
    summary: AdminCatalogSummary | null
    loading: boolean
    error: unknown
    reload: () => void
    /** Replace one row after a mutation (keeps pickers and checks current). */
    upsert: (voice: AdminCatalogVoice) => void
}

async function loadIndex(signal: AbortSignal): Promise<CatalogIndexData> {
    const voices: AdminCatalogVoice[] = []
    let summary: AdminCatalogSummary | null = null
    let after: string | undefined
    for (let page = 0; page < MAX_INDEX_PAGES; page += 1) {
        const result = await apiService.listAdminCatalog({ limit: CATALOG_INDEX_PAGE_SIZE, after }, signal)
        voices.push(...result.items)
        if (page === 0) summary = result.summary ?? null
        if (!result.next_cursor) break
        after = result.next_cursor
    }
    return { voices, summary }
}

/**
 * The whole catalog in memory, for the pickers and the cross-module checks
 * (acceptance queue, defaults readiness, preset voices, lab voice). The
 * Catalog manager keeps its own server-filtered list.
 */
export function useCatalogIndex(enabled = true): CatalogIndex {
    const load = useAbortableLoad(loadIndex, 'catalog-index', enabled)
    const { setData } = load
    const voices = useMemo(() => load.data?.voices ?? [], [load.data])
    const byKey = useMemo(() => new Map(voices.map((voice) => [voice.voice_key, voice])), [voices])

    const upsert = useCallback(
        (voice: AdminCatalogVoice) => {
            setData((previous) => {
                const list = previous?.voices ?? []
                const exists = list.some((item) => item.voice_key === voice.voice_key)
                return {
                    summary: previous?.summary ?? null,
                    voices: exists ? list.map((item) => (item.voice_key === voice.voice_key ? voice : item)) : [voice, ...list],
                }
            })
        },
        [setData],
    )

    return {
        voices,
        byKey,
        summary: load.data?.summary ?? null,
        loading: load.loading,
        error: load.error,
        reload: load.reload,
        upsert,
    }
}
