/**
 * Reverie character portrait frame — faint display initial on a warm gradient
 * (or image), with a bottom vignette so overlaid text/badges stay legible.
 * Mirrors ui_kits/app/components.jsx `Portrait`.
 *
 * Image loading is deliberately calm: the seeded gradient + initial is always
 * the resting placeholder, an `.image-shimmer` sweep covers the fetch/decode
 * window, and the image fades in once it actually paints (no pop). With `lazy`,
 * the protected-media blob fetch itself is deferred until the frame nears the
 * viewport, so a wall of cards resolves in scroll order instead of all at once.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuthenticatedMediaUrl } from '@/infrastructure/api/useAuthenticatedMediaUrl'
import { cx } from './cx'
import { gradientFor } from './gradient'

interface PortraitProps {
    name?: string
    src?: string | null
    /** Pixel height, or any CSS height (e.g. 'auto' with an aspect-ratio class). */
    height?: number | string
    gradient?: string
    /**
     * Defer the media fetch until the frame nears the viewport (one-shot
     * IntersectionObserver). For dense grids of authenticated images so they
     * don't all fetch in parallel and resolve out of order.
     */
    lazy?: boolean
    className?: string
    children?: ReactNode
}

export function Portrait({ name = '', src, height = 160, gradient, lazy = false, className, children }: PortraitProps) {
    const initial = name.trim().charAt(0).toUpperCase() || '?'
    const containerRef = useRef<HTMLDivElement>(null)
    // Seed the SSR/no-IO fallback into initial state so the effect never has to
    // setState synchronously (eager when not lazy, or when IO is unavailable).
    const [inView, setInView] = useState(() => !lazy || typeof IntersectionObserver === 'undefined')
    const [loaded, setLoaded] = useState(false)
    const [errored, setErrored] = useState(false)

    // Gate the blob fetch on visibility. One-shot: inView only flips false→true,
    // so the hook fetches (and later revokes) the object URL exactly once.
    // NOTE: jsdom's IntersectionObserver stub (test/setup.ts) never fires its
    // callback, so in unit tests a `lazy` frame stays out-of-view and the image
    // is never fetched — same accepted caveat as GeneratedImage's onLoad.
    useEffect(() => {
        if (!lazy || inView) return
        const node = containerRef.current
        if (!node) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setInView(true)
                    observer.disconnect()
                }
            },
            { rootMargin: '200px 0px', threshold: 0 },
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [lazy, inView])

    const media = useAuthenticatedMediaUrl(inView ? src : null, 'image/*')
    const imageSrc = media.src
    const showImage = Boolean(imageSrc) && !errored
    // Shimmer covers the gap between "a source exists" and "the image painted":
    // the blob fetch (media.loading) and the browser decode (imageSrc && !loaded).
    const showShimmer = !errored && (media.loading || (Boolean(imageSrc) && !loaded))

    return (
        <div
            ref={containerRef}
            className={cx('relative flex items-center justify-center overflow-hidden', className)}
            style={{ height, background: showImage && loaded ? undefined : gradient || gradientFor(name || 'reverie') }}
        >
            {showImage && (
                <img
                    // If the bytes are already cached the <img> can finish before
                    // onLoad attaches; adopt its `complete` state on mount so the
                    // shimmer never gets stuck.
                    ref={(node) => {
                        if (node?.complete && node.naturalWidth > 0) setLoaded(true)
                    }}
                    src={imageSrc}
                    alt={name}
                    loading={lazy ? 'lazy' : undefined}
                    decoding="async"
                    onLoad={() => setLoaded(true)}
                    onError={() => setErrored(true)}
                    className={cx(
                        // Base `transition` covers opacity (fade-in) AND transform
                        // (GalleryCard's group-hover scale) in one declaration, so
                        // there's no transition-property specificity fight with a
                        // `[&>img]` variant on the parent.
                        'absolute inset-0 h-full w-full object-cover transition duration-500',
                        loaded ? 'opacity-100' : 'opacity-0',
                    )}
                />
            )}
            {showShimmer && <div className="image-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />}
            <span
                className="font-display font-semibold leading-none text-parchment-50/20"
                style={{ fontSize: typeof height === 'number' ? Math.round(height * 0.42) : 64 }}
            >
                {initial}
            </span>
            <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-[38%] to-ink-800/82"
                aria-hidden="true"
            />
            {children}
        </div>
    )
}
