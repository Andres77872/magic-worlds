import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize2 } from 'lucide-react'
import { useAuthenticatedMediaUrl } from '../../../infrastructure/api/useAuthenticatedMediaUrl'
import type { ImageLifecycleStatus } from '../../../shared'
import { cx, Icon, ImageLightbox } from '@/ui/primitives'
import { ImageGenerationStatus } from '@/ui/components'

/**
 * GeneratedImage — renders the Game Master's scene image for a chat turn while
 * keeping a placeholder visible continuously across the whole lifecycle.
 *
 * The backend finishes generating *before* the browser has fetched the bytes, so
 * the slow part the player perceives is the download gap right after the
 * `image_complete` frame. To cover it we:
 *   - show the real job stage in a space-reserving shimmer while generating,
 *   - keep explicit loading feedback until the <img> actually paints,
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

const FAILED_STATUSES: ImageLifecycleStatus[] = ['failed', 'canceled', 'invalid', 'quota_exceeded']

function ImageError({ detail }: { detail?: string }) {
    const { t } = useTranslation()
    return (
        <div role="alert" className="mt-3 border-l-2 border-blood-500/40 py-2 pl-3 text-label text-blood-300">
            {detail || t('interaction.image.failed')}
        </div>
    )
}

/**
 * The completed-image surface. Mounted with `key={url}` by the parent so its
 * load/fade state resets for free whenever the source changes (e.g. regenerate).
 * Once painted, the image opens full size in the shared lightbox.
 */
function SceneImage({ url, aspectRatio }: { url: string; aspectRatio: number }) {
    const { t } = useTranslation()
    const [loaded, setLoaded] = useState(false)
    const [errored, setErrored] = useState(false)
    const [viewerOpen, setViewerOpen] = useState(false)
    const media = useAuthenticatedMediaUrl(url, 'image/*')
    const imageSrc = media.src

    if (errored || media.error) return <ImageError detail={t('interaction.image.loadFailed')} />

    return (
        <figure
            className="group relative mt-4 w-full"
            style={{ aspectRatio, maxHeight: 420 }}
        >
            {imageSrc && (
                // The button owns the rounding/clipping so the global focus ring
                // (an outer box-shadow) is not clipped by the figure.
                <button
                    type="button"
                    onClick={() => setViewerOpen(true)}
                    disabled={!loaded}
                    aria-label={t('interaction.image.viewFullSize')}
                    aria-haspopup="dialog"
                    className="absolute inset-0 cursor-zoom-in overflow-hidden rounded-lg disabled:cursor-default"
                >
                    <img
                        // If the bytes are already cached the <img> can finish before
                        // onLoad attaches; adopt its `complete` state on mount so the
                        // shimmer never gets stuck.
                        ref={(node) => {
                            if (node?.complete && node.naturalWidth > 0) setLoaded(true)
                        }}
                        src={imageSrc}
                        alt={t('interaction.image.alt')}
                        className={cx(
                            'absolute inset-0 h-full w-full object-contain transition-opacity',
                            loaded ? 'opacity-100' : 'opacity-0',
                        )}
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                        onLoad={() => setLoaded(true)}
                        onError={() => setErrored(true)}
                    />
                    {loaded && (
                        <span
                            aria-hidden="true"
                            className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border border-parchment-50/10 bg-ink-900/60 text-parchment-100 opacity-0 shadow-md backdrop-blur-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
                        >
                            <Icon icon={Maximize2} size={16} />
                        </span>
                    )}
                </button>
            )}
            {!loaded && (
                <ImageGenerationStatus stage="loading" className="pointer-events-none absolute inset-0 flex-col justify-center text-center" />
            )}
            {/* Reuse the already-fetched blob URL: protected media is not downloaded twice. */}
            <ImageLightbox
                open={viewerOpen}
                src={imageSrc}
                alt={t('interaction.image.alt')}
                onClose={() => setViewerOpen(false)}
            />
        </figure>
    )
}

export function GeneratedImage({ status, url, width, height, errorDetail }: GeneratedImageProps) {
    const { t } = useTranslation()
    const completed = status === 'completed'
    // 'unavailable' means image generation is turned off server-side — not a
    // per-turn failure the player can act on, so it renders nothing.
    const failed = status ? FAILED_STATUSES.includes(status) : false

    if (failed) return <ImageError detail={errorDetail} />

    // Completed + url: reserve the final aspect ratio, hold a shimmer over the
    // download, then fade the image in once it paints.
    if (completed && url) {
        const aspectRatio = width && height ? width / height : 3 / 2
        return <SceneImage key={url} url={url} aspectRatio={aspectRatio} />
    }

    // No usable image yet → an aspect-reserved shimmer box while the job runs, so
    // the layout doesn't jump when the box later swaps for the painted image.
    if (completed) return <ImageError detail={errorDetail || t('interaction.image.loadFailed')} />
    if (status !== 'pending' && status !== 'in_progress' && status !== 'mirroring') return null
    return (
        <figure
            className="relative mt-4 w-full"
            style={{ aspectRatio: 3 / 2, maxHeight: 420 }}
        >
            <ImageGenerationStatus
                stage={status}
                description={status === 'mirroring' ? undefined : t('imageGeneration.keepChatting')}
                className="absolute inset-0 flex-col justify-center text-center"
            />
        </figure>
    )
}
