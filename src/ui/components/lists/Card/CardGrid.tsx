import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {FaSearch, FaSpinner} from 'react-icons/fa'
import './Card.css'

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

// Enhanced skeleton card for loading state
const SkeletonCard = ({ index }: { index: number }) => (
    <div 
        className="card skeleton" 
        aria-hidden="true"
        style={{
            animationDelay: `${Math.min(index * 50, 500)}ms`
        }}
    >
        <div className="skeleton skeleton-card" style={{height: '180px'}}/>
        <div className="skeleton" style={{height: '24px', width: '70%', marginBottom: '8px'}}/>
        <div className="skeleton" style={{height: '16px', width: '40%'}}/>
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
    <div className="empty-state" role="region" aria-label="Empty state">
        <div className="empty-icon">
            <FaSearch size={48} aria-hidden="true"/>
        </div>
        <h3>{title}</h3>
        <p>{description}</p>
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

        const cards = gridRef.current?.querySelectorAll('.card:not(.visible)')
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
                className="card-wrapper"
                style={{
                    animationDelay: `${Math.min(index * 30, 300)}ms`
                }}
            >
                {renderCard(item, index)}
            </div>
        ))
    }, [items, renderCard])

    // Enhanced loading state
    if (loading) {
        return (
            <div className="loading-container" role="status" aria-live="polite">
                {loadingComponent || (
                    <>
                        <FaSpinner className="loading-spinner" aria-hidden="true"/>
                        <p>Loading items...</p>
                        <span className="visually-hidden">Loading content, please wait...</span>
                    </>
                )}
            </div>
        )
    }

    // Enhanced empty state
    const isEmpty = items.length === 0 && !loading
    if (isEmpty && showEmptyState) {
        return (
            <DefaultEmptyState
                title={emptyStateTitle}
                description={emptyStateDescription}
                action={emptyStateAction}
            />
        )
    }

    return (
        <div className="card-grid-container" data-testid={testId}>
            {onSearch && (
                <div className="card-grid-search" role="search">
                    <div className="search-input-container">
                        <FaSearch className="search-icon" aria-hidden="true"/>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onKeyDown={handleSearchKeyDown}
                            className="search-input"
                            aria-label="Search items"
                            data-testid="card-grid-search-input"
                        />
                        {isSearching && (
                            <FaSpinner 
                                className="search-spinner" 
                                aria-hidden="true"
                                data-testid="search-spinner"
                            />
                        )}
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="search-clear"
                                aria-label="Clear search"
                                data-testid="search-clear"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div 
                className={`card-grid ${className}`} 
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
                            <SkeletonCard key={`skeleton-more-${i}`} index={i}/>
                        ))}
                    </>
                )}

                {/* Infinite scroll trigger */}
                {hasMore && !loadingMore && (
                    <div 
                        ref={loadingRef} 
                        className="load-more-trigger"
                        aria-hidden="true"
                        data-testid="load-more-trigger"
                    />
                )}
            </div>

            {/* Enhanced end of results indicator */}
            {!hasMore && items.length > 0 && (
                <div className="end-of-results" role="status">
                    <p>✨ You've seen all available items ✨</p>
                </div>
            )}
        </div>
    )
}