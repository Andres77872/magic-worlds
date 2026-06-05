import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Loader2, Search, X} from 'lucide-react'
import {controlClass, Eyebrow, Icon, IconButton} from '@/ui/primitives'

interface CardGridProps<T> {
    items: T[]
    renderCard: (item: T, index: number) => React.ReactNode
    emptyMessage?: React.ReactNode
    loading?: boolean
    loadingComponent?: React.ReactNode
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
        <div className="mb-4 w-full rounded-sm bg-ink-600" style={{height: '180px'}}/>
        <div className="rounded-sm bg-ink-600" style={{height: '24px', width: '70%', marginBottom: '8px'}}/>
        <div className="rounded-sm bg-ink-600" style={{height: '16px', width: '40%'}}/>
    </div>
)

// Enhanced empty state component
const DefaultEmptyState = ({
                               title = 'No items found',
                               description = 'There are no items to display at the moment.',
                               action
                           }: {
    title?: string
    description?: string
    action?: React.ReactNode
}) => (
    <div
        className="flex flex-col items-center justify-center gap-3 p-8 text-center text-parchment-400"
        role="region"
        aria-label="Empty state"
    >
        <div className="mb-1 text-parchment-500 opacity-50">
            <Icon icon={Search} size={48}/>
        </div>
        <Eyebrow tone="muted">Nothing here</Eyebrow>
        <h3 className="m-0 font-display text-h3 font-semibold text-parchment-50">{title}</h3>
        <p className="m-0 max-w-[300px] font-narrative text-sm text-parchment-400">{description}</p>
        {action}
    </div>
)

/**
 * Enhanced CardGrid component with responsive layout, loading states, infinite scroll,
 * and mystical theme integration for role-playing AI app
 */
export function CardGrid<T>({
                                items,
                                renderCard,
                                emptyMessage,
                                emptyStateTitle = 'No items found',
                                emptyStateDescription = 'There are no items to display at the moment.',
                                emptyStateAction,
                                loading = false,
                                loadingComponent,
                                loadingMore = false,
                                hasMore = false,
                                className = '',
                                onLoadMore,
                                searchPlaceholder = 'Search items...',
                                onSearch,
                                showEmptyState = true,
                                'data-testid': testId = 'card-grid'
                            }: CardGridProps<T>) {
    const gridRef = useRef<HTMLDivElement>(null)
    const loadingRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearching, setIsSearching] = useState(false)

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

    // Memoized rendered cards to prevent unnecessary re-renders
    const renderedCards = useMemo(() => {
        return items.map((item, index) => (
            <div
                key={`card-${index}`}
                className="contents"
                data-card-wrapper
            >
                {renderCard(item, index)}
            </div>
        ))
    }, [items, renderCard])

    // Enhanced loading state
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-parchment-400" role="status" aria-live="polite">
                {loadingComponent || (
                    <>
                        <Loader2 className="h-8 w-8 animate-spin text-ember-500" aria-hidden="true"/>
                        <p>Loading items...</p>
                        <span className="sr-only">Loading content, please wait...</span>
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
            <DefaultEmptyState
                title={emptyStateTitle}
                description={emptyStateDescription}
                action={emptyStateAction}
            />
        )
    }

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
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onKeyDown={handleSearchKeyDown}
                            className={`${controlClass} pl-10 pr-12`}
                            aria-label="Search items"
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
                                label="Clear search"
                                className="absolute right-2 z-[2]"
                                data-testid="search-clear"
                            >
                                <Icon icon={X} size={18}/>
                            </IconButton>
                        )}
                    </div>
                </div>
            )}

            <div
                className={`grid w-full grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:gap-6 ${className}`}
                role="list"
                ref={gridRef}
                aria-label={`Grid of ${items.length} items`}
                data-testid="card-grid-list"
            >
                {renderedCards}

                {/* Enhanced loading more indicator */}
                {loadingMore && (
                    <>
                        {[...Array(3)].map((_, i) => (
                            <SkeletonCard key={`skeleton-more-${i}`}/>
                        ))}
                    </>
                )}

                {/* Infinite scroll trigger */}
                {hasMore && !loadingMore && (
                    <div
                        ref={loadingRef}
                        className="h-px w-full"
                        aria-hidden="true"
                        data-testid="load-more-trigger"
                    />
                )}
            </div>

            {/* Enhanced end of results indicator */}
            {!hasMore && items.length > 0 && (
                <div
                    className="col-[1/-1] mt-6 border-t border-parchment-50/10 p-6 text-center text-sm text-parchment-400"
                    role="status"
                >
                    <p>✨ You've seen all available items ✨</p>
                </div>
            )}
        </div>
    )
}
