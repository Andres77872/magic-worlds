/**
 * Common layout component for all creator views
 */

import type { ReactNode } from 'react';
import '../styles/CreatorLayout.css';

export interface CreatorLayoutProps {
    title: string;
    icon?: string;
    theme?: 'magical' | 'fire' | 'nature';
    onBack: () => void;
    children: ReactNode;
    isLoading?: boolean;
}

export function CreatorLayout({
    title,
    icon,
    theme = 'magical',
    onBack,
    children,
    isLoading = false
}: CreatorLayoutProps) {
    return (
        <div className={`creator-layout creator-theme-${theme} ${isLoading ? 'is-loading' : ''}`}>
            <div className="creator-header">
                <h2 className="creator-title">
                    {icon && <span className="creator-icon">{icon}</span>}
                    <span className="creator-title-text">{title}</span>
                </h2>
                <button className="creator-btn creator-btn-secondary" onClick={onBack}>
                    Back
                </button>
            </div>
            <div className="creator-content">
                {children}
            </div>
        </div>
    );
} 