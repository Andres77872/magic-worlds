import React from 'react'
import '../App.css'
import { CardOptions, type CardOption } from './CardOptions'

/**
 * Generic card component with title, optional content, and action buttons.
 */
export function Card({
  title,
  children,
  actions,
}: {
  title: string
  children?: React.ReactNode
  actions?: CardOption[]
}) {
  return (
    <div className="card" role="listitem">
      <div className="card-header">{title}</div>
      {children && <div className="card-content">{children}</div>}
      {actions && <CardOptions options={actions} />}
    </div>
  )
}