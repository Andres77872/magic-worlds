import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVertical, Plus, X } from 'lucide-react'
import { Avatar, cx, IconButton } from '@/ui/primitives'
import { useAssistantDragHandle } from './assistantDragContext'

interface AssistantHeaderProps {
    title?: string
    /** Current document title shown under the panel name. */
    cardTitle: string
    streaming: boolean
    /** The conversation menu, rendered to keep its popover anchored in the header. */
    menu: ReactNode
    onNewChat?: () => void
    newChatDisabled?: boolean
    newChatLabel?: string
    onClose: () => void
    closeLabel?: string
}

export function AssistantHeader({
    title,
    cardTitle,
    streaming,
    menu,
    onNewChat,
    newChatDisabled,
    newChatLabel,
    onClose,
    closeLabel,
}: AssistantHeaderProps) {
    const { t } = useTranslation()
    const drag = useAssistantDragHandle()
    const resolvedTitle = title ?? t('creation.common.assistant.title')
    const resolvedNewChatLabel = newChatLabel ?? t('creation.common.assistant.newChat')
    const resolvedCloseLabel = closeLabel ?? t('creation.common.assistant.close')

    return (
        <header className="flex items-center justify-between gap-2 border-b border-parchment-50/[.08] bg-ink-700 px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
                {drag && (
                    <button
                        type="button"
                        aria-label={t('creation.common.assistant.dragAssistant')}
                        title={t('creation.common.assistant.dragAssistant')}
                        className={cx(
                            '-ml-1 inline-flex h-8 w-6 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-parchment-400 transition-colors hover:bg-parchment-50/[.05] hover:text-parchment-50',
                            drag.dragging && 'cursor-grabbing bg-ember-500/15 text-ember-300',
                        )}
                        {...drag.dragHandleProps}
                    >
                        <GripVertical size={15} />
                    </button>
                )}
                <Avatar name={t('creation.common.assistant.avatarName')} size={36} ring="arcane" status={streaming ? 'think' : 'none'} />
                <div className="min-w-0">
                    <h2 className="truncate font-display text-[17px] font-semibold leading-tight text-parchment-50">{resolvedTitle}</h2>
                    <p className="truncate font-ui text-[11px] text-parchment-300">{cardTitle}</p>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                {onNewChat && (
                    <IconButton
                        label={resolvedNewChatLabel}
                        size="sm"
                        disabled={newChatDisabled}
                        className="disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={onNewChat}
                    >
                        <Plus size={16} />
                    </IconButton>
                )}
                {menu}
                <IconButton label={resolvedCloseLabel} size="sm" onClick={onClose}>
                    <X size={16} />
                </IconButton>
            </div>
        </header>
    )
}
