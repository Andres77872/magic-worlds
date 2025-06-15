import type {ReactNode} from 'react'
import {useEffect, useRef} from 'react'
import {FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimes} from 'react-icons/fa'
import '../App.css'

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success'

interface ConfirmDialogProps {
    visible: boolean
    title?: string
    message: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    variant?: ConfirmVariant
    onConfirm: () => void
    onCancel: () => void
    isProcessing?: boolean
    disableConfirm?: boolean
    disableCancel?: boolean
    showCloseButton?: boolean
    className?: string
    size?: 'sm' | 'md' | 'lg'
}

const variantIcons = {
    danger: <FaExclamationTriangle className="confirm-icon danger"/>,
    warning: <FaExclamationTriangle className="confirm-icon warning"/>,
    info: <FaInfoCircle className="confirm-icon info"/>,
    success: <FaCheckCircle className="confirm-icon success"/>,
}

/**
 * Enhanced modal confirmation dialog with support for different variants and states.
 */
export function ConfirmDialog({
                                  visible,
                                  title,
                                  message,
                                  confirmLabel = 'Confirm',
                                  cancelLabel = 'Cancel',
                                  variant = 'danger',
                                  onConfirm,
                                  onCancel,
                                  isProcessing = false,
                                  disableConfirm = false,
                                  disableCancel = false,
                                  showCloseButton = true,
                                  className = '',
                                  size = 'md',
                              }: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null)

    // Handle escape key
    useEffect(() => {
        if (!visible) return

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel()
            }
        }

        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [visible, onCancel])

    // Focus the first focusable element when dialog opens
    useEffect(() => {
        if (visible && dialogRef.current) {
            const focusable = dialogRef.current.querySelector<HTMLElement>(
                'button:not([disabled])'
            )
            focusable?.focus()
        }
    }, [visible])

    if (!visible) return null

    const icon = variantIcons[variant] || null
    const isDanger = variant === 'danger'

    return (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
            <div
                className={`confirm-dialog ${variant} ${size} ${className}`}
                ref={dialogRef}
                onClick={(e) => e.stopPropagation()}
            >
                {showCloseButton && (
                    <button
                        className="close-button"
                        onClick={onCancel}
                        aria-label="Close dialog"
                        disabled={isProcessing}
                    >
                        <FaTimes/>
                    </button>
                )}

                <div className="confirm-content">
                    {icon && <div className="confirm-icon-container">{icon}</div>}

                    <div className="confirm-text">
                        {title && (
                            <h3 id="confirm-dialog-title" className="confirm-title">
                                {title}
                            </h3>
                        )}

                        <div className="confirm-message">
                            {message}
                        </div>
                    </div>
                </div>

                <div className="confirm-buttons">
                    {!disableCancel && (
                        <button
                            type="button"
                            className={`confirm-button cancel ${isDanger ? 'danger' : ''}`}
                            onClick={onCancel}
                            disabled={isProcessing || disableCancel}
                        >
                            {cancelLabel}
                        </button>
                    )}

                    <button
                        type="button"
                        className={`confirm-button confirm ${variant}`}
                        onClick={onConfirm}
                        disabled={isProcessing || disableConfirm}
                        autoFocus
                    >
                        {isProcessing ? (
                            <span className="button-loading">
                <span className="spinner"/>
                Processing...
              </span>
                        ) : (
                            confirmLabel
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}