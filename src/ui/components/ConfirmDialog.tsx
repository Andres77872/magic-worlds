/**
 * Reusable confirmation dialog component
 */

import './ConfirmDialog.css'

interface ConfirmDialogProps {
    title: string
    message: string
    onConfirm: () => void
    onCancel: () => void
    confirmText?: string
    cancelText?: string
    danger?: boolean
}

export function ConfirmDialog({
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false
}: ConfirmDialogProps) {
    return (
        <div className="confirm-dialog-overlay" onClick={onCancel}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-dialog-header">
                    <h3 className="confirm-dialog-title">{title}</h3>
                </div>
                
                <div className="confirm-dialog-body">
                    <p className="confirm-dialog-message">{message}</p>
                </div>
                
                <div className="confirm-dialog-footer">
                    <button 
                        className="btn btn-secondary"
                        onClick={onCancel}
                    >
                        {cancelText}
                    </button>
                    <button 
                        className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}
