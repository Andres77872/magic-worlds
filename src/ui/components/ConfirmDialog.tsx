/**
 * Reusable confirmation dialog component
 */

import './ConfirmDialog.css'
import React from 'react'

interface ConfirmDialogProps {
    visible: boolean
    title: string
    message: React.ReactNode
    onConfirm: () => void
    onCancel: () => void
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'primary' | 'danger' | 'warning'
    isProcessing?: boolean
}

export function ConfirmDialog({
    visible,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'primary',
    isProcessing = false
}: ConfirmDialogProps) {
    if (!visible) return null;
    
    return (
        <div className="confirm-dialog-overlay" onClick={onCancel}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-dialog-header">
                    <h3 className="confirm-dialog-title">{title}</h3>
                </div>
                
                <div className="confirm-dialog-body">
                    <div className="confirm-dialog-message">{message}</div>
                </div>
                
                <div className="confirm-dialog-footer">
                    <button 
                        className="btn btn-secondary"
                        onClick={onCancel}
                        disabled={isProcessing}
                    >
                        {cancelLabel}
                    </button>
                    <button 
                        className={`btn btn-${variant}`}
                        onClick={onConfirm}
                        disabled={isProcessing}
                    >
                        {isProcessing ? 'Processing...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
