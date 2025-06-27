import './ChatAvatar.css'

interface ChatAvatarProps {
    isUser: boolean
}

export function ChatAvatar({ isUser }: ChatAvatarProps) {
    return (
        <div className="chat-avatar">
            {isUser ? (
                <div className="chat-avatar__icon chat-avatar__icon--user" aria-label="Player">
                    <span>P</span>
                </div>
            ) : (
                <div className="chat-avatar__icon chat-avatar__icon--assistant" aria-label="Game Master">
                    <span>GM</span>
                </div>
            )}
        </div>
    )
} 