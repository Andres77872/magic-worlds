import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Loader2, Search, X} from 'lucide-react'
import {controlClass, Icon, IconButton} from '@/ui/primitives'
import {EmptyState} from '../../common/EmptyState'

interface CardGridProps<T> {
    items: T[]
    renderCard: (item: T, index: number) => React.ReactNode
    /**
     * `grid` (default) — responsive auto-fill gallery for full pages.
     * `list` — a single-column stack of full-width rows over the same paginated
     * data; infinite scroll, search, and skeletons all apply just like `grid`.
     * `rail` — a horizontal scroll shelf of fixed-width cards, so a handful of
     * items reads as an intentional row instead of stretching full width.
     */
    layout?: 'grid' | 'rail' | 'list'
    /**
     * Grid column sizing: `comfortable` (default, 240/280px min) or `compact`
     * (200/220px min) for image-forward galleries of many cards.
     */
    density?: 'comfortable' | 'compact'
    /**
     * Rail card width: `default` (280px, text-forward shelves) or `compact`
     * (200px, portrait GalleryCard rails).
     */
    railWidth?: 'default' | 'compact'
    /**
     * Alpha fade at the rail's right edge when more horizontal content exists.
     */
    fadeEdges?: boolean
    /**
     * Stable keys for paginated/searched lists. Defaults to the item index,
     * which is only safe for static lists — pass this whenever items can be
     * inserted, removed, or reordered.
     */
    getItemKey?: (item: T, index: number) => string
    emptyMessage?: React.ReactNode
    loading?: boolean
    loadingComponent?: React.ReactNode
    /**
     * Per-item skeleton for the loading/loading-more states (grid layout). When
     * provided, the initial `loading` state renders a skeleton grid (instead of
     * a centered spinner) and `loadingMore` appends matching skeletons — so the
     * placeholder reserves the real card's box and the swap never shifts layout.
     */
    renderSkeleton?: () => React.ReactNode
    /** Skeletons rendered for the initial `loading` grid (default 8). */
    skeletonCount?: number
    className?: string
    onLoadMore?: () => void
    hasMore?: boolean
    loadingMore?: boolean
    searchPlaceholder?: string
    onSearch?: (query: string) => void
    showEmptyState?: boolean
    emptyStateTitle?: string
    emptyStateDescription?: string
    emptyStateAction?: React.ReactNode
    'data-testid'?: string
}

// Skeleton card for loading state
const SkeletonCard = () => (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-700 p-4" aria-hidden="true">
        <div className="mb-4 h-[180px] w-full rounded-sm bg-ink-600"/>
        <div className="mb-2 h-6 w-[70%] rounded-sm bg-ink-600"/>
        <div className="h-4 w-2/5 rounded-sm bg-ink-600"/>
    </div>
)

/**
 * Enhanced CardGrid component with responsive layout, loading states, infinite scroll,
 * and mystical theme integration for role-playing AI app
 */
export function CardGrid<T>({
                                items,
                                renderCard,
                                layout = 'grid',
                                density = 'comfortable',
                                railWidth = 'default',
                                fadeEdges = false,
                                getItemKey,
                                emptyMessage,
                                emptyStateTitle,
                                emptyStateDescription,
                                emptyStateAction,
                                loading = false,
                                loadingComponent,
                                renderSkeleton,
                                skeletonCount = 8,
                                loadingMore = false,
                                hasMore = false,
                                className = '',
                                onLoadMore,
                                searchPlaceholder,
                                onSearch,
                                showEmptyState = true,
                                'data-testid': testId = 'card-grid'
                            }: CardGridProps<T>) {
    const { t } = useTranslation()
    const gridRef = useRef<HTMLDivElement>(null)
    const loadingRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [railHasOverflow, setRailHasOverflow] = useState(false)
    const resolvedEmptyStateTitle = emptyStateTitle ?? t('cardGrid.noItemsFound')
    const resolvedEmptyStateDescription = emptyStateDescription ?? t('cardGrid.noItemsDescription')
    const resolvedSearchPlaceholder = searchPlaceholder ?? t('cardGrid.searchItems')

    // Enhanced search with debounce
    useEffect(() => {
        if (!onSearch) return

        const timer = setTimeout(() => {
            onSearch(searchQuery)
            setIsSearching(false)
        }, 300)

        return () => clearTimeout(timer)
    }, [searchQuery, onSearch])

    // Enhanced infinite scroll implementation
    useEffect(() => {
        if (!onLoadMore || !hasMore || loadingMore) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onLoadMore()
                }
            },
            {
                root: null,
                rootMargin: '100px',
                threshold: 0.1
            }
        )

        const currentRef = loadingRef.current
        if (currentRef) {
            observer.observe(currentRef)
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef)
            }
        }
    }, [hasMore, loadingMore, onLoadMore])

    useEffect(() => {
        if (layout !== 'rail' || !fadeEdges) {
            setRailHasOverflow(false)
            return
        }

        const node = gridRef.current
        if (!node) return

        let animationFrame = 0
        const measureOverflow = () => {
            animationFrame = 0
            const hasOverflow = node.scrollWidth > node.clientWidth + 1
            setRailHasOverflow((current) => (current === hasOverflow ? current : hasOverflow))
        }
        const scheduleMeasure = () => {
            if (animationFrame) window.cancelAnimationFrame(animationFrame)
            animationFrame = window.requestAnimationFrame(measureOverflow)
        }

        scheduleMeasure()

        let resizeObserver: ResizeObserver | null = null
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(scheduleMeasure)
            resizeObserver.observe(node)
            Array.from(node.children).forEach((child) => resizeObserver?.observe(child))
        } else {
            window.addEventListener('resize', scheduleMeasure)
        }

        return () => {
            if (animationFrame) window.cancelAnimationFrame(animationFrame)
            resizeObserver?.disconnect()
            if (!resizeObserver) window.removeEventListener('resize', scheduleMeasure)
        }
    }, [fadeEdges, items.length, layout, railWidth])

    // Enhanced entrance animation for cards
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible')
                        observer.unobserve(entry.target)
                    }
                })
            },
            {
                threshold: 0.05,
                rootMargin: '50px 0px'
            }
        )

        const cards = gridRef.current?.querySelectorAll('[data-card-wrapper]:not(.visible)')
        cards?.forEach((card) => observer.observe(card))

        return () => observer.disconnect()
    }, [items])

    // Enhanced search input change handler
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setSearchQuery(value)
        if (value) {
            setIsSearching(true)
        }
    }, [])

    // Clear search functionality
    const handleClearSearch = useCallback(() => {
        setSearchQuery('')
        setIsSearching(false)
        searchInputRef.current?.focus()
    }, [])

    // Enhanced keyboard support for search
    const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            handleClearSearch()
        }
    }, [handleClearSearch])

    // Memoized rendered cards to prevent unnecessary re-renders. In `rail` mode
    // each card gets a fixed width + scroll-snap so the row reads as a shelf; in
    // `grid` mode the wrapper is `display:contents` so cards flow in the grid.
    const renderedCards = useMemo(() => {
        const wrapperClass =
            layout === 'rail'
                ? railWidth === 'compact'
                    ? 'w-[min(200px,62vw)] shrink-0 [scroll-snap-align:start]'
                    : 'w-[min(300px,82vw)] shrink-0 [scroll-snap-align:start]'
                : 'contents'
        return items.map((item, index) => (
            <div
                key={getItemKey ? getItemKey(item, index) : `card-${index}`}
                className={wrapperClass}
                data-card-wrapper={layout}
            >
                {renderCard(item, index)}
            </div>
        ))
    }, [items, renderCard, layout, railWidth, getItemKey])

    // Grid track sizing, shared by the content grid and the skeleton grid so the
    // two can never drift (a skeleton in a differently-sized track would shift).
    const gridClass =
        density === 'compact'
            ? `grid w-full grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-5 ${className}`
            : `grid w-full grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:gap-6 ${className}`
    // List rows stack full-width; same wrapper handles the content + skeletons.
    const listClass = `flex w-full flex-col gap-2 md:gap-3 ${className}`
    // The container for the current paginated layout (drives content + skeletons).
    const containerClass = layout === 'list' ? listClass : gridClass
    // Grid and list are paginated full-page layouts; only the horizontal rail
    // opts out of load-more, the infinite-scroll sentinel, and end-of-results.
    const paged = layout !== 'rail'

    // Enhanced loading state
    if (loading) {
        // A matched skeleton grid/list reserves layout and avoids the spinner→content
        // pop; falls back to the centered spinner for rails (or callers without one).
        if (renderSkeleton && paged) {
            return (
                <div className="w-full" data-testid={testId}>
                    <div className={containerClass} role="status" aria-busy="true" aria-label={t('cardGrid.loadingItems')}>
                        {Array.from({ length: skeletonCount }).map((_, i) => (
                            <div key={`skeleton-${i}`} className="contents">{renderSkeleton()}</div>
                        ))}
                        <span className="sr-only">{t('cardGrid.loadingContent')}</span>
                    </div>
                </div>
            )
        }
        return (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-parchment-400" role="status" aria-live="polite">
                {loadingComponent || (
                    <>
                        <Loader2 className="h-8 w-8 animate-spin text-ember-500" aria-hidden="true"/>
                        <p>{t('cardGrid.loadingItems')}</p>
                        <span className="sr-only">{t('cardGrid.loadingContent')}</span>
                    </>
                )}
            </div>
        )
    }

    // Enhanced empty state
    const isEmpty = items.length === 0 && !loading
    if (isEmpty && showEmptyState) {
        if (emptyMessage) {
            return <>{emptyMessage}</>
        }
        return (
            <EmptyState
                icon={<Icon icon={Search} size={48}/>}
                message={resolvedEmptyStateTitle}
                secondaryText={resolvedEmptyStateDescription}
            >
                {emptyStateAction}
            </EmptyState>
        )
    }

    const railShouldFade = layout === 'rail' && fadeEdges && railHasOverflow

    return (
        <div className="w-full" data-testid={testId}>
            {onSearch && (
                <div className="mb-6" role="search">
                    <div className="relative flex max-w-[400px] items-center">
                        <span className="pointer-events-none absolute left-3 z-[1] flex items-center text-parchment-400">
                            <Icon icon={Search} size={16}/>
                        </span>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={resolvedSearchPlaceholder}
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onKeyDown={handleSearchKeyDown}
                            className={`${controlClass} pl-10 pr-12`}
                            aria-label={t('cardGrid.searchItems')}
                            data-testid="card-grid-search-input"
                        />
                        {isSearching && (
                            <Loader2
                                className="absolute right-12 z-[1] animate-spin text-ember-500"
                                size={16}
                                aria-hidden="true"
                                data-testid="search-spinner"
                            />
                        )}
                        {searchQuery && (
                            <IconButton
                                size="sm"
                                onClick={handleClearSearch}
                                label={t('cardGrid.clearSearch')}
                                className="absolute right-2 z-[2]"
                                data-testid="search-clear"
                            >
                                <Icon icon={X} size={18}/>
                            </IconButton>
                        )}
                    </div>
                </div>
            )}

            <div className="contents">
                <div
                    className={
                        layout === 'rail'
                            // A horizontal scroller clips vertically too (overflow-x:auto
                            // forces overflow-y), so pad generously to give the cards'
                            // hover-lift + ember glow room; the -mx cancels the inline
                            // padding so cards still align with the section header.
                            ? `flex gap-4 overflow-x-auto -mx-4 pl-4 ${railShouldFade ? 'rail-fade-right pr-12' : 'pr-4'} pb-9 pt-5 [scroll-snap-type:x_proximity] md:gap-5 ${className}`
                            : containerClass
                    }
                    role="list"
                    ref={gridRef}
                    aria-label={t(
                        layout === 'rail'
                            ? 'cardGrid.shelfLabel'
                            : layout === 'list'
                              ? 'cardGrid.listLabel'
                              : 'cardGrid.gridLabel',
                        { count: items.length },
                    )}
                    data-testid="card-grid-list"
                >
                    {renderedCards}

                    {/* Enhanced loading more indicator (paged grids/lists only). Matches
                        the card via renderSkeleton when given; the generic text-card
                        SkeletonCard is the fallback for callers without one. */}
                    {paged && loadingMore && (
                        <>
                            {[...Array(3)].map((_, i) =>
                                renderSkeleton ? (
                                    <div key={`skeleton-more-${i}`} className="contents">{renderSkeleton()}</div>
                                ) : (
                                    <SkeletonCard key={`skeleton-more-${i}`}/>
                                ),
                            )}
                        </>
                    )}

                    {/* Infinite scroll trigger (paged grids/lists only) */}
                    {paged && hasMore && !loadingMore && (
                        <div
                            ref={loadingRef}
                            className="h-px w-full"
                            aria-hidden="true"
                            data-testid="load-more-trigger"
                        />
                    )}
                </div>
            </div>

            {/* End-of-results indicator — only for paginated galleries, never for
                short shelves where it would just advertise emptiness. */}
            {paged && onLoadMore && !hasMore && items.length > 0 && (
                <div
                    className="mt-6 border-t border-parchment-50/10 p-6 text-center text-sm text-parchment-400"
                    role="status"
                >
                    <p>{t('cardGrid.endOfResults')}</p>
                </div>
            )}
        </div>
    )
}
