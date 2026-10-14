/**
 * Catalog audition (D18, D10, 05 §6.1): plays a catalog voice's own
 * pre-rendered sample (`/voices/catalog/{voice_key}/preview.mp3?…`, the item's
 * `sample_url`). Free and unmetered; the server rate-limits it. Dormant in R0:
 * the catalog picker that calls it ships with R1.
 *
 * Same race rules as `useRecipePreview`: latest wins (a sequence number drops
 * late blobs), and the object URL is revoked when replaced or on unmount.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import { clipVolume } from '@/shared/voice/clipVolume'

export interface CatalogSampleClip {
    src: string
    /** The sample URL it was fetched from (identifies the playing row). */
    sampleUrl: string
    volume: number
}

export function useCatalogSample() {
    const { t } = useTranslation()
    const [clip, setClip] = useState<CatalogSampleClip | null>(null)
    const [loadingUrl, setLoadingUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const seq = useRef(0)
    const objectUrl = useRef<string | null>(null)

    const replaceObjectUrl = useCallback((next: string | null) => {
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
        objectUrl.current = next
    }, [])

    useEffect(() => () => {
        seq.current += 1
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
        objectUrl.current = null
    }, [])

    /** Fetch and expose one sample; `gainDb` is the voice's catalog attenuation (D16). */
    const play = useCallback(async (sampleUrl: string, gainDb?: number | null) => {
        const mine = ++seq.current
        setLoadingUrl(sampleUrl)
        setError(null)
        try {
            const blob = await apiService.fetchProtectedMediaBlob(sampleUrl, 'audio/mpeg')
            if (mine !== seq.current) return
            const src = URL.createObjectURL(blob)
            replaceObjectUrl(src)
            setClip({ src, sampleUrl, volume: clipVolume(1, gainDb ?? 0) })
        } catch (failure) {
            if (mine !== seq.current) return
            const status = (failure as { status?: unknown } | null)?.status
            setError(t(status === 429 ? 'voices.preview.rateLimited' : 'voices.preview.unavailable'))
        } finally {
            if (mine === seq.current) setLoadingUrl(null)
        }
    }, [replaceObjectUrl, t])

    const stop = useCallback(() => {
        seq.current += 1
        replaceObjectUrl(null)
        setClip(null)
        setLoadingUrl(null)
    }, [replaceObjectUrl])

    return { clip, loadingUrl, loading: loadingUrl !== null, error, play, stop }
}
