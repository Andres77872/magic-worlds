/**
 * Workspace management: every workspace of the account (archived included)
 * with Open, Edit, Archive and Restore. The protected default explains why it
 * can't be archived; a live call in the workspace is reported as such. Results
 * are announced in the dialog.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, ArchiveRestore, ArrowRight, Layers, Pencil } from 'lucide-react'
import type { Workspace } from '@/shared/types'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Badge, Button, Callout, Icon, Modal, cx } from '@/ui/primitives'
import type { WorkspaceActionResult } from '../useWorkspaceActions'

interface WorkspaceManageDialogProps {
    open: boolean
    onClose: () => void
    workspaces: readonly Workspace[]
    selectedWorkspaceId: string | null
    onOpenWorkspace: (workspace: Workspace) => void
    onEdit: (workspace: Workspace) => void
    onCreate: () => void
    onArchive: (workspace: Workspace) => Promise<WorkspaceActionResult>
    onRestore: (workspace: Workspace) => Promise<WorkspaceActionResult>
}

type Notice = { tone: 'success' | 'danger'; message: string }

export function WorkspaceManageDialog({
    open,
    onClose,
    workspaces,
    selectedWorkspaceId,
    onOpenWorkspace,
    onEdit,
    onCreate,
    onArchive,
    onRestore,
}: WorkspaceManageDialogProps) {
    const { t } = useTranslation()
    const [notice, setNotice] = useState<Notice | null>(null)
    const [pendingArchive, setPendingArchive] = useState<Workspace | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)

    const [wasOpen, setWasOpen] = useState(open)
    if (wasOpen !== open) {
        setWasOpen(open)
        if (open) {
            setNotice(null)
            setPendingArchive(null)
        }
    }

    const report = (result: WorkspaceActionResult, success: (name: string) => string) => {
        setNotice(result.ok
            ? { tone: 'success', message: success(result.workspace.name) }
            : { tone: 'danger', message: t(`workspaceUi.errors.${result.error}`) })
    }

    const confirmArchive = async () => {
        const target = pendingArchive
        if (!target) return
        setBusyId(target.id)
        const result = await onArchive(target)
        setBusyId(null)
        setPendingArchive(null)
        report(result, (name) => t('workspaceUi.manage.archived', { name }))
    }

    const restore = async (workspace: Workspace) => {
        setBusyId(workspace.id)
        const result = await onRestore(workspace)
        setBusyId(null)
        report(result, (name) => t('workspaceUi.manage.restored', { name }))
    }

    return (
        <>
            <Modal
                open={open && pendingArchive === null}
                onClose={onClose}
                title={t('workspaceUi.manage.title')}
                icon={<Icon icon={Layers} size={22} className="text-ember-400" />}
                size="lg"
                footer={
                    <>
                        <Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
                        <Button variant="primary" onClick={onCreate}>{t('workspaceUi.switcher.create')}</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <p className="font-ui text-sm text-fg-muted">{t('workspaceUi.manage.intro')}</p>
                    <div aria-live="polite">
                        {notice && <Callout tone={notice.tone} role={notice.tone === 'danger' ? 'alert' : 'status'}>{notice.message}</Callout>}
                    </div>
                    <ul className="flex flex-col gap-2">
                        {workspaces.map((workspace) => {
                            const archived = workspace.archived_at !== null
                            const current = workspace.id === selectedWorkspaceId
                            const busy = busyId === workspace.id
                            return (
                                <li
                                    key={workspace.id}
                                    className={cx(
                                        'flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
                                        current ? 'border-ember-500/40 bg-ember-500/[.06]' : 'border-line bg-surface-raised/40',
                                    )}
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="truncate font-ui text-sm font-semibold text-fg">{workspace.name}</span>
                                            {workspace.is_default && <Badge tone="neutral">{t('workspaceUi.switcher.defaultBadge')}</Badge>}
                                            {current && <Badge tone="ember">{t('workspaceUi.manage.current')}</Badge>}
                                            {archived && <Badge tone="warning">{t('workspaceUi.switcher.archived')}</Badge>}
                                        </div>
                                        <p className="mt-0.5 font-ui text-caption text-fg-muted">
                                            {t('workspaceUi.use.label')}: {t(`workspaceUi.use.${workspace.preferred_use}`)}
                                        </p>
                                        {workspace.is_default && (
                                            <p className="mt-1 font-ui text-caption text-fg-faint">{t('workspaceUi.manage.defaultArchiveHint')}</p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                        {!current && (
                                            <Button size="sm" variant="secondary" iconRight={<ArrowRight size={14} />}
                                                onClick={() => onOpenWorkspace(workspace)}>
                                                {t('workspaceUi.manage.open')}
                                            </Button>
                                        )}
                                        <Button size="sm" variant="ghost" iconLeft={<Pencil size={14} />} onClick={() => onEdit(workspace)}
                                            aria-label={`${t('workspaceUi.manage.edit')}: ${workspace.name}`}>
                                            {t('workspaceUi.manage.edit')}
                                        </Button>
                                        {archived ? (
                                            <Button size="sm" variant="ghost" iconLeft={<ArchiveRestore size={14} />} disabled={busy}
                                                onClick={() => void restore(workspace)}
                                                aria-label={`${t('workspaceUi.manage.restore')}: ${workspace.name}`}>
                                                {t('workspaceUi.manage.restore')}
                                            </Button>
                                        ) : (
                                            <Button size="sm" variant="ghost" iconLeft={<Archive size={14} />}
                                                disabled={workspace.is_default || busy}
                                                title={workspace.is_default ? t('workspaceUi.manage.defaultArchiveHint') : undefined}
                                                onClick={() => setPendingArchive(workspace)}
                                                aria-label={`${t('workspaceUi.manage.archive')}: ${workspace.name}`}>
                                                {t('workspaceUi.manage.archive')}
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            </Modal>
            <ConfirmDialog
                visible={open && pendingArchive !== null}
                title={t('workspaceUi.manage.archiveTitle', { name: pendingArchive?.name ?? '' })}
                message={t('workspaceUi.manage.archiveBody')}
                confirmLabel={t('workspaceUi.manage.archive')}
                isProcessing={busyId !== null && busyId === pendingArchive?.id}
                onConfirm={() => void confirmArchive()}
                onCancel={() => setPendingArchive(null)}
            />
        </>
    )
}
