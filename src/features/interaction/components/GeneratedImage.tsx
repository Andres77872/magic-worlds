import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize2 } from 'lucide-react'
import { useAuthenticatedMediaUrl } from '../../../infrastructure/api/useAuthenticatedMediaUrl'
import type { ImageLifecycleStatus } from '../../../shared'
import { cx, Icon, IconButton, ImageLightbox } from '@/ui/primitives'
import { ImageGenerationStatus, type ImageGenerationStage } from '@/ui/components'

/**
 * Scene-image building blocks for chat turns. The backend finishes generating
 * *before* the browser has fetched the bytes, so the slow part the player
 * perceives is the download gap right after completion. To cover it:
 *   - a space-reserving shimmer shows the real job stage while generating,
 *   - explicit loading feedback stays until the <img> actually paints,
 *   - the image fades in on `onLoad`, in a box that already holds its aspect
 *     ratio, so nothing jumps.
 *
 * URLs are expected to be already safety-filtered by the caller.
 */

const MAX_SCENE_HEIGHT = 420
/** The shape a scene box reserves before the asset says otherwise. */
export const DEFAULT_SCENE_ASPECT = 3 / 2

/** Glassy controls that float over the artwork (hover and focus; always on touch). */
export const SCENE_OVERLAY_BUTTON = 'border border-parchment-50/10 bg-ink-900/60 text-parchment-100 shadow-md backdrop-blur-md hover:bg-ink-900/80 hover:text-parchment-50'

/** The aspect-reserved box every scene state renders in. */
export function SceneImageFrame({ aspectRatio, className, children }: { aspectRatio: number; className?: string; children: ReactNode }) {
    return (
        <figure className={cx('group relative w-full', className)} style={{ aspectRatio, maxHeight: MAX_SCENE_HEIGHT }}>
            {children}
        </figure>
    )
}

/** A running job, or the wait before it starts: the real stage over a shimmer. */
export function SceneImagePlaceholder({ stage, aspectRatio = DEFAULT_SCENE_ASPECT, description, className }: {
    stage: ImageGenerationStage
    aspectRatio?: number
    description?: string
    className?: string
}) {
    const { t } = useTranslation()
    return (
        <SceneImageFrame aspectRatio={aspectRatio} className={className}>
            <ImageGenerationStatus
                stage={stage}
                description={description ?? (stage === 'mirroring' || stage === 'loading' ? undefined : t('imageGeneration.keepChatting'))}
                className="absolute inset-0 flex-col justify-center text-center"
            />
        </SceneImageFrame>
    )
}

/**
 * A line under the turn for a scene that has no artwork to show: a failure
 * (`danger`, announced) or a quiet state such as a removed image.
 */
export function SceneImageNotice({ tone = 'danger', action, className, children }: {
    tone?: 'danger' | 'quiet'
    action?: ReactNode
    className?: string
    children: ReactNode
}) {
    return (
        <div
            role={tone === 'danger' ? 'alert' : 'status'}
            className={cx(
                'flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 py-2 pl-3 text-label',
                tone === 'danger' ? 'border-blood-500/40 text-blood-300' : 'border-parchment-50/15 text-parchment-300',
                className,
            )}
        >
            <span className="min-w-0">{children}</span>
            {action}
        </div>
    )
}

/**
 * The completed-image surface. Mount it with `key={url}` so its load/fade state
 * resets for free whenever the source changes. Once painted, the image opens
 * full size in the shared lightbox; `actions` float beside the Full size control.
 */
export function SceneImage({ url, aspectRatio, actions, className }: { url: string; aspectRatio: number; actions?: ReactNode; className?: string }) {
    const { t } = useTranslation()
    const [loaded, setLoaded] = useState(false)
    const [errored, setErrored] = useState(false)
    const [viewerOpen, setViewerOpen] = useState(false)
    const media = useAuthenticatedMediaUrl(url, 'image/*')
    const imageSrc = media.src

    if (errored || media.error) return <SceneImageNotice className={className}>{t('interaction.image.loadFailed')}</SceneImageNotice>

    return (
        <SceneImageFrame aspectRatio={aspectRatio} className={className}>
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
                </button>
            )}
            {loaded && (
                <div
                    role="toolbar"
                    aria-label={t('interaction.image.actions')}
                    className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
                >
                    {actions}
                    <IconButton label={t('interaction.image.fullSize')} size="sm" className={SCENE_OVERLAY_BUTTON} aria-haspopup="dialog" onClick={() => setViewerOpen(true)}>
                        <Icon icon={Maximize2} size={16} />
                    </IconButton>
                </div>
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
        </SceneImageFrame>
    )
}

interface GeneratedImageProps {
    status: ImageLifecycleStatus | undefined
    url?: string
    width?: number | null
    height?: number | null
    errorDetail?: string
}

const FAILED_STATUSES: ImageLifecycleStatus[] = ['failed', 'canceled', 'invalid', 'quota_exceeded']

/** One scene image at one lifecycle status, with a placeholder held across the whole lifecycle. */
export function GeneratedImage({ status, url, width, height, errorDetail }: GeneratedImageProps) {
    const { t } = useTranslation()
    const completed = status === 'completed'
    // 'unavailable' means image generation is turned off server-side — not a
    // per-turn failure the player can act on, so it renders nothing.
    const failed = status ? FAILED_STATUSES.includes(status) : false

    if (failed) return <SceneImageNotice className="mt-3">{errorDetail || t('interaction.image.failed')}</SceneImageNotice>

    if (completed && url) {
        const aspectRatio = width && height ? width / height : DEFAULT_SCENE_ASPECT
        return <SceneImage key={url} url={url} aspectRatio={aspectRatio} className="mt-4" />
    }

    if (completed) return <SceneImageNotice className="mt-3">{errorDetail || t('interaction.image.loadFailed')}</SceneImageNotice>
    if (status !== 'pending' && status !== 'in_progress' && status !== 'mirroring') return null
    return <SceneImagePlaceholder stage={status} className="mt-4" />
}
