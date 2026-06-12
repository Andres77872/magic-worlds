import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { IconButton } from '../../../ui/primitives'

interface ChatActionsProps {
    turnId: string
    isUser: boolean
    isEditing: boolean
    isStreaming?: boolean
    onEditClick?: () => void
    onRegenerateClick?: (turnId: string) => void
    onDeleteClick?: (turnId: string) => void
}

export function ChatActions({
    turnId,
    isUser,
    isEditing,
    isStreaming,
    onEditClick,
    onRegenerateClick,
    onDeleteClick,
}: ChatActionsProps) {
    return (
        <div className="flex items-center gap-0.5">
            {onEditClick && !isEditing && !isStreaming && (
                <IconButton label="Edit message" size="sm" onClick={onEditClick}>
                    <Pencil size={14} strokeWidth={1.75} />
                </IconButton>
            )}
            {!isUser && onRegenerateClick && !isStreaming && !isEditing && (
                <IconButton label="Regenerate response" size="sm" onClick={() => onRegenerateClick(turnId)}>
                    <RotateCcw size={14} strokeWidth={1.75} />
                </IconButton>
            )}
            {onDeleteClick && !isStreaming && !isEditing && (
                <IconButton label="Delete message" size="sm" tone="danger" onClick={() => onDeleteClick(turnId)}>
                    <Trash2 size={14} strokeWidth={1.75} />
                </IconButton>
            )}
        </div>
    )
}
