import React from 'react'
import '../../App.css'
import { CardOptions, type CardOption } from './CardOptions'

interface CardProps {
  title: React.ReactNode  // Changed from string to ReactNode to support JSX elements
  subtitle?: React.ReactNode  // Also updated subtitle for consistency
  children?: React.ReactNode
  actions?: CardOption[]
  className?: string
  onClick?: () => void
}

/**
 * Enhanced Card component with improved styling and interactivity
 */
export function Card({
  title,
  subtitle,
  children,
  actions,
  className = '',
  onClick,
}: CardProps) {
  return (
    <div 
      className={`card ${onClick ? 'clickable' : ''} ${className}`} 
      role={onClick ? 'button' : 'listitem'}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="card-header">
        <h4 className="card-title">
          {typeof title === 'string' ? (
            <span>{title}</span>  // Wrap string in span for consistent styling
          ) : (
            title  // Render JSX as is
          )}
        </h4>
        {subtitle && (
          <div className="card-subtitle">
            {typeof subtitle === 'string' ? (
              <span>{subtitle}</span>
            ) : (
              subtitle
            )}
          </div>
        )}
      </div>
      {children && <div className="card-content">{children}</div>}
      {actions && <CardOptions options={actions} />}
    </div>
  )
}