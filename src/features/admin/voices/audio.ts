/**
 * Console audio (05 §8.14): no hex. Design and remix previews arrive as base64,
 * lab renders as audio blobs (MP3, WAV or raw PCM, R1-FE-06), and samples and
 * acceptance renders as BFF media paths fetched with the Bearer token. Raw PCM
 * plays through a WAV header (`pcmAudio`). Every object URL is revoked.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import { isAbortError } from './consoleErrors'
import { audioExtension, isPcmAudio, playableAudioBlob } from './pcmAudio'

export function base64ToBlob(base64: string | null | undefined, mime = 'audio/mpeg'): Blob | null {
    const clean = (base64 ?? '').replace(/\s+/g, '')
    if (!clean) return null
    try {
        const binary = atob(clean)
        const bytes = new Uint8Array(binary.length)
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
        return new Blob([bytes], { type: mime })
    } catch {
        return null
    }
}

/**
 * An object URL for a Blob, revoked when the Blob changes or on unmount. The
 * revocation is deferred one task and cancelled if the same URL is mounted
 * again, so StrictMode's simulated unmount does not revoke a URL still in use.
 */
export function useObjectUrl(blob: Blob | null): string | null {
    const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
    const pendingRevoke = useRef<{ url: string; timer: ReturnType<typeof setTimeout> } | null>(null)
    useEffect(() => {
        if (!url) return
        if (pendingRevoke.current?.url === url) {
            clearTimeout(pendingRevoke.current.timer)
            pendingRevoke.current = null
        }
        return () => {
            pendingRevoke.current = { url, timer: setTimeout(() => URL.revokeObjectURL(url), 0) }
        }
    }, [url])
    return url
}

/**
 * Inline (`data:`, `blob:`) and absolute foreign URLs (root-only upstream
 * previews) play directly, with no token.
 */
const isDirectUrl = (url: string) => /^(data:|blob:)/i.test(url) || (/^https?:\/\//i.test(url) && !url.startsWith(window.location.origin))

/**
 * The Blob to hand a player (R1-FE-06): raw PCM is wrapped as WAV once it is
 * converted (null until then); every other Blob is returned as it is, in the
 * same render.
 */
export function usePlayableBlob(blob: Blob | null, contentType: string | null | undefined, outputFormat?: string | null): Blob | null {
    const pcm = Boolean(blob) && isPcmAudio(contentType ?? blob?.type, outputFormat)
    const [converted, setConverted] = useState<{ source: Blob; playable: Blob } | null>(null)

    useEffect(() => {
        if (!blob || !pcm) return
        let cancelled = false
        void playableAudioBlob(blob, contentType ?? blob.type, outputFormat)
            .then((playable) => {
                if (!cancelled) setConverted({ source: blob, playable })
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [blob, pcm, contentType, outputFormat])

    if (!blob || !pcm) return blob
    return converted?.source === blob ? converted.playable : null
}

export interface ConsoleAudioState {
    src: string | null
    loading: boolean
    failed: boolean
    /** The fetched bytes as served (raw PCM stays raw), for a download; null for inline URLs. */
    blob: Blob | null
}

/**
 * A playable URL for a BFF media path (sample, acceptance render), fetched as
 * an authed blob. Inline and absolute foreign URLs are returned as-is.
 */
export function useConsoleAudioUrl(path: string | null | undefined): ConsoleAudioState {
    const [state, setState] = useState<{ path: string; blob: Blob | null; failed: boolean } | null>(null)
    const direct = Boolean(path && isDirectUrl(path))

    useEffect(() => {
        if (!path || direct) return
        const controller = new AbortController()
        apiService
            .fetchProtectedMediaBlob(path, 'audio/mpeg')
            .then((blob) => {
                if (!controller.signal.aborted) setState({ path, blob, failed: false })
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted || isAbortError(error)) return
                setState({ path, blob: null, failed: true })
            })
        return () => controller.abort()
    }, [path, direct])

    const current = state && state.path === path ? state : null
    const playable = usePlayableBlob(current?.blob ?? null, current?.blob?.type)
    const objectUrl = useObjectUrl(playable)
    if (!path) return { src: null, loading: false, failed: false, blob: null }
    if (direct) return { src: path, loading: false, failed: false, blob: null }
    return { src: objectUrl, loading: !current || (Boolean(current.blob) && !playable), failed: Boolean(current?.failed), blob: current?.blob ?? null }
}

/** Download extension for an audio answer (`pcm`, `wav`, `ogg`, `opus`, else `mp3`; see `pcmAudio`). */
export function extensionFor(contentType: string, outputFormat?: string | null): string {
    return audioExtension(contentType, outputFormat)
}
