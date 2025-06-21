/**
 * Common form actions component for creator forms
 */

import '../styles/FormActions.css';

export interface FormActionsProps {
    onCancel: () => void;
    submitLabel: string;
    cancelLabel?: string;
    isSubmitting?: boolean;
}

export function FormActions({
    onCancel,
    submitLabel,
    cancelLabel = 'Cancel',
    isSubmitting = false
}: FormActionsProps) {
    return (
        <div className="creator-form-actions">
            <button 
                type="button" 
                className="creator-btn creator-btn-secondary" 
                onClick={onCancel}
                disabled={isSubmitting}
            >
                {cancelLabel}
            </button>
            <button 
                type="submit" 
                className="creator-btn creator-btn-primary"
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Saving...' : submitLabel}
            </button>
        </div>
    );
} 