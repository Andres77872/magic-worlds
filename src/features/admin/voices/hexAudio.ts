/**
 * Ephemeral audio helpers for the voice studio. MiniMax design/test responses
 * return hex-encoded audio; clone uploads need a duration probe. Centralizing
 * the object-URL lifecycle here keeps every create paired with exactly one
 * revoke (the studio juggles several throwaway previews + probes at once).
 */
import { useEffect, useMemo } from 'react'

/** Decode a hex string into an audio Blob, or null when it isn't valid hex. */
export function hexToBlob(hex?: string | null, mime = 'audio/mpeg'): Blob | null {
    const clean = (hex ?? '').trim()
    if (!clean || clean.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(clean)) return null
    const bytes = new Uint8Array(clean.length / 2)
    for (let i = 0; i < clean.length; i += 2) {
        bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16)
    }
    return new Blob([bytes], { type: mime })
}

/**
 * Object URL for hex-encoded audio, revoked when the hex/mime changes or on
 * unmount. Returns null when the hex can't be decoded.
 */
export function useEphemeralAudioUrl(hex?: string | null, mime = 'audio/mpeg'): string | null {
    const url = useMemo(() => {
        const blob = hexToBlob(hex, mime)
        return blob ? URL.createObjectURL(blob) : null
    }, [hex, mime])

    useEffect(() => {
        return () => {
            if (url) URL.revokeObjectURL(url)
        }
    }, [url])

    return url
}

/**
 * Read an audio file's duration in seconds via a metadata-only <audio> probe.
 * The probe object URL is always revoked. Rejects when metadata can't load
 * (callers treat that as a soft warning; the server re-validates anyway).
 */
export function readAudioDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const audio = document.createElement('audio')
        audio.preload = 'metadata'
        const cleanup = () => {
            audio.removeAttribute('src')
            URL.revokeObjectURL(url)
        }
        audio.addEventListener('loadedmetadata', () => {
            const { duration } = audio
            cleanup()
            if (Number.isFinite(duration) && duration > 0) resolve(duration)
            else reject(new Error('Could not read audio duration.'))
        })
        audio.addEventListener('error', () => {
            cleanup()
            reject(new Error('Could not read audio metadata.'))
        })
        audio.src = url
    })
}
