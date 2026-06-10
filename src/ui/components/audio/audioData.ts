/**
 * Shared audio data layer for waveform players — one network fetch per track
 * feeds playback (object URL), waveform decoding, and download. Theme audio is
 * served from the public `/generated-audio` static mount with CORS, so a plain
 * unauthenticated fetch works.
 */

/** Bars in a waveform strip — fits a card-width row at gap-px without math. */
export const PEAK_BUCKETS = 48

/** Bounded promise caches keyed by absolute URL. Insertion order = age. */
const MAX_CACHED_TRACKS = 12
const blobCache = new Map<string, Promise<Blob>>()
const peaksCache = new Map<string, Promise<number[]>>()

function evictOldestIfFull(): void {
    if (blobCache.size < MAX_CACHED_TRACKS) return
    const oldest = blobCache.keys().next().value
    if (oldest !== undefined) {
        blobCache.delete(oldest)
        peaksCache.delete(oldest)
    }
}

/**
 * Fetch the audio file as a Blob, deduped and cached. A failed fetch evicts
 * itself so the next call retries instead of replaying the rejection.
 */
export function getAudioBlob(url: string): Promise<Blob> {
    const cached = blobCache.get(url)
    if (cached) return cached
    evictOldestIfFull()
    const promise = fetch(url).then((response) => {
        if (!response.ok) throw new Error(`Audio fetch failed (${response.status})`)
        return response.blob()
    })
    promise.catch(() => {
        if (blobCache.get(url) === promise) blobCache.delete(url)
    })
    blobCache.set(url, promise)
    return promise
}

/** Test hook — drop all cached blobs/peaks. */
export function clearAudioDataCaches(): void {
    blobCache.clear()
    peaksCache.clear()
}

type AudioContextCtor = new () => AudioContext

function resolveAudioContext(): AudioContextCtor {
    const ctor =
        (window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor })
            .AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
    if (!ctor) throw new Error('Web Audio is unavailable')
    return ctor
}

/**
 * Decode the track and reduce it to `buckets` normalized peak values (0..1).
 * Channels are summed (|L| + |R|), each bucket takes its max sample, the whole
 * strip is normalized to the loudest bucket, and quiet passages are floored at
 * 0.08 so every bar stays visible.
 */
async function extractPeaks(blob: Blob, buckets: number): Promise<number[]> {
    const Ctor = resolveAudioContext()
    const ctx = new Ctor()
    try {
        const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
        const left = decoded.getChannelData(0)
        const right = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : null
        const bucketSize = Math.floor(decoded.length / buckets) || 1
        const peaks: number[] = new Array(buckets).fill(0)
        for (let bucket = 0; bucket < buckets; bucket++) {
            const start = bucket * bucketSize
            const end = bucket === buckets - 1 ? decoded.length : Math.min(start + bucketSize, decoded.length)
            let max = 0
            for (let i = start; i < end; i++) {
                const value = Math.abs(left[i] ?? 0) + (right ? Math.abs(right[i] ?? 0) : 0)
                if (value > max) max = value
            }
            peaks[bucket] = max
        }
        const loudest = Math.max(...peaks)
        return peaks.map((peak) => (loudest > 0 ? Math.max(peak / loudest, 0.08) : 0.08))
    } finally {
        void ctx.close().catch(() => undefined)
    }
}

/**
 * Real waveform peaks for a track, cached. Rejects when Web Audio or decoding
 * is unavailable — callers fall back to {@link pseudoPeaks}.
 */
export function getAudioPeaks(url: string, buckets = PEAK_BUCKETS): Promise<number[]> {
    const cached = peaksCache.get(url)
    if (cached) return cached
    const promise = getAudioBlob(url).then((blob) => extractPeaks(blob, buckets))
    promise.catch(() => {
        if (peaksCache.get(url) === promise) peaksCache.delete(url)
    })
    peaksCache.set(url, promise)
    return promise
}

/**
 * Deterministic placeholder peaks for the dormant/fallback waveform: FNV-1a
 * seeds an xorshift PRNG, then a 3-tap neighbor average smooths the contour so
 * it reads as music rather than noise. Pure — stable renders and tests.
 */
export function pseudoPeaks(seed: string, buckets = PEAK_BUCKETS): number[] {
    let hash = 0x811c9dc5
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }
    let state = hash >>> 0 || 1
    const next = () => {
        state ^= state << 13
        state ^= state >>> 17
        state ^= state << 5
        state >>>= 0
        return state / 0xffffffff
    }
    const raw = Array.from({ length: buckets }, () => 0.2 + next() * 0.7)
    return raw.map((value, i) => {
        const prev = raw[i - 1] ?? value
        const after = raw[i + 1] ?? value
        return (prev + value + after) / 3
    })
}
