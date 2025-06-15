import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaSearch, FaSpinner } from 'react-icons/fa'
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
}

// Skeleton card for loading state
const SkeletonCard = () => (
  <div className="card" aria-hidden="true">
    <div className="skeleton skeleton-card" style={{ height: '180px' }} />
    <div className="skeleton" style={{ height: '24px', width: '70%', marginBottom: '8px' }} />
    <div className="skeleton" style={{ height: '16px', width: '40%' }} />
  </div>
)

// Default empty state component
const DefaultEmptyState = ({
  title = 'No items found',
  description = 'There are no items to display at the moment.',
  action
}: {
  title?: string
  description?: string
  action?: React.ReactNode
}) => (
  <div className="empty-state">
    <div className="empty-icon">
      <FaSearch size={48} />
    </div>
    <h3>{title}</h3>
    <p>{description}</p>
    {action}
  </div>
)

/**
 * Enhanced CardGrid component with responsive layout, loading states, and infinite scroll
 */
export function CardGrid<T>({
  items,
  renderCard,
  // emptyMessage parameter is kept for backward compatibility
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
}: CardGridProps<T>) {
  const gridRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  // Handle search with debounce
  useEffect(() => {
    if (!onSearch) return
    
    const timer = setTimeout(() => {
      onSearch(searchQuery)
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, onSearch])

  // Infinite scroll implementation
  useEffect(() => {
    if (!onLoadMore || !hasMore || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore()
        }
      },
      { root: null, rootMargin: '100px', threshold: 0.1 }
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

  // Animation on scroll for lists
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.05 }
    )

    const cards = gridRef.current?.querySelectorAll('.card:not(.visible)')
    cards?.forEach((card) => observer.observe(card))

    return () => observer.disconnect()
  }, [items])

  // Memoize the rendered lists to prevent unnecessary re-renders
  const renderedCards = useMemo(() => {
    return items.map((item, index) => (
      <div 
        key={`card-${index}`}
        className="card"
        style={{
          animationDelay: `${Math.min(index * 30, 300)}ms`
        }}
      >
        {renderCard(item, index)}
      </div>
    ))
  }, [items, renderCard])

  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    if (e.target.value) {
      setIsSearching(true)
    }
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="loading-container">
        {loadingComponent || (
          <>
            <FaSpinner className="loading-spinner" />
            <p>Loading items...</p>
          </>
        )}
      </div>
    )
  }


  // Empty state
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
    <div className="card-grid-container">
      {onSearch && (
        <div className="card-grid-search">
          <div className="search-input-container">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
              aria-label="Search items"
            />
            {isSearching && <FaSpinner className="search-spinner" />}
          </div>
        </div>
      )}
      
      <div className={`card-grid ${className}`} role="list" ref={gridRef}>
        {renderedCards}
        
        {/* Loading more indicator */}
        {loadingMore && (
          <>
            {[...Array(3)].map((_, i) => (
              <SkeletonCard key={`skeleton-${i}`} />
            ))}
          </>
        )}
        
        {/* Infinite scroll trigger */}
        {hasMore && !loadingMore && (
          <div ref={loadingRef} className="load-more-trigger" />
        )}
      </div>
      
      {!hasMore && items.length > 0 && (
        <div className="end-of-results">
          <p>No more items to load</p>
        </div>
      )}
    </div>
  )
}