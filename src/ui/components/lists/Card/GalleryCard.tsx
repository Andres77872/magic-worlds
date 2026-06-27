/**
 * GalleryCard — image-forward card for dense, paginated galleries. The 3:4
 * portrait (cover image or seeded gradient) IS the card; name + identity badge
 * sit on the bottom vignette with up to three trigger pills, and actions live
 * in a hover-revealed menu so a wall of cards stays calm until pointed at.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, ListMusic, Loader2, Pause, Play, Share2 } from 'lucide-react'
import { usePlaylist } from '@/app/hooks/usePlaylist'
import { themeTrack, type PlaylistTrack } from '@/app/providers/audioPlaylistContext'
import { useCardUsage } from '@/shared/hooks/useCardUsage'
import type { VersionableCardType } from '@/shared'
import { downloadThemeSong } from '@/ui/components/audio/downloadThemeSong'
import { CardUsageLine } from '@/ui/components/common/CardUsageLine'
import { Badge, Card, CardDeletingOverlay, cx, Icon, Portrait, Tag, ThemeSongButton } from '@/ui/primitives'
import { CardActionMenu, CardOptions, type CardOption } from './CardOptions'
import { CARD_ACTION_REVEAL_CLASS, SELECTED_CARD_CLASS } from './cardStyles'
import { useCardActionContextMenu } from './useCardActionContextMenu'

export interface GalleryCardProps {
    id?: string
    title: string
    /** Identity badge beside the name: race / world type / world name. */
    badge?: string
    /** Trigger + category pills (capped at 3 in render). */
    tags?: string[]
    /** When provided, pills become buttons that push the tag into the search. */
    onTagClick?: (tag: string) => void
    imageUrl?: string
    themeSongUrl?: string
    cardType?: PlaylistTrack['cardType']
    cardId?: string
    /** Hover share menu actions (Download PNG / future URL share). */
    shareOptions?: CardOption[]
    /** Hover-menu actions (Chat / Edit / Delete / Begin). */
    options?: CardOption[]
    /** Primary action for the whole card (also Enter/Space). */
    onClick?: () => void
    /** Accessible name for the card's primary action. */
    actionLabel?: string
    /** Accessible name for the share menu trigger. */
    shareLabel?: string
    highlighted?: boolean
    deleting?: boolean
    /**
     * `default` — gallery pages. `compact` — dashboard rails: smaller title,
     * tighter vignette, tags capped at 2 so narrow cards stay legible.
     */
    size?: 'default' | 'compact'
    /**
     * `card` (default) — the image-forward 3:4 portrait tile. `row` — a
     * horizontal, full-width list row (thumbnail + text + trailing actions) for
     * `CardGrid`'s `list` layout. Every feature (badges, version/draft chips,
     * theme song, share/options menus, tags, usage, footer CTA, highlight,
     * deleting) is preserved — only the arrangement changes.
     */
    view?: 'card' | 'row'
    /** Mono "where" label above the name (e.g. a world/location); shown when set. */
    eyebrow?: string
    /** One-line narrative hook under the name — the card's substance line. */
    description?: string
    /** Curated fallback gradient painted behind the image (e.g. showcase worlds). */
    gradient?: string
    /** Static, non-authenticated image (bundled marketing art) — bypasses the media hook. */
    staticImageUrl?: string
    /** Marketing/static card: no action bubble, no playlist/menu side effects. */
    staticCard?: boolean
    /** Pinned action row at the bottom of the vignette (e.g. a Chat button). */
    footer?: ReactNode
    /** Newest saved version number — renders a "v{n}" chip when > 0. */
    versionNumber?: number
    /** Owner-only: renders a "Draft" chip when there are unpublished edits. */
    hasDraft?: boolean
    /** Card type for the usage lookup; required alongside `usageEnabled`. */
    usageCardType?: VersionableCardType
    /** Opt in to fetching + showing the usage line (owned-library galleries only). */
    usageEnabled?: boolean
    'data-testid'?: string
}

export function GalleryCard({
    id,
    title,
    badge,
    tags = [],
    onTagClick,
    imageUrl,
    themeSongUrl,
    cardType,
    cardId,
    shareOptions,
    options,
    onClick,
    actionLabel,
    shareLabel,
    highlighted = false,
    deleting = false,
    size = 'default',
    view = 'card',
    eyebrow,
    description,
    gradient,
    staticImageUrl,
    staticCard = false,
    footer,
    versionNumber,
    hasDraft = false,
    usageCardType,
    usageEnabled = false,
    'data-testid': testId = 'gallery-card',
}: GalleryCardProps) {
    const { t } = useTranslation()
    const interactive = Boolean(onClick) && !deleting
    const cardRef = useRef<HTMLDivElement>(null!)
    const [menuOpen, setMenuOpen] = useState(false)
    const [themeDownloadState, setThemeDownloadState] = useState<{
        url: string
        downloading: boolean
        error: boolean
    } | null>(null)
    const playlist = usePlaylist()
    const isThemePlaying = Boolean(themeSongUrl) && playlist.currentTrack?.id === themeSongUrl && playlist.isPlaying
    const compact = size === 'compact'
    const visibleTags = tags.slice(0, compact ? 2 : 3)
    const extraTagCount = Math.max(0, tags.length - visibleTags.length)
    const showVersion = typeof versionNumber === 'number' && versionNumber > 0
    // Usage is an extra request per card, so only fetch once a card scrolls near the
    // viewport (jsdom / no-IO environments enable immediately). Results are cached.
    const wantUsage = usageEnabled && Boolean(usageCardType) && Boolean(cardId)
    const [usageInView, setUsageInView] = useState(false)
    useEffect(() => {
        if (!wantUsage) return
        const node = cardRef.current
        if (!node || typeof IntersectionObserver === 'undefined') {
            setUsageInView(true)
            return
        }
        const observer = new IntersectionObserver(
            (entries, obs) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setUsageInView(true)
                    obs.disconnect()
                }
            },
            { rootMargin: '200px' },
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [wantUsage])
    const usage = useCardUsage(usageCardType ?? null, cardId, { enabled: wantUsage && usageInView })
    // The description is the substance line (like the landing showcase); only fall
    // back to trigger pills when a card has no description, so every card stays clean.
    const showTags = tags.length > 0 && !description
    // The hover action bubble (and its empty pill) only exists when it has content.
    const hasBubble =
        !staticCard && (Boolean(themeSongUrl) || (shareOptions?.length ?? 0) > 0 || (options?.length ?? 0) > 0)
    const activeThemeDownloadState =
        themeSongUrl && themeDownloadState?.url === themeSongUrl ? themeDownloadState : null
    const downloadingTheme = Boolean(activeThemeDownloadState?.downloading)
    const themeDownloadError = Boolean(activeThemeDownloadState?.error)

    const handleDownloadTheme = useCallback(() => {
        if (!themeSongUrl || downloadingTheme) return
        const requestUrl = themeSongUrl
        setThemeDownloadState({ url: requestUrl, downloading: true, error: false })
        void downloadThemeSong({ url: requestUrl, title })
            .then(() => {
                setThemeDownloadState((state) => (state?.url === requestUrl ? null : state))
            })
            .catch(() => {
                setThemeDownloadState((state) =>
                    state?.url === requestUrl ? { url: requestUrl, downloading: false, error: true } : state,
                )
            })
    }, [downloadingTheme, themeSongUrl, title])

    const contextOptions = useMemo<CardOption[]>(() => {
        const musicOptions: CardOption[] = themeSongUrl
            ? [
                  {
                      type: 'custom',
                      icon: <Icon icon={isThemePlaying ? Pause : Play} size={15} />,
                      label: isThemePlaying ? t('playlist.pauseMusic') : t('playlist.playMusic'),
                      onClick: () =>
                          playlist.playNow(themeTrack({ url: themeSongUrl, cardName: title, cardType, cardId, artworkUrl: imageUrl })),
                  },
                  {
                      type: 'custom',
                      icon: <Icon icon={ListMusic} size={15} />,
                      label: playlist.isQueued(themeSongUrl) ? t('playlist.inPlaylist') : t('playlist.addToPlaylist'),
                      disabled: playlist.isQueued(themeSongUrl),
                      onClick: () =>
                          playlist.enqueue(themeTrack({ url: themeSongUrl, cardName: title, cardType, cardId, artworkUrl: imageUrl })),
                  },
                  {
                      type: 'custom',
                      icon: downloadingTheme ? (
                          <Icon icon={Loader2} size={15} className="animate-spin" />
                      ) : (
                          <Icon icon={Download} size={15} />
                      ),
                      label: themeDownloadError
                          ? t('playlist.retryThemeDownload')
                          : downloadingTheme
                            ? t('playlist.downloadingTheme')
                            : t('playlist.downloadTheme'),
                      disabled: downloadingTheme,
                      onClick: handleDownloadTheme,
                  },
              ]
            : []
        return [...musicOptions, ...(shareOptions ?? []), ...(options ?? [])]
    }, [
        options,
        shareOptions,
        isThemePlaying,
        playlist,
        themeSongUrl,
        title,
        cardType,
        cardId,
        imageUrl,
        downloadingTheme,
        themeDownloadError,
        handleDownloadTheme,
        t,
    ])
    const contextMenu = useCardActionContextMenu({
        options: staticCard ? [] : contextOptions,
        disabled: deleting,
        returnFocusRef: cardRef,
        onOpenChange: setMenuOpen,
    })

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (contextMenu.handleContextMenuKeyDown(e)) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
        }
    }

    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
        if (contextMenu.suppressClickAfterLongPress(e)) return
        onClick?.()
    }

    // Shared pointer/keyboard wiring for the root surface — identical for the
    // portrait tile and the list row so both honour click, context menu, and
    // long-press the same way.
    const rootHandlers = {
        onClick: interactive ? handleClick : undefined,
        onKeyDown: interactive ? handleKeyDown : undefined,
        onContextMenu: contextMenu.handleContextMenu,
        onPointerDown: contextMenu.pointerHandlers.onPointerDown,
        onPointerMove: contextMenu.pointerHandlers.onPointerMove,
        onPointerCancel: contextMenu.pointerHandlers.onPointerCancel,
        onPointerLeave: contextMenu.pointerHandlers.onPointerLeave,
        onPointerUp: contextMenu.pointerHandlers.onPointerUp,
    }

    // The list row's trailing action affordance: a single overflow menu carrying
    // the full action set (theme play/queue/download + share + edit/delete…) —
    // the same `contextOptions` the right-click menu uses. One fixed-width ⋯ keeps
    // every row's trailing edge aligned (a variable icon strip made it ragged) and
    // its hover-reveal slot stays in flow, so the CTAs never shift. The portrait
    // tile keeps its own translucent bubble, so only build this for rows.
    const rowMenu = view === 'row' && !staticCard && contextOptions.length > 0 ? (
        <div className={cx('flex shrink-0 items-center', CARD_ACTION_REVEAL_CLASS)}>
            <CardOptions options={contextOptions} aria-label={t('galleryCard.actions', { title })} onOpenChange={setMenuOpen} />
        </div>
    ) : null

    if (view === 'row') {
        return (
            <Card
                ref={cardRef}
                interactive={interactive}
                role={interactive ? 'button' : 'article'}
                tabIndex={interactive ? 0 : undefined}
                aria-label={actionLabel || title}
                aria-busy={deleting || undefined}
                {...rootHandlers}
                className={cx(
                    'group relative flex w-full items-center gap-3 p-2.5 sm:gap-4 sm:p-3',
                    (highlighted || menuOpen) && cx(SELECTED_CARD_CLASS, 'shadow-card-hover'),
                    deleting && 'pointer-events-none opacity-60',
                )}
                data-gallery-card-id={id}
                data-testid={testId}
            >
                <Portrait
                    name={title}
                    src={imageUrl}
                    staticSrc={staticImageUrl}
                    gradient={gradient}
                    height={72}
                    lazy
                    className="w-[54px] shrink-0 rounded-md group-hover:[&>img]:scale-[1.04]"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-2">
                        <h3 className="m-0 min-w-0 truncate font-display text-[17px] font-semibold leading-tight text-parchment-50" title={title}>
                            {title}
                        </h3>
                        {badge && <Badge tone="glass" className="hidden shrink-0 sm:inline-flex">{badge}</Badge>}
                        {showVersion && (
                            <Badge tone="glass" className="hidden shrink-0 font-mono sm:inline-flex">
                                {t('cardVersions.drawer.versionLabel', { number: versionNumber })}
                            </Badge>
                        )}
                        {hasDraft && <Badge tone="ember" className="shrink-0">{t('cardVersions.gallery.draftPending')}</Badge>}
                    </div>
                    {(eyebrow || description) && (
                        <p className="m-0 truncate font-narrative text-label leading-snug text-parchment-200">
                            {eyebrow && <span className="font-mono text-meta text-ember-400">{eyebrow}</span>}
                            {eyebrow && description && <span className="text-parchment-400"> · </span>}
                            {description}
                        </p>
                    )}
                    {(tags.length > 0 || usage) && (
                        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden pt-0.5">
                            {visibleTags.map((tag) =>
                                onTagClick ? (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={(e: MouseEvent) => {
                                            e.stopPropagation()
                                            onTagClick(tag)
                                        }}
                                        aria-label={t('galleryCard.searchFor', { tag })}
                                        className="min-w-0 max-w-[40%] shrink cursor-pointer truncate whitespace-nowrap rounded-full bg-ink-600 px-2 py-[2px] font-ui text-micro font-semibold text-parchment-200 transition-colors hover:bg-ember-500/25 hover:text-ember-300"
                                    >
                                        {tag}
                                    </button>
                                ) : (
                                    <Tag key={tag} className="min-w-0 max-w-[40%] shrink truncate whitespace-nowrap">
                                        {tag}
                                    </Tag>
                                ),
                            )}
                            {extraTagCount > 0 && <Tag className="shrink-0 text-parchment-300">+{extraTagCount}</Tag>}
                            {usage && <CardUsageLine usage={usage} className="shrink-0 truncate text-parchment-400" />}
                        </div>
                    )}
                </div>

                {(footer || rowMenu) && (
                    <div className="flex shrink-0 items-center gap-2" onClick={(e: MouseEvent) => e.stopPropagation()}>
                        {footer && <div className="hidden items-center sm:flex">{footer}</div>}
                        {rowMenu}
                    </div>
                )}

                <CardActionMenu
                    {...contextMenu.menuProps}
                    menuTestId="card-context-menu"
                    optionTestIdPrefix="card-context-option"
                />

                {deleting && <CardDeletingOverlay label={t('galleryCard.deleting')} />}
            </Card>
        )
    }

    return (
        <Card
            ref={cardRef}
            interactive={interactive}
            role={interactive ? 'button' : 'article'}
            tabIndex={interactive ? 0 : undefined}
            aria-label={actionLabel || title}
            aria-busy={deleting || undefined}
            {...rootHandlers}
            className={cx(
                'group relative flex h-full flex-col',
                (highlighted || menuOpen) && cx(SELECTED_CARD_CLASS, 'shadow-card-hover'),
                deleting && 'pointer-events-none opacity-60',
            )}
            data-gallery-card-id={id}
            data-testid={testId}
        >
            <Portrait
                name={title}
                src={imageUrl}
                staticSrc={staticImageUrl}
                gradient={gradient}
                height="auto"
                lazy
                className="aspect-[3/4] w-full group-hover:[&>img]:scale-[1.035]"
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24 bg-gradient-to-b from-ink-900/72 to-transparent" />
                <div className="pointer-events-none absolute inset-0 z-[1] ring-1 ring-inset ring-parchment-50/[.08]" />
                {/* Candlelit bottom gradient: lifts the name/description/CTA off the art.
                    Graceful (depth by softness), not a heavy slab. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[62%] bg-gradient-to-t from-ink-900 via-ink-900/70 to-transparent" />
                {(badge || showVersion || hasDraft) && (
                    <div className="absolute left-3 top-3 z-[3] flex max-w-[65%] flex-col items-start gap-1">
                        {badge && <Badge tone="glass" className="max-w-full truncate">{badge}</Badge>}
                        {showVersion && (
                            <Badge tone="glass" className="font-mono">
                                {t('cardVersions.drawer.versionLabel', { number: versionNumber })}
                            </Badge>
                        )}
                        {hasDraft && <Badge tone="ember">{t('cardVersions.gallery.draftPending')}</Badge>}
                    </div>
                )}
                {hasBubble && (
                <div
                    className="absolute right-2 top-2 z-[4] flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full border border-parchment-50/10 bg-ink-900/55 p-1 opacity-100 shadow-md backdrop-blur-md transition-opacity sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100"
                    onClick={(e: MouseEvent) => e.stopPropagation()}
                >
                    {themeSongUrl && <ThemeSongButton src={themeSongUrl} cardName={title} cardType={cardType} cardId={cardId} artworkUrl={imageUrl} />}
                    {shareOptions && shareOptions.length > 0 && (
                        <CardOptions
                            options={shareOptions}
                            aria-label={shareLabel || t('galleryCard.share', { title })}
                            triggerIcon={<Icon icon={Share2} size={16} />}
                            triggerTestId="card-share-button"
                            menuTestId="card-share-menu"
                            optionTestIdPrefix="card-share-option"
                            forceMenu
                            onOpenChange={setMenuOpen}
                        />
                    )}
                    {options && options.length > 0 && (
                        <CardOptions options={options} aria-label={t('galleryCard.actions', { title })} onOpenChange={setMenuOpen} />
                    )}
                </div>
                )}

                <div className={cx('absolute inset-x-0 bottom-0 z-[2] flex flex-col', compact ? 'gap-1 p-3' : 'gap-1.5 p-4')}>
                    {eyebrow && (
                        <div className={cx('truncate font-mono text-ember-400', compact ? 'text-micro' : 'text-meta')}>
                            {eyebrow}
                        </div>
                    )}
                    <h3
                        className={cx(
                            'm-0 line-clamp-2 font-display font-semibold leading-[1.1] text-parchment-50',
                            compact ? 'text-[17px]' : 'text-[22px]',
                        )}
                        title={title}
                    >
                        {title}
                    </h3>
                    {description && (
                        <p
                            className={cx(
                                'm-0 line-clamp-2 font-narrative text-parchment-200',
                                compact ? 'text-label leading-[1.4]' : 'text-[14.5px] leading-[1.45]',
                            )}
                        >
                            {description}
                        </p>
                    )}
                    {showTags && (
                        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                            {visibleTags.map((tag) =>
                                onTagClick ? (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={(e: MouseEvent) => {
                                            e.stopPropagation()
                                            onTagClick(tag)
                                        }}
                                        aria-label={t('galleryCard.searchFor', { tag })}
                                        className="min-w-0 max-w-[60%] shrink cursor-pointer truncate whitespace-nowrap rounded-full bg-ink-900/65 px-2 py-[2px] font-ui text-micro font-semibold text-parchment-200 backdrop-blur transition-colors hover:bg-ember-500/25 hover:text-ember-300"
                                    >
                                        {tag}
                                    </button>
                                ) : (
                                    <Tag key={tag} className="min-w-0 max-w-[60%] shrink truncate whitespace-nowrap bg-ink-900/65 backdrop-blur">
                                        {tag}
                                    </Tag>
                                ),
                            )}
                            {extraTagCount > 0 && (
                                <Tag className="shrink-0 bg-ink-900/65 text-parchment-300 backdrop-blur">
                                    +{extraTagCount}
                                </Tag>
                            )}
                        </div>
                    )}
                    {usage && <CardUsageLine usage={usage} className="truncate text-parchment-300" />}
                    {footer && (
                        <div className="pt-1" onClick={(e: MouseEvent) => e.stopPropagation()}>
                            {footer}
                        </div>
                    )}
                </div>
            </Portrait>

            <CardActionMenu
                {...contextMenu.menuProps}
                menuTestId="card-context-menu"
                optionTestIdPrefix="card-context-option"
            />

            {deleting && <CardDeletingOverlay label={t('galleryCard.deleting')} />}
        </Card>
    )
}
