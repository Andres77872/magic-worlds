import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { ImageLifecycleStatus } from '../../../shared'
import { cx, Icon } from '../../../ui/primitives'

/**
 * GeneratedImage — renders the Game Master's scene image for a chat turn while
 * keeping a placeholder visible continuously across the whole lifecycle.
 *
 * The backend finishes generating *before* the browser has fetched the bytes, so
 * the slow part the player perceives is the download gap right after the
 * `image_complete` frame. To cover it we:
 *   - show a compact "Conjuring…" banner while the job is still generating,
 *   - expand to a space-reserving shimmer box the moment a url arrives (the
 *     download phase) and keep it until the <img> actually paints,
 *   - fade the image in on `onLoad` (no layout shift — the box already holds the
 *     final aspect ratio).
 *
 * `url` is expected to be already safety-filtered by the caller.
 */
interface GeneratedImageProps {
    status: ImageLifecycleStatus | undefined
    url?: string
    width?: number | null
    height?: number | null
    errorDetail?: string
}

const PENDING_STATUSES: ImageLifecycleStatus[] = ['pending', 'in_progress', 'mirroring']
const FAILED_STATUSES: ImageLifecycleStatus[] = ['failed', 'canceled', 'invalid', 'quota_exceeded']

function ImageError({ detail }: { detail?: string }) {
    return (
        <div className="mt-3 rounded-xl border border-blood-500/25 bg-blood-500/10 px-4 py-3 text-[13px] text-blood-200">
            {detail || 'Image generation failed.'}
        </div>
    )
}

/**
 * The completed-image surface. Mounted with `key={url}` by the parent so its
 * load/fade state resets for free whenever the source changes (e.g. regenerate).
 */
function SceneImage({ url, aspectRatio, errorDetail }: { url: string; aspectRatio: number; errorDetail?: string }) {
    const [loaded, setLoaded] = useState(false)
    const [errored, setErrored] = useState(false)

    if (errored) return <ImageError detail={errorDetail} />

    return (
        <figure
            className="relative mt-3 w-full overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-700/70"
            style={{ aspectRatio, maxHeight: 420 }}
        >
            <img
                // If the bytes are already cached the <img> can finish before
                // onLoad attaches; adopt its `complete` state on mount so the
                // shimmer never gets stuck.
                ref={(node) => {
                    if (node?.complete && node.naturalWidth > 0) setLoaded(true)
                }}
                src={url}
                alt="Generated scene"
                className={cx(
                    'absolute inset-0 h-full w-full object-contain transition-opacity duration-500',
                    loaded ? 'opacity-100' : 'opacity-0',
                )}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                onLoad={() => setLoaded(true)}
                onError={() => setErrored(true)}
            />
            {!loaded && (
                <div className="image-shimmer pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Icon icon={Sparkles} size={20} className="animate-pulse text-arcane-300/60" />
                </div>
            )}
        </figure>
    )
}

export function GeneratedImage({ status, url, width, height, errorDetail }: GeneratedImageProps) {
    const completed = status === 'completed'
    // 'unavailable' means image generation is turned off server-side — not a
    // per-turn failure the player can act on, so it renders nothing.
    const failed = status ? FAILED_STATUSES.includes(status) : false

    if (failed) return <ImageError detail={errorDetail} />

    // Completed + url: reserve the final aspect ratio, hold a shimmer over the
    // download, then fade the image in once it paints.
    if (completed && url) {
        const aspectRatio = width && height ? width / height : 3 / 2
        return <SceneImage key={url} url={url} aspectRatio={aspectRatio} errorDetail={errorDetail} />
    }

    // No usable image yet → compact banner while the job is still generating.
    const generating = status ? PENDING_STATUSES.includes(status) : false
    if (!generating) return null
    return (
        <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-arcane-400/25 bg-arcane-500/10 px-4 py-3 text-[13px] text-arcane-200">
            <Icon icon={Sparkles} size={14} className="animate-pulse text-arcane-300" />
            Conjuring the scene…
        </div>
    )
}
