/**
 * GalleryCard — image-forward card for dense, paginated galleries. The 3:4
 * portrait (cover image or seeded gradient) IS the card; name + identity badge
 * sit on the bottom vignette with up to three trigger pills, and actions live
 * in a hover-revealed menu so a wall of cards stays calm until pointed at.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, ListMusic, Loader2, Pause, Play, Share2 } from 'lucide-react'
import { usePlaylist } from '@/app/hooks/usePlaylist'
import { themeTrack, type PlaylistTrack } from '@/app/providers/audioPlaylistContext'
import { downloadThemeSong } from '@/ui/components/audio/downloadThemeSong'
import { Badge, Card, cx, Icon, Portrait, Tag, ThemeSongButton } from '@/ui/primitives'
import { CardActionMenu, CardOptions, type CardMenuAnchor, type CardOption } from './CardOptions'

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
    'data-testid'?: string
}

const LONG_PRESS_MS = 520

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
    eyebrow,
    description,
    gradient,
    staticImageUrl,
    staticCard = false,
    footer,
    'data-testid': testId = 'gallery-card',
}: GalleryCardProps) {
    const { t } = useTranslation()
    const interactive = Boolean(onClick) && !deleting
    const cardRef = useRef<HTMLDivElement>(null!)
    const longPressTimerRef = useRef<number | null>(null)
    const didLongPressRef = useRef(false)
    const [contextAnchor, setContextAnchor] = useState<CardMenuAnchor | null>(null)
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

    const closeContextMenu = () => {
        setContextAnchor(null)
        setMenuOpen(false)
    }

    const openContextMenu = (anchor: CardMenuAnchor) => {
        if (deleting || contextOptions.length === 0) return
        setContextAnchor(anchor)
        setMenuOpen(true)
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
            e.preventDefault()
            const rect = cardRef.current.getBoundingClientRect()
            openContextMenu({ top: rect.top + 16, left: rect.left + 16 })
            return
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
        }
    }

    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
        if (didLongPressRef.current) {
            e.preventDefault()
            didLongPressRef.current = false
            return
        }
        onClick?.()
    }

    const clearLongPress = () => {
        if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
        }
    }

    useEffect(() => {
        return () => {
            if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
        }
    }, [])

    const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' || contextOptions.length === 0 || deleting) return
        const anchor = { top: e.clientY, left: e.clientX }
        clearLongPress()
        longPressTimerRef.current = window.setTimeout(() => {
            didLongPressRef.current = true
            openContextMenu(anchor)
        }, LONG_PRESS_MS)
    }

    return (
        <Card
            ref={cardRef}
            interactive={interactive}
            role={interactive ? 'button' : 'article'}
            tabIndex={interactive ? 0 : undefined}
            aria-label={actionLabel || title}
            aria-busy={deleting || undefined}
            onClick={interactive ? handleClick : undefined}
            onKeyDown={interactive ? handleKeyDown : undefined}
            onContextMenu={(e) => {
                if (contextOptions.length === 0 || deleting) return
                e.preventDefault()
                e.stopPropagation()
                openContextMenu({ top: e.clientY, left: e.clientX })
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={clearLongPress}
            onPointerCancel={clearLongPress}
            onPointerLeave={clearLongPress}
            onPointerUp={clearLongPress}
            className={cx(
                'group relative flex h-full flex-col',
                (highlighted || menuOpen) && 'border-ember-500/55 shadow-card-hover ring-1 ring-ember-500/40',
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
                {badge && (
                    <Badge tone="glass" className="absolute left-3 top-3 z-[3] max-w-[65%] truncate">
                        {badge}
                    </Badge>
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
                        <div className={cx('truncate font-mono text-ember-400', compact ? 'text-[10px]' : 'text-[11px]')}>
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
                                compact ? 'text-[13px] leading-[1.4]' : 'text-[14.5px] leading-[1.45]',
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
                                        className="min-w-0 max-w-[60%] shrink cursor-pointer truncate whitespace-nowrap rounded-full bg-ink-900/65 px-2 py-[2px] font-ui text-[10px] font-semibold text-parchment-200 backdrop-blur transition-colors hover:bg-ember-500/25 hover:text-ember-300"
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
                    {footer && (
                        <div className="pt-1" onClick={(e: MouseEvent) => e.stopPropagation()}>
                            {footer}
                        </div>
                    )}
                </div>
            </Portrait>

            <CardActionMenu
                options={contextOptions}
                open={contextAnchor !== null}
                anchor={contextAnchor}
                menuTestId="card-context-menu"
                optionTestIdPrefix="card-context-option"
                returnFocusRef={cardRef}
                onClose={closeContextMenu}
            />

            {deleting && (
                <div className="absolute inset-0 z-[3] flex items-center justify-center bg-ink-900/70 font-medium text-parchment-50">
                    {t('galleryCard.deleting')}
                </div>
            )}
        </Card>
    )
}
