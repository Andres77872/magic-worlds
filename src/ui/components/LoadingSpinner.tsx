/**
 * Reusable loading spinner component
 */

import './LoadingSpinner.css'

interface LoadingSpinnerProps {
    message?: string
    size?: 'small' | 'medium' | 'large'
}

export function LoadingSpinner({ message = 'Loading...', size = 'medium' }: LoadingSpinnerProps) {
    return (
        <div className={`loading-spinner-container loading-spinner-${size}`}>
            <div className="loading-spinner__spinner" />
            <p className="loading-message">{message}</p>
        </div>
    )
}
