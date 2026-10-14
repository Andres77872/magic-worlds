/**
 * Catalog context for voices a document or preset references (R1-FE-03):
 * `disable_at`, `replacement`, `locked` and `status`, for badges. One
 * `GET /voices/catalog?keys=` per ≤ 100 distinct keys (the API batches), only
 * while `enabled`. Latest wins; an error or 404 (catalog unavailable)
 * yields an empty map, so a lookup can never break the surface it decorates.
 */
import { useEffect, useMemo, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import type { CatalogVoice } from '@/shared'

const EMPTY: ReadonlyMap<string, CatalogVoice> = new Map()

export function useCatalogLookup(keys: readonly (string | null | undefined)[], enabled = true): ReadonlyMap<string, CatalogVoice> {
    // Order-insensitive identity, so a re-render with the same keys never refetches.
    const wanted = useMemo(
        () => [...new Set(keys.map((key) => (typeof key === 'string' ? key.trim() : '')).filter(Boolean))].sort(),
        [keys],
    )
    const signature = wanted.join(',')
    const [result, setResult] = useState<{ signature: string; map: ReadonlyMap<string, CatalogVoice> }>({ signature: '', map: EMPTY })
    const active = enabled && signature !== '' && typeof apiService.getVoiceCatalogByKeys === 'function'

    useEffect(() => {
        if (!active) return
        let cancelled = false
        void Promise.resolve()
            .then(() => apiService.getVoiceCatalogByKeys(signature.split(',')))
            .then((items) => {
                if (cancelled) return
                setResult({ signature, map: new Map((items ?? []).map((item) => [item.voice_key, item])) })
            })
            .catch(() => {
                if (!cancelled) setResult({ signature, map: EMPTY })
            })
        return () => {
            cancelled = true
        }
    }, [active, signature])

    return active && result.signature === signature ? result.map : EMPTY
}
