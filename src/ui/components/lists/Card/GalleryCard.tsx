/**
 * GalleryCard — image-forward card for dense, paginated galleries. The 3:4
 * portrait (cover image or seeded gradient) IS the card; name + identity badge
 * sit on the bottom vignette with up to three trigger pills, and actions live
 * in a hover-revealed menu so a wall of cards stays calm until pointed at.
 */

import type { KeyboardEvent, MouseEvent } from 'react'
import { Badge, Card, cx, Portrait, Tag, ThemeSongButton } from '@/ui/primitives'
import { CardOptions, type CardOption } from './CardOptions'

export interface GalleryCardProps {
    title: string
    /** Identity badge beside the name: race / world type / world name. */
    badge?: string
    /** Trigger + category pills (capped at 3 in render). */
    tags?: string[]
    /** When provided, pills become buttons that push the tag into the search. */
    onTagClick?: (tag: string) => void
    imageUrl?: string
    themeSongUrl?: string
    /** Hover-menu actions (Chat / Edit / Delete / Begin). */
    options?: CardOption[]
    /** Primary action for the whole card (also Enter/Space). */
    onClick?: () => void
    /** Accessible name for the card's primary action. */
    actionLabel?: string
    deleting?: boolean
    'data-testid'?: string
}

export function GalleryCard({
    title,
    badge,
    tags = [],
    onTagClick,
    imageUrl,
    themeSongUrl,
    options,
    onClick,
    actionLabel,
    deleting = false,
    'data-testid': testId = 'gallery-card',
}: GalleryCardProps) {
    const interactive = Boolean(onClick) && !deleting

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
        }
    }

    return (
        <Card
            interactive={interactive}
            role={interactive ? 'button' : 'article'}
            tabIndex={interactive ? 0 : undefined}
            aria-label={actionLabel || title}
            aria-busy={deleting || undefined}
            onClick={interactive ? onClick : undefined}
            onKeyDown={interactive ? handleKeyDown : undefined}
            className={cx('group relative flex h-full flex-col', deleting && 'pointer-events-none opacity-60')}
            data-testid={testId}
        >
            <Portrait name={title} src={imageUrl} height="auto" className="aspect-[3/4] w-full">
                <div
                    className="absolute right-2 top-2 z-[2] flex items-center gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
                    onClick={(e: MouseEvent) => e.stopPropagation()}
                >
                    {themeSongUrl && <ThemeSongButton src={themeSongUrl} />}
                    {options && options.length > 0 && (
                        <CardOptions options={options} aria-label={`Actions for ${title}`} />
                    )}
                </div>

                <div className="absolute inset-x-0 bottom-0 z-[1] flex flex-col gap-1.5 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                        <h3
                            className="m-0 truncate font-display text-[17px] font-semibold leading-tight text-parchment-50"
                            title={title}
                        >
                            {title}
                        </h3>
                        {badge && (
                            <Badge tone="glass" className="shrink-0">
                                {badge}
                            </Badge>
                        )}
                    </div>
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 3).map((tag) =>
                                onTagClick ? (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={(e: MouseEvent) => {
                                            e.stopPropagation()
                                            onTagClick(tag)
                                        }}
                                        aria-label={`Search for ${tag}`}
                                        className="cursor-pointer rounded-full bg-ink-900/60 px-2 py-[2px] font-ui text-[10px] font-semibold text-parchment-200 backdrop-blur transition-colors hover:bg-ember-500/25 hover:text-ember-300"
                                    >
                                        {tag}
                                    </button>
                                ) : (
                                    <Tag key={tag} className="bg-ink-900/60 backdrop-blur">
                                        {tag}
                                    </Tag>
                                ),
                            )}
                        </div>
                    )}
                </div>
            </Portrait>

            {deleting && (
                <div className="absolute inset-0 z-[3] flex items-center justify-center bg-ink-900/70 font-medium text-parchment-50">
                    Deleting…
                </div>
            )}
        </Card>
    )
}
