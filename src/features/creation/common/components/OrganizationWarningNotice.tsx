/**
 * OrganizationWarningNotice — the concise, non-blocking note for a generated or
 * assistant-created card whose requested initial collection was deleted while
 * it ran (`organization_warnings: [{ code: 'COLLECTION_REMOVED' }]`, Workspace
 * R1 document 15). The card itself was saved; only its grouping changed.
 */
import { useTranslation } from 'react-i18next'
import { FolderX } from 'lucide-react'
import type { OrganizationWarning } from '@/shared/types/workspace.types'
import { Icon } from '@/ui/primitives'

export function OrganizationWarningNotice({ warnings }: { warnings: readonly OrganizationWarning[] }) {
    const { t } = useTranslation()
    const removed = warnings.filter((warning) => warning.code === 'COLLECTION_REMOVED').length
    if (removed === 0) return null
    return (
        <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-ember-500/30 bg-ember-500/[.08] px-3 py-2 text-xs text-parchment-200"
            data-testid="organization-warning"
        >
            <Icon icon={FolderX} size={14} className="mt-px shrink-0 text-ember-400" />
            <span>{t('workspaceContent.organizationWarnings.collectionRemoved', { count: removed })}</span>
        </div>
    )
}
