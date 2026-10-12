/**
 * WorkspaceOriginLabel — "From <workspace>" on account-wide surfaces (tasks,
 * notifications, the playlist dock) whose items belong to a workspace other
 * than the selected one (Workspace R1, document 08 "Lifecycle and origin
 * interactions"). Renders nothing for items of the selected workspace, items
 * without an origin, or outside a WorkspaceProvider (stories, public shells).
 */
import { useTranslation } from 'react-i18next'
import { Layers } from 'lucide-react'
import { Badge, Icon } from '@/ui/primitives'
import { useWorkspaceOrigin } from './useWorkspaceOrigin'

export function WorkspaceOriginLabel({ workspaceId, className }: { workspaceId: string | null | undefined; className?: string }) {
    const { t } = useTranslation()
    const origin = useWorkspaceOrigin(workspaceId)
    if (!origin.foreign) return null
    const text = origin.name ? t('workspaceActivity.origin.label', { name: origin.name }) : t('workspaceActivity.origin.unknown')
    return (
        <Badge
            tone="neutral"
            icon={<Icon icon={Layers} size={12} />}
            className={className}
            title={origin.name ? t('workspaceActivity.origin.aria', { name: origin.name }) : text}
        >
            <span className="max-w-[16ch] truncate">{text}</span>
        </Badge>
    )
}
