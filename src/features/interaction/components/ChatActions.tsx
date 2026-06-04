import './ChatActions.css'

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
    onDeleteClick
}: ChatActionsProps) {
    return (
        <div className="chat-actions">
            {onEditClick && !isEditing && !isStreaming && (
                <button 
                    className="chat-actions__btn chat-actions__btn--edit"
                    onClick={onEditClick}
                    aria-label="Edit message"
                    title="Edit this message"
                >
                    <span className="chat-actions__icon">✏️</span>
                    <span className="chat-actions__hide-mobile">Edit</span>
                </button>
            )}
            {!isUser && onRegenerateClick && !isStreaming && !isEditing && (
                <button 
                    className="chat-actions__btn chat-actions__btn--regenerate"
                    onClick={() => onRegenerateClick(turnId)}
                    aria-label="Regenerate response"
                    title="Regenerate this response"
                >
                    <span className="chat-actions__icon chat-actions__icon--rotate">↻</span>
                    <span className="chat-actions__hide-mobile">Regenerate</span>
                </button>
            )}
            {onDeleteClick && !isStreaming && !isEditing && (
                <button 
                    className="chat-actions__btn chat-actions__btn--delete"
                    onClick={() => onDeleteClick(turnId)}
                    aria-label="Delete message"
                    title="Delete this message"
                >
                    <span className="chat-actions__icon">🗑️</span>
                    <span className="chat-actions__hide-mobile">Delete</span>
                </button>
            )}
        </div>
    )
} 