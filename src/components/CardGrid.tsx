import React, { useEffect, useRef } from 'react'
import '../App.css'

interface CardGridProps<T> {
  items: T[]
  renderCard: (item: T, index: number) => React.ReactNode
  emptyMessage?: React.ReactNode
  loading?: boolean
  loadingComponent?: React.ReactNode
  className?: string
}

/**
 * Enhanced CardGrid component with responsive layout and animations
 */
export function CardGrid<T>({
  items,
  renderCard,
  emptyMessage = 'No items found',
  loading = false,
  loadingComponent = <div className="loading-spinner">Loading...</div>,
  className = '',
}: CardGridProps<T>) {
  const gridRef = useRef<HTMLDivElement>(null)

  // Add animation on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1 }
    )

    const cards = gridRef.current?.querySelectorAll('.card')
    cards?.forEach((card) => observer.observe(card))

    return () => observer.disconnect()
  }, [items])

  if (loading) {
    return <div className="loading-container">{loadingComponent}</div>
  }

  if (items.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className={`card-grid ${className}`} role="list" ref={gridRef}>
      {items.map((item, index) => (
        <div 
          key={index} 
          className="card"
          style={{ 
            opacity: 0,
            transform: 'translateY(20px)',
            animation: `fadeIn 0.3s ease forwards ${index * 50}ms`
          }}
        >
          {renderCard(item, index)}
        </div>
      ))}
    </div>
  )
}