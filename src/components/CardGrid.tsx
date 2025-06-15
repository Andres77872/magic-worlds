import React from 'react'
import '../App.css'

/**
 * Container component to layout cards in a responsive grid.
 */
export function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="card-grid" role="list">
      {children}
    </div>
  )
}