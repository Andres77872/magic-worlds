import { useState } from 'react'
import type { TurnEntry } from '../../../shared'
import { ChatAvatar } from './ChatAvatar'
import { ChatMessage } from './ChatMessage'
import { ChatActions } from './ChatActions'
import { ForwardOptions } from './ForwardOptions'
import { EditMode } from './EditMode'
import { ChatImage } from './ChatImage'
import './ChatTurn.css'

// Forward option interface
interface ForwardOption {
    forward_question: string
}

// Extend TurnEntry to include forward options
interface ExtendedTurnEntry extends TurnEntry {
    forwardOptions?: ForwardOption[]
    isStreaming?: boolean
    isStreamingForwardOptions?: boolean
    imageUrl?: string  // Add image URL field
}

interface ChatTurnProps {
    turn: ExtendedTurnEntry
    onForwardOptionClick: (option: string) => void
    onRegenerateClick?: (turnId: string) => void
    onDeleteClick?: (turnId: string) => void
    onEditClick?: (turnId: string, newContent: string) => void
}

export function ChatTurn({ turn, onForwardOptionClick, onRegenerateClick, onDeleteClick, onEditClick }: ChatTurnProps) {
    const isUser = turn.type === 'user'
    const [isEditing, setIsEditing] = useState(false)
    
    const handleEditStart = () => {
        setIsEditing(true)
    }
    
    const handleEditSave = (content: string) => {
        if (onEditClick && content.trim() !== turn.content) {
            onEditClick(turn.id, content.trim())
        }
        setIsEditing(false)
    }
    
    const handleEditCancel = () => {
        setIsEditing(false)
    }
    
    return (
        <div className={`chat-turn chat-turn--${isUser ? 'user' : 'assistant'} interaction-fade-in`}>
            <ChatAvatar isUser={isUser} />
            
            <div className="chat-turn__content-wrapper">
                <div className="chat-turn__header">
                    <span className="chat-turn__role">{isUser ? 'Player' : 'Game Master'}</span>
                    <div className="chat-turn__header-actions">
                        <span className="chat-turn__timestamp">
                            {new Date(turn.timestamp).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            })}
                        </span>
                        <ChatActions
                            turnId={turn.id}
                            isUser={isUser}
                            isEditing={isEditing}
                            isStreaming={turn.isStreaming}
                            onEditClick={onEditClick ? handleEditStart : undefined}
                            onRegenerateClick={onRegenerateClick}
                            onDeleteClick={onDeleteClick}
                        />
                    </div>
                </div>
                
                <div className="chat-turn__content">
                    {isUser ? (
                        // User content - simple layout with edit functionality
                        <>
                            {turn.imageUrl && (
                                <ChatImage 
                                    imageUrl={turn.imageUrl} 
                                    isAssistant={false}
                                    alt="Generated scene"
                                />
                            )}
                            {isEditing ? (
                                <EditMode
                                    initialContent={turn.content}
                                    isUser={isUser}
                                    onSave={handleEditSave}
                                    onCancel={handleEditCancel}
                                />
                            ) : (
                                <ChatMessage 
                                    content={turn.content}
                                    isUser={isUser}
                                    isStreaming={turn.isStreaming}
                                />
                            )}
                        </>
                    ) : (
                        // Assistant content - side-by-side layout with edit functionality
                        <>
                            {isEditing ? (
                                <EditMode
                                    initialContent={turn.content}
                                    isUser={isUser}
                                    onSave={handleEditSave}
                                    onCancel={handleEditCancel}
                                />
                            ) : (
                                <div className="assistant-content-layout">
                                    <ChatMessage 
                                        content={turn.content}
                                        isUser={isUser}
                                        isStreaming={turn.isStreaming}
                                    />
                                    
                                    {turn.imageUrl && (
                                        <ChatImage 
                                            imageUrl={turn.imageUrl} 
                                            isAssistant={true}
                                            alt="Generated scene"
                                        />
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
                
                {/* Forward Options */}
                <ForwardOptions
                    options={turn.forwardOptions}
                    isStreaming={turn.isStreamingForwardOptions}
                    onOptionClick={onForwardOptionClick}
                />
            </div>
        </div>
    )
} 