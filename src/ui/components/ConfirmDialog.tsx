/**
 * Reusable confirmation dialog — Reverie (composed from the Modal primitive).
 */
import React from 'react'
import { Button, Modal } from '../primitives'

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
    isProcessing = false,
}: ConfirmDialogProps) {
    const confirmKind = variant === 'danger' ? 'danger' : 'primary'

    return (
        <Modal
            open={visible}
            onClose={onCancel}
            title={title}
            showClose={false}
            footer={
                <>
                    <Button kind="secondary" onClick={onCancel} disabled={isProcessing}>
                        {cancelLabel}
                    </Button>
                    <Button kind={confirmKind} onClick={onConfirm} disabled={isProcessing}>
                        {isProcessing ? 'Processing…' : confirmLabel}
                    </Button>
                </>
            }
        >
            <div className="text-[15px] leading-relaxed text-parchment-200">{message}</div>
        </Modal>
    )
}
