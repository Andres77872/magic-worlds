import type {ReactNode} from 'react';
import './EmptyState.css';

interface EmptyStateProps {
    /** The main message to display */
    message: string;
    /** Optional icon to display above the message */
    icon?: ReactNode;
    /** Optional secondary text to display below the main message */
    secondaryText?: string;
    /** Optional button to display below the message */
    button?: {
        label: string;
        onClick: () => void;
        className?: string;
    };
    /** Additional class name for the container */
    className?: string;
}

export function EmptyState({
                               message,
                               icon,
                               secondaryText,
                               button,
                               className = '',
                           }: EmptyStateProps) {
    return (
        <div className={`empty-state ${className}`}>
            {icon && <div className="empty-icon">{icon}</div>}
            <h3>{message}</h3>
            {secondaryText && <p>{secondaryText}</p>}
            {button && (
                <button
                    className={`primary-button ${button.className || ''}`}
                    onClick={button.onClick}
                >
                    {button.label}
                </button>
            )}
        </div>
    );
}
