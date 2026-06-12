/**
 * GalleryCard — image-forward card for dense, paginated galleries. The 3:4
 * portrait (cover image or seeded gradient) IS the card; name + identity badge
 * sit on the bottom vignette with up to three trigger pills, and actions live
 * in a hover-revealed menu so a wall of cards stays calm until pointed at.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { ListMusic, Pause, Play, Share2 } from 'lucide-react'
import { usePlaylist } from '@/app/hooks/usePlaylist'
import { themeTrack, type PlaylistTrack } from '@/app/providers/audioPlaylistContext'
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
    'data-testid': testId = 'gallery-card',
}: GalleryCardProps) {
    const interactive = Boolean(onClick) && !deleting
    const cardRef = useRef<HTMLDivElement>(null!)
    const longPressTimerRef = useRef<number | null>(null)
    const didLongPressRef = useRef(false)
    const [contextAnchor, setContextAnchor] = useState<CardMenuAnchor | null>(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const playlist = usePlaylist()
    const isThemePlaying = Boolean(themeSongUrl) && playlist.currentTrack?.id === themeSongUrl && playlist.isPlaying
    const visibleTags = tags.slice(0, 3)
    const extraTagCount = Math.max(0, tags.length - visibleTags.length)

    const contextOptions = useMemo<CardOption[]>(() => {
        const musicOptions: CardOption[] = themeSongUrl
            ? [
                  {
                      type: 'custom',
                      icon: <Icon icon={isThemePlaying ? Pause : Play} size={15} />,
                      label: isThemePlaying ? 'Pause music' : 'Play music',
                      onClick: () =>
                          playlist.playNow(themeTrack({ url: themeSongUrl, cardName: title, cardType, cardId, artworkUrl: imageUrl })),
                  },
                  {
                      type: 'custom',
                      icon: <Icon icon={ListMusic} size={15} />,
                      label: playlist.isQueued(themeSongUrl) ? 'In playlist' : 'Add to playlist',
                      disabled: playlist.isQueued(themeSongUrl),
                      onClick: () =>
                          playlist.enqueue(themeTrack({ url: themeSongUrl, cardName: title, cardType, cardId, artworkUrl: imageUrl })),
                  },
              ]
            : []
        return [...musicOptions, ...(shareOptions ?? []), ...(options ?? [])]
    }, [options, shareOptions, isThemePlaying, playlist, themeSongUrl, title, cardType, cardId, imageUrl])

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
                height="auto"
                className="aspect-[3/4] w-full [&>img]:transition-transform [&>img]:duration-500 group-hover:[&>img]:scale-[1.035]"
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24 bg-[linear-gradient(180deg,rgba(14,12,20,.72),rgba(14,12,20,0))]" />
                <div className="pointer-events-none absolute inset-0 z-[1] ring-1 ring-inset ring-parchment-50/[.08]" />
                <div
                    className="absolute right-2 top-2 z-[4] flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full border border-parchment-50/10 bg-ink-900/55 p-1 opacity-100 shadow-md backdrop-blur-md transition-opacity sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100"
                    onClick={(e: MouseEvent) => e.stopPropagation()}
                >
                    {themeSongUrl && <ThemeSongButton src={themeSongUrl} cardName={title} cardType={cardType} cardId={cardId} artworkUrl={imageUrl} />}
                    {shareOptions && shareOptions.length > 0 && (
                        <CardOptions
                            options={shareOptions}
                            aria-label={shareLabel || `Share ${title}`}
                            triggerIcon={<Icon icon={Share2} size={16} />}
                            triggerTestId="card-share-button"
                            menuTestId="card-share-menu"
                            optionTestIdPrefix="card-share-option"
                            forceMenu
                            onOpenChange={setMenuOpen}
                        />
                    )}
                    {options && options.length > 0 && (
                        <CardOptions options={options} aria-label={`Actions for ${title}`} onOpenChange={setMenuOpen} />
                    )}
                </div>

                <div className="absolute inset-x-0 bottom-0 z-[2] flex flex-col gap-2 p-3">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                        <h3
                            className="m-0 line-clamp-2 min-w-0 flex-1 font-display text-[18px] font-semibold leading-[1.05] text-parchment-50"
                            title={title}
                        >
                            {title}
                        </h3>
                        {badge && (
                            <Badge tone="glass" className="max-w-[45%] shrink-0 truncate">
                                {badge}
                            </Badge>
                        )}
                    </div>
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {visibleTags.map((tag) =>
                                onTagClick ? (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={(e: MouseEvent) => {
                                            e.stopPropagation()
                                            onTagClick(tag)
                                        }}
                                        aria-label={`Search for ${tag}`}
                                        className="max-w-full cursor-pointer truncate rounded-full bg-ink-900/65 px-2 py-[2px] font-ui text-[10px] font-semibold text-parchment-200 backdrop-blur transition-colors hover:bg-ember-500/25 hover:text-ember-300"
                                    >
                                        {tag}
                                    </button>
                                ) : (
                                    <Tag key={tag} className="max-w-full truncate bg-ink-900/65 backdrop-blur">
                                        {tag}
                                    </Tag>
                                ),
                            )}
                            {extraTagCount > 0 && (
                                <Tag className="bg-ink-900/65 text-parchment-300 backdrop-blur">
                                    +{extraTagCount}
                                </Tag>
                            )}
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
                    Deleting…
                </div>
            )}
        </Card>
    )
}
