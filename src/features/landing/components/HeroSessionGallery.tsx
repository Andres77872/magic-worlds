/**
 * HeroSessionGallery — the dashboard's paged hero carousel for the user's most
 * recently updated chats and adventures. One cinematic slide fills the band at
 * a time (no cropped neighbors, no edge fades, hidden scrollbar); chevrons and
 * pagination dots page between slides, and the CTA + accent color follow the
 * play mode.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthenticatedMediaUrl } from '@/infrastructure/api/useAuthenticatedMediaUrl'
import { Badge, Button, Eyebrow, Icon, IconButton, cx, gradientFor } from '@/ui/primitives'
import { RESUME_KIND_META, type ResumeSession } from './resumeModel'

const MAX_HERO_SESSIONS = 10

export interface HeroSessionGalleryProps {
    sessions: ResumeSession[]
    onOpen: (session: ResumeSession) => void
    onBeginNew: () => void
}

export function HeroSessionGallery({ sessions, onOpen, onBeginNew }: HeroSessionGalleryProps) {
    const { t } = useTranslation()
    const scrollerRef = useRef<HTMLDivElement>(null)
    const visibleSessions = sessions.slice(0, MAX_HERO_SESSIONS)
    const slideCount = visibleSessions.length
    const [activeIndex, setActiveIndex] = useState(0)

    const updateActiveIndex = useCallback(() => {
        const scroller = scrollerRef.current
        if (!scroller) return
        const step = slideStep(scroller)
        if (step <= 0) return
        setActiveIndex(Math.max(0, Math.min(Math.round(scroller.scrollLeft / step), slideCount - 1)))
    }, [slideCount])

    // Always to an exact step multiple — it coincides with the snap points, so
    // the mandatory snap never fights the programmatic scroll.
    const scrollToIndex = (index: number) => {
        const scroller = scrollerRef.current
        if (!scroller) return
        const clamped = Math.max(0, Math.min(index, slideCount - 1))
        scroller.scrollTo({
            left: clamped * slideStep(scroller),
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        })
    }

    useEffect(() => {
        updateActiveIndex()
        window.addEventListener('resize', updateActiveIndex)
        return () => window.removeEventListener('resize', updateActiveIndex)
    }, [updateActiveIndex])

    if (slideCount === 0) return null

    const showControls = slideCount > 1

    return (
        <section className="relative" aria-label={t('landing.heroGallery.aria')} data-testid="hero-session-gallery">
            {showControls && (
                <div className="absolute right-4 top-4 z-10 flex gap-2 sm:right-5 sm:top-5">
                    <IconButton
                        label={t('landing.heroGallery.previous')}
                        size="sm"
                        onClick={() => scrollToIndex(activeIndex - 1)}
                        disabled={activeIndex === 0}
                        className="border border-parchment-50/10 bg-ink-900/55 backdrop-blur disabled:opacity-35"
                    >
                        <Icon icon={ChevronLeft} size={17} />
                    </IconButton>
                    <IconButton
                        label={t('landing.heroGallery.next')}
                        size="sm"
                        onClick={() => scrollToIndex(activeIndex + 1)}
                        disabled={activeIndex === slideCount - 1}
                        className="border border-parchment-50/10 bg-ink-900/55 backdrop-blur disabled:opacity-35"
                    >
                        <Icon icon={ChevronRight} size={17} />
                    </IconButton>
                </div>
            )}

            {/* Default align-stretch keeps every slide the height of the
                tallest one, so the band doesn't jump while paging. */}
            <div
                ref={scrollerRef}
                className="flex gap-4 overflow-x-auto [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="list"
                onScroll={updateActiveIndex}
            >
                {visibleSessions.map((session, index) => (
                    <div
                        key={`${session.kind}-${session.id}`}
                        className="w-full shrink-0 [scroll-snap-align:start]"
                        role="listitem"
                    >
                        {/* Only the active slide and its immediate neighbors fetch
                            their (authed) artwork — paging in pulls the next one's
                            image, so a 10-slide carousel never fires 10 blob
                            fetches (× the doubled blur+sharp layers) on mount. */}
                        <HeroSessionSlide
                            session={session}
                            eager={Math.abs(index - activeIndex) <= 1}
                            onOpen={() => onOpen(session)}
                            onBeginNew={onBeginNew}
                        />
                    </div>
                ))}
            </div>

            {showControls && (
                <div className="mt-3 flex items-center justify-center gap-1.5">
                    {visibleSessions.map((session, index) => (
                        <button
                            key={`${session.kind}-${session.id}`}
                            type="button"
                            aria-label={t('landing.heroGallery.goToSlide', { index: index + 1, total: slideCount })}
                            aria-current={index === activeIndex || undefined}
                            data-testid="hero-session-dot"
                            onClick={() => scrollToIndex(index)}
                            className="group flex h-4 items-center px-0.5"
                        >
                            <span
                                className={cx(
                                    'h-1.5 rounded-full transition-all duration-200',
                                    index === activeIndex
                                        ? 'w-5 bg-ember-400'
                                        : 'w-1.5 bg-parchment-50/25 group-hover:bg-parchment-50/45',
                                )}
                            />
                        </button>
                    ))}
                </div>
            )}
        </section>
    )
}

interface HeroSessionSlideProps {
    session: ResumeSession
    /** Active slide ± 1 — only these fetch their authed artwork. */
    eager: boolean
    onOpen: () => void
    onBeginNew: () => void
}

function HeroSessionSlide({ session, eager, onOpen, onBeginNew }: HeroSessionSlideProps) {
    const { t } = useTranslation()
    const meta = RESUME_KIND_META[session.kind]
    const isArcane = meta.tone === 'arcane'
    const media = useAuthenticatedMediaUrl(eager ? session.imageUrl ?? undefined : undefined, 'image/*')
    const imageSrc = media.error ? undefined : media.src
    const hasImage = Boolean(imageSrc)
    const monogram = session.title.charAt(0).toUpperCase() || '?'
    const label = t(meta.labelKey)
    const eyebrow = [t('landing.heroGallery.tonight'), label, session.context].filter(Boolean).join(' · ')
    const actionLabel = t(meta.resumeLabelKey)
    const actionIcon = meta.icon
    const fallback = t(meta.fallbackSnippetKey)

    return (
        <article
            // min-h (not h): a fixed height makes the content column overflow
            // on two-line titles, and flex-shrink then crushes the clamped
            // title/snippet mid-glyph. Growing beats amputating.
            className="relative flex h-full min-h-[340px] overflow-hidden rounded-2xl border border-parchment-50/10 shadow-xl sm:min-h-[420px]"
            data-testid="hero-session-slide"
        >
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                {hasImage ? (
                    <>
                        <img
                            src={imageSrc}
                            alt=""
                            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl"
                        />
                        <img
                            src={imageSrc}
                            alt=""
                            className="absolute inset-y-0 right-0 h-full w-[78%] object-cover [mask-image:linear-gradient(90deg,transparent,black_32%)] sm:w-[66%]"
                        />
                    </>
                ) : (
                    <div
                        className={cx('absolute inset-0', media.loading && 'image-shimmer')}
                        style={media.loading ? undefined : { background: gradientFor(session.title) }}
                    />
                )}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(95deg, rgba(14,12,20,.94) 0%, rgba(14,12,20,.66) 48%, rgba(14,12,20,.12) 100%)',
                    }}
                />
                <div
                    className="absolute inset-x-0 bottom-0 h-28"
                    style={{ background: 'linear-gradient(180deg, transparent, rgba(14,12,20,.55))' }}
                />
                {!hasImage && !media.loading && (
                    <span
                        className="absolute right-2 top-1/2 -translate-y-1/2 select-none font-display font-semibold leading-none text-parchment-50/10 sm:right-10"
                        style={{ fontSize: 'clamp(150px, 22vw, 280px)' }}
                    >
                        {monogram}
                    </span>
                )}
                <div
                    className={cx(
                        'absolute inset-0 rounded-2xl ring-1 ring-inset',
                        isArcane ? 'ring-arcane-300/15' : 'ring-ember-300/15',
                    )}
                />
            </div>

            <div className="relative z-[2] flex max-w-full flex-col justify-center gap-4 p-7 sm:p-12 md:max-w-[64%]">
                <div className="flex flex-wrap items-center gap-2.5">
                    <Eyebrow tone={meta.tone}>{eyebrow}</Eyebrow>
                    <Badge tone={meta.tone} icon={<Icon icon={meta.icon} size={12} />}>
                        {label}
                    </Badge>
                </div>
                {/* pb gives Cormorant's long descenders room past line-clamp's
                    crop edge (it cuts at the padding box); -mb keeps rhythm. */}
                <h2 className="m-0 line-clamp-2 -mb-[0.2em] pb-[0.2em] font-display text-[clamp(36px,5vw,60px)] font-semibold leading-[1.02] text-parchment-50">
                    {session.title}
                </h2>
                <p
                    className={cx(
                        'm-0 line-clamp-2 max-w-[52ch] font-narrative text-narrative leading-relaxed text-parchment-200',
                        session.snippet && 'italic',
                    )}
                >
                    {session.snippet || fallback}
                </p>
                <p className="m-0 font-mono text-[12px] tracking-wide text-parchment-300">
                    {session.playingAs
                        ? t('landing.heroGallery.playingAs', { meta: session.meta, name: session.playingAs })
                        : session.meta}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button
                        variant={isArcane ? 'arcane' : 'primary'}
                        size="lg"
                        iconLeft={<Icon icon={actionIcon} size={18} />}
                        onClick={onOpen}
                    >
                        {actionLabel}
                    </Button>
                    <Button variant="secondary" onClick={onBeginNew}>
                        {t('landing.heroGallery.beginNew')}
                    </Button>
                </div>
            </div>
        </article>
    )
}

/** Distance between adjacent snap points — slide width + the flex gap. */
function slideStep(scroller: HTMLElement): number {
    const first = scroller.children.item(0) as HTMLElement | null
    const second = scroller.children.item(1) as HTMLElement | null
    if (first && second) return second.offsetLeft - first.offsetLeft
    return scroller.clientWidth
}

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
