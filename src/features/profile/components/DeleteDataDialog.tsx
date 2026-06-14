/**
 * Type-to-confirm dialog for the irreversible "delete all my data" action.
 *
 * Composes the Modal primitive (like {@link ConfirmDialog}) but adds a username
 * gate: the destructive button stays disabled until the user types their exact
 * username, guarding against accidental wipes. The account itself is never
 * deleted — only the user's content (see DELETE /user/data).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import { Button, Field, Icon, Input, Modal } from '@/ui/primitives'

interface DeleteDataDialogProps {
    open: boolean
    /** Exact username the user must type to enable the confirm button. */
    username: string
    onClose: () => void
    /** Performs the wipe. Rejects to surface an inline error and keep the dialog open. */
    onConfirm: () => Promise<void>
}

export function DeleteDataDialog({ open, username, onClose, onConfirm }: DeleteDataDialogProps) {
    const { t } = useTranslation()
    const [typed, setTyped] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const matches = typed.trim() === username

    // Single close path: clear the input + error so a re-open never starts
    // pre-filled or showing a stale failure. The parent only ever toggles `open`
    // back to false through onClose, so this keeps the two in sync without an effect.
    const close = () => {
        setTyped('')
        setError(null)
        onClose()
    }

    // Block close (scrim / cancel) while the wipe is in flight.
    const requestClose = () => {
        if (!isProcessing) close()
    }

    const handleConfirm = async () => {
        if (!matches || isProcessing) return
        setIsProcessing(true)
        setError(null)
        try {
            await onConfirm()
            close()
        } catch (err) {
            setError(err instanceof Error ? err.message : t('profile.danger.deleteError'))
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <Modal
            open={open}
            onClose={requestClose}
            title={t('profile.danger.dialogTitle')}
            icon={<Icon icon={TriangleAlert} size={22} className="text-blood-500" />}
            showClose={false}
            footer={
                <>
                    <Button kind="secondary" onClick={requestClose} disabled={isProcessing}>
                        {t('common.cancel')}
                    </Button>
                    <Button kind="danger" onClick={handleConfirm} disabled={!matches || isProcessing}>
                        {isProcessing ? t('profile.danger.deleting') : t('profile.danger.deleteAllConfirm')}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="text-[15px] leading-relaxed text-parchment-200">
                    {t('profile.danger.dialogBody')}{' '}
                    <span className="font-semibold text-parchment-50">{t('profile.danger.irreversible')}</span>
                </p>

                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        void handleConfirm()
                    }}
                >
                    <Field
                        label={
                            <span>{t('profile.danger.typeToConfirm', { username })}</span>
                        }
                    >
                        <Input
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            disabled={isProcessing}
                            autoFocus
                            autoComplete="off"
                            spellCheck={false}
                            aria-label={t('profile.danger.inputLabel')}
                        />
                    </Field>
                </form>

                {error && (
                    <div className="rounded-md border border-blood-500/30 bg-blood-500/10 px-4 py-3 text-[14px] text-blood-500">
                        {error}
                    </div>
                )}
            </div>
        </Modal>
    )
}
