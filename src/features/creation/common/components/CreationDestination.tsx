/**
 * CreationDestination — "Will be saved in Workspace / Collection" in the
 * creator chrome (Workspace R1, document 08 "Creation from the unified
 * library"). Root creation reads "Library"; a folder origin names its
 * collection. Shown before any submission, only while creating a new card and
 * only when the workspace UI is enabled.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen } from 'lucide-react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { apiService } from '@/infrastructure/api'
import type { CreationOrigin } from '@/features/library/creationOrigin'
import { Icon } from '@/ui/primitives'

/** The collection's name, resolved from the origin workspace; null while unknown. */
function useCollectionName(workspaceId: string | null, collectionId: string | null): string | null {
    const [resolved, setResolved] = useState<{ key: string; name: string } | null>(null)
    const key = workspaceId && collectionId ? `${workspaceId}:${collectionId}` : null
    useEffect(() => {
        if (!workspaceId || !collectionId) return
        let cancelled = false
        apiService
            .getCollection(workspaceId, collectionId)
            .then((collection) => {
                if (!cancelled) setResolved({ key: `${workspaceId}:${collectionId}`, name: collection.name })
            })
            .catch(() => {
                // A missing/foreign collection keeps the neutral label; the save reports it.
            })
        return () => {
            cancelled = true
        }
    }, [workspaceId, collectionId])
    return resolved && resolved.key === key ? resolved.name : null
}

export function CreationDestination({ origin }: { origin: CreationOrigin | null }) {
    const { t } = useTranslation()
    const { workspaces } = useWorkspace()
    const collectionName = useCollectionName(origin?.workspaceId ?? null, origin?.collectionId ?? null)
    if (!origin) return null
    const workspace = workspaces.find((candidate) => candidate.id === origin.workspaceId)?.name
        ?? t('workspaceContent.destination.unknownWorkspace')
    const collection = origin.collectionId
        ? collectionName ?? t('workspaceContent.destination.unknownCollection')
        : t('workspaceContent.destination.root')
    return (
        <span className="inline-flex min-w-0 items-center gap-1.5 font-ui text-label text-parchment-300" data-testid="creation-destination">
            <Icon icon={FolderOpen} size={14} className="shrink-0 text-ember-400" />
            <span className="min-w-0 break-words">{t('workspaceContent.destination.label', { workspace, collection })}</span>
        </span>
    )
}
