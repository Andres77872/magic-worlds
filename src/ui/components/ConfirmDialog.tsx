/**
 * Reusable confirmation dialog — Reverie (composed from the Modal primitive).
 */
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from '../primitives'

interface ConfirmDialogProps {
    visible: boolean
    title: string
    message: React.ReactNode
    onConfirm: () => void
    onCancel: () => void
    icon?: React.ReactNode
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'primary' | 'danger' | 'warning'
    isProcessing?: boolean
    processingLabel?: string
}

export function ConfirmDialog({
    visible,
    title,
    message,
    onConfirm,
    onCancel,
    icon,
    confirmLabel,
    cancelLabel,
    variant = 'primary',
    isProcessing = false,
    processingLabel,
}: ConfirmDialogProps) {
    const { t } = useTranslation()
    const confirmKind = variant === 'danger' ? 'danger' : 'primary'
    const resolvedConfirmLabel = confirmLabel ?? t('common.confirm')
    const resolvedCancelLabel = cancelLabel ?? t('common.cancel')
    const resolvedProcessingLabel = processingLabel ?? t('common.processing')
    const requestCancel = () => {
        if (!isProcessing) onCancel()
    }

    return (
        <Modal
            open={visible}
            onClose={requestCancel}
            title={title}
            icon={icon}
            showClose={false}
            footer={
                <>
                    <Button variant="secondary" onClick={requestCancel} disabled={isProcessing}>
                        {resolvedCancelLabel}
                    </Button>
                    <Button variant={confirmKind} onClick={onConfirm} disabled={isProcessing}>
                        {isProcessing ? resolvedProcessingLabel : resolvedConfirmLabel}
                    </Button>
                </>
            }
        >
            <div className="text-[15px] leading-relaxed text-parchment-200">{message}</div>
        </Modal>
    )
}
