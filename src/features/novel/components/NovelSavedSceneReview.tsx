import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AccountStorageScope } from '@/shared/workspaceStorage'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import { isWorkspaceArchived } from '@/shared/hooks/useWorkspaceReadOnly'
import { Button, Callout } from '@/ui/primitives'
import { listSavedReconciliations, type SavedReconciliation } from '../persistence/reconciliationJournal'
import type { ReconciliationReview } from '../hooks/useReconciliationProgress'
import { NovelSceneConflictModal } from './NovelSceneConflictModal'
import { useDeviceWorkspaceStates } from '../hooks/useDeviceWorkspaceStates'
import { useDeviceNovelState } from '../hooks/useDeviceNovelState'
import { deviceSceneReadOnly } from '../persistence/novelDeviceLifecycle'

/** Saved source inspection stays separate from a fresh account comparison. */
export function NovelSavedSceneReviews({ scope, current, allWorkspaces, onCheckpointState }: {
    scope: AccountStorageScope; current: () => boolean; allWorkspaces: boolean; onCheckpointState: (safe: boolean) => void;
}) {
    const { t } = useTranslation(), workspaces = useContext(WorkspaceContext)?.workspaces ?? [], key = JSON.stringify(scope)
    const [loaded, setLoaded] = useState<{ key: string; items: SavedReconciliation[]; unavailable: boolean; unreadable: number } | null>(null)
    const [opened, setOpened] = useState<ReconciliationReview | null>(null), owner = useRef({ key, current })
    const lifecycle = useDeviceWorkspaceStates(scope, current)
    const novelLifecycle = useDeviceNovelState(opened?.recoveryScope ? { ...scope, workspaceId: opened.recoveryScope.workspaceId, storyId: opened.account.storyId } : null, current)
    useLayoutEffect(() => { owner.current = { key, current } })
    const source = useRef(scope)
    useLayoutEffect(() => { source.current = scope })
    useEffect(() => {
        let active = true
        void listSavedReconciliations(source.current).then((result) => {
            if (active && owner.current.key === key && owner.current.current()) setLoaded({ key, ...result })
        })
        return () => { active = false }
    }, [key])
    const result = loaded?.key === key ? loaded : null
    if (!current()) return null
    const items = result?.items.filter((item) => allWorkspaces || item.checkpoint.isDefaultWorkspace === true
        && lifecycle.data?.states[item.scope.workspaceId]?.isDefault !== false) ?? []
    return <>
        {result?.unavailable && <Callout tone="warning" role="status">{t('novelEditor.offline.reviewUnavailable')}</Callout>}
        {Boolean(result?.unreadable) && <Callout tone="warning" role="status">{t('novelEditor.offline.reviewUnreadable')}</Callout>}
        {items.length > 0 && <section className="space-y-3 rounded-lg border border-parchment-50/10 bg-ink-700 p-4">
            <h3 className="font-display text-h3">{t('novelEditor.offline.savedReviews')}</h3>
            {items.map(({ scope: savedScope, checkpoint }) => <div key={checkpoint.key}>
                <Button variant="secondary" size="sm" onClick={() => {
                    if (!current()) return
                    const source = checkpoint.source
                    setOpened({ id: checkpoint.key, ownerKey: key, sequence: checkpoint.sequence,
                        recoveryScope: { ...savedScope, ...(checkpoint.isDefaultWorkspace !== undefined ? { isDefaultWorkspace: checkpoint.isDefaultWorkspace } : {}) },
                        baseDocument: source.base, deviceDocument: source.device, deviceTitle: source.deviceTitle, accountReadOnly: source.accountReadOnly,
                        ...(source.applicationRejection?{applicationRejection:source.applicationRejection}:{}),
                        account: { id: source.sceneId, storyId: source.storyId, chapterId: source.chapterId, title: source.accountTitle,
                            document: source.account, revision: source.accountRevision, metadataRevision: source.accountMetadataRevision, contentHash: source.accountContentHash } })
                }}>{t('novelEditor.offline.savedReviewLabel', { title: checkpoint.source.deviceTitle, revision: checkpoint.source.accountRevision })}</Button>
            </div>)}
        </section>}
        <NovelSceneConflictModal open={Boolean(opened)} review={opened?.ownerKey === key ? opened : null} deviceOnly
            readOnly={Boolean(opened?.accountReadOnly) || isWorkspaceArchived(workspaces, opened?.recoveryScope?.workspaceId)
                || Boolean(opened?.recoveryScope && lifecycle.data?.states[opened.recoveryScope.workspaceId]?.archived)
                || Boolean(opened && deviceSceneReadOnly(novelLifecycle.data?.state ?? null, opened.account.id))}
            novelUnverified={Boolean(novelLifecycle.data?.unreadable)}
            workspaceUnverified={Boolean(opened?.recoveryScope && lifecycle.data?.unreadableIds.includes(opened.recoveryScope.workspaceId))} onCheckpointState={onCheckpointState}
            onClose={() => setOpened(null)} onRefresh={async () => {}} onResolve={() => false} />
    </>
}
