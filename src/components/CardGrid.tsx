import React from 'react'
import '../App.css'

/**
 * Container component to layout cards in a responsive grid.
 */
/**
 * Generic grid component for rendering items as cards.
 * @param items - array of data items
 * @param renderCard - function to render each item as a card component
 */
export function CardGrid<T>({
  items,
  renderCard,
}: {
  items: T[]
  renderCard: (item: T, index: number) => React.ReactNode
}) {
  return (
    <div className="card-grid" role="list">
      {items.map((item, idx) => (
        <div key={idx} role="listitem">
          {renderCard(item, idx)}
        </div>
      ))}
    </div>
  )
}