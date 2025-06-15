import React from 'react'
import '../App.css'
import { ListItemActions, type ListAction } from './ListItemActions'

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
  actions?: ListAction[]
}) {
  return (
    <div className="card">
      <div className="card-header">{title}</div>
      {children && <div className="card-content">{children}</div>}
      {actions && <ListItemActions actions={actions} />}
    </div>
  )
}