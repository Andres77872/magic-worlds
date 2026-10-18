/**
 * Workspace R1 rollout states for private pages (document 08 "Release
 * compatibility and rollout UI"). None of them ever reloads by itself: local
 * unsaved content stays until the user chooses Reload.
 */
import { useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Icon, Modal } from '@/ui/primitives'

interface WorkspaceUnavailableGateProps {
    /** Re-runs the handshake; the gate also retries on the health-poll cadence. */
    onRetry: () => Promise<void> | void
}

/** "Your library is unavailable while the service is updating" — never an empty library. */
export function WorkspaceUnavailableGate({ onRetry }: WorkspaceUnavailableGateProps) {
    const { t } = useTranslation()
    const [retrying, setRetrying] = useState(false)

    const retry = async () => {
        setRetrying(true)
        try {
            await onRetry()
        } catch {
            // The gate stays up; the next automatic retry runs on schedule.
        } finally {
            setRetrying(false)
        }
    }

    return (
        <div className="flex min-h-full flex-1 items-center justify-center p-5">
            <Card className="w-full max-w-lg">
                <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 p-6 text-center">
                    <span className="rounded-lg bg-amber-500/15 p-3 text-amber-500">
                        <Icon icon={CloudOff} size={24} />
                    </span>
                    <div>
                        <h2 className="font-display text-h3 text-parchment-50">{t('workspaces.unavailable.title')}</h2>
                        <p className="mt-2 font-ui text-sm text-parchment-300">{t('workspaces.unavailable.body')}</p>
                    </div>
                    <Button
                        variant="primary"
                        iconLeft={<RefreshCw size={15} strokeWidth={1.75} />}
                        onClick={() => void retry()}
                        disabled={retrying}
                    >
                        {retrying ? t('workspaces.unavailable.retrying') : t('workspaces.unavailable.retry')}
                    </Button>
                </div>
            </Card>
        </div>
    )
}

interface WorkspaceStaleProps {
    onReload: () => void
}

/** In-page stale state for a private page that never received a workspace. */
export function WorkspaceStaleNotice({ onReload }: WorkspaceStaleProps) {
    const { t } = useTranslation()
    return (
        <div className="flex min-h-full flex-1 items-center justify-center p-5">
            <Card className="w-full max-w-lg">
                <div role="alert" className="flex flex-col items-center gap-4 p-6 text-center">
                    <span className="rounded-lg bg-ember-500/15 p-3 text-ember-400">
                        <Icon icon={RefreshCw} size={24} />
                    </span>
                    <div>
                        <h2 className="font-display text-h3 text-parchment-50">{t('workspaces.stale.title')}</h2>
                        <p className="mt-2 font-ui text-sm text-parchment-300">{t('workspaces.stale.body')}</p>
                    </div>
                    <Button variant="primary" iconLeft={<RefreshCw size={15} strokeWidth={1.75} />} onClick={onReload}>
                        {t('workspaces.stale.reload')}
                    </Button>
                </div>
            </Card>
        </div>
    )
}

interface WorkspaceStaleDialogProps extends WorkspaceStaleProps {
    open: boolean
    /** Closes the dialog so unsaved text can be copied; the update banner stays. */
    onDismiss: () => void
}

/**
 * Blocking reload dialog. Private writes are already refused by the API layer;
 * "Not now" only uncovers the page so the user can copy unsaved text first.
 */
export function WorkspaceStaleDialog({ open, onReload, onDismiss }: WorkspaceStaleDialogProps) {
    const { t } = useTranslation()
    return (
        <Modal
            open={open}
            onClose={onDismiss}
            title={t('workspaces.stale.title')}
            icon={<Icon icon={RefreshCw} size={22} className="text-ember-400" />}
            showClose={false}
            initialFocus="first-control"
            footer={
                <>
                    <Button variant="ghost" onClick={onDismiss}>{t('workspaces.stale.dismiss')}</Button>
                    <Button variant="primary" iconLeft={<RefreshCw size={15} strokeWidth={1.75} />} onClick={onReload}>
                        {t('workspaces.stale.reload')}
                    </Button>
                </>
            }
        >
            <p className="font-ui text-body leading-relaxed text-parchment-200">{t('workspaces.stale.body')}</p>
        </Modal>
    )
}
