/**
 * Workspace R1 page-level states (document 08 "Empty, error, and accessibility
 * states" and "Lifecycle and origin interactions"):
 *
 * - `ArchivedWorkspaceBanner`: the selected workspace is archived (here or in
 *   another tab). Content stays readable, copyable and exportable; Restore
 *   brings writes back. Switching stays available in the sidebar.
 * - `WorkspaceSwitchFailureNotice`: a switch was approved but could not
 *   finish (the call did not end, the destination was archived/removed, or a
 *   request failed). The source workspace stays open; Try again reruns it.
 * - `WorkspaceUnavailableTarget`: the URL names content in a workspace this tab
 *   can't open. Never this workspace's data, never "deleted".
 */
import { useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, ArchiveRestore, Layers, RefreshCw, TriangleAlert, X } from 'lucide-react'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import type { Workspace } from '@/shared/types'
import { Button, Callout, Card, Icon, IconButton } from '@/ui/primitives'
import type { SwitchFailure } from '@/app/providers/NavigationProvider'
import { useWorkspaceActions } from '../useWorkspaceActions'

interface ArchivedWorkspaceBannerViewProps {
    restoring: boolean
    error: string | null
    onRestore: () => void
}

export function ArchivedWorkspaceBannerView({ restoring, error, onRestore }: ArchivedWorkspaceBannerViewProps) {
    const { t } = useTranslation()
    return (
        <div className="shrink-0 px-4 pt-3 sm:px-6">
            <Callout
                tone="warning"
                role="status"
                icon={<Icon icon={Archive} size={18} />}
                action={
                    <Button size="sm" variant="secondary" iconLeft={<ArchiveRestore size={14} />} onClick={onRestore} disabled={restoring}>
                        {restoring ? t('workspaceUi.archivedBanner.restoring') : t('workspaceUi.archivedBanner.restore')}
                    </Button>
                }
            >
                <p>{t('workspaceUi.archivedBanner.message')}</p>
                {error && <p role="alert" className="mt-1 text-blood-300">{error}</p>}
            </Callout>
        </div>
    )
}

/** Connected banner: renders only for an archived selected workspace with the R1 UI on. */
export function ArchivedWorkspaceBanner() {
    const workspace = useContext(WorkspaceContext)
    const selected = workspace?.featureEnabled && workspace.status === 'ready' ? workspace.selectedWorkspace : null
    if (!selected?.archived_at) return null
    return <ConnectedArchivedBanner key={selected.id} workspace={selected} />
}

function ConnectedArchivedBanner({ workspace }: { workspace: Workspace }) {
    const { t } = useTranslation()
    const { restore } = useWorkspaceActions()
    const [restoring, setRestoring] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const run = async () => {
        setRestoring(true)
        setError(null)
        const result = await restore(workspace)
        setRestoring(false)
        if (!result.ok) setError(result.error === 'generic' ? t('workspaceUi.archivedBanner.failed') : t(`workspaceUi.errors.${result.error}`))
    }
    return <ArchivedWorkspaceBannerView restoring={restoring} error={error} onRestore={() => void run()} />
}

interface WorkspaceSwitchFailureNoticeProps {
    failure: SwitchFailure
    /** The workspace the user stays in. */
    sourceName: string
    onDismiss: () => void
}

export function WorkspaceSwitchFailureNotice({ failure, sourceName, onDismiss }: WorkspaceSwitchFailureNoticeProps) {
    const { t } = useTranslation()
    const message = failure.reason === 'call'
        ? t('workspaceUi.switchFailed.call', { name: sourceName })
        : failure.reason === 'archived'
            ? `${t('workspaceUi.errors.archived')} ${t('workspaceUi.switchFailed.generic', { name: sourceName })}`
            : failure.reason === 'unavailable'
                ? `${t('workspaceUi.errors.notFound')} ${t('workspaceUi.switchFailed.generic', { name: sourceName })}`
                : t('workspaceUi.switchFailed.generic', { name: sourceName })
    return (
        <div className="shrink-0 px-4 pt-3 sm:px-6">
            <Callout
                tone="danger"
                role="alert"
                icon={<Icon icon={TriangleAlert} size={18} />}
                action={
                    <div className="flex items-center gap-1">
                        {failure.reason !== 'unavailable' && (
                            <Button size="sm" variant="secondary" iconLeft={<RefreshCw size={14} />} onClick={failure.retry}>
                                {t('workspaceUi.switchFailed.retry')}
                            </Button>
                        )}
                        <IconButton label={t('common.close')} size="sm" onClick={onDismiss}>
                            <Icon icon={X} size={16} />
                        </IconButton>
                    </div>
                }
            >
                <p className="font-semibold text-parchment-50">{t('workspaceUi.switchFailed.title')}</p>
                <p className="mt-0.5">{message}</p>
            </Callout>
        </div>
    )
}

interface WorkspaceUnavailableTargetProps {
    /** Offer the Library (R1 UI on) next to Home. */
    showLibrary: boolean
    onLibrary: () => void
    onHome: () => void
}

export function WorkspaceUnavailableTarget({ showLibrary, onLibrary, onHome }: WorkspaceUnavailableTargetProps) {
    const { t } = useTranslation()
    return (
        <div className="flex min-h-full flex-1 items-center justify-center p-5">
            <Card className="w-full max-w-lg">
                <div role="status" className="flex flex-col items-center gap-4 p-6 text-center">
                    <span className="rounded-lg bg-parchment-50/[.06] p-3 text-parchment-300">
                        <Icon icon={Layers} size={24} />
                    </span>
                    <div>
                        <h2 className="font-display text-h3 text-parchment-50">{t('workspaceUi.unavailableTarget.title')}</h2>
                        <p className="mt-2 font-ui text-sm text-parchment-300">{t('workspaceUi.unavailableTarget.body')}</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                        {showLibrary && <Button variant="primary" onClick={onLibrary}>{t('workspaceUi.unavailableTarget.library')}</Button>}
                        <Button variant={showLibrary ? 'ghost' : 'primary'} onClick={onHome}>{t('workspaceUi.unavailableTarget.home')}</Button>
                    </div>
                </div>
            </Card>
        </div>
    )
}
