import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useState } from 'react'
import type { TurnEntry } from '../../../shared'
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

// Process text nodes to handle dialogue formatting
function processTextContent(content: string): React.ReactNode[] {
    const parts = content.split(/("([^"]+)")/g);
    const result: React.ReactNode[] = [];
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('"') && part.endsWith('"')) {
            // This is dialogue
            result.push(
                <span key={i} className="rp-dialogue">
                    {part}
                </span>
            );
        } else if (part.trim()) {
            // Regular text
            result.push(part);
        }
    }
    
    return result.length > 0 ? result : [content];
}

export function ChatTurn({ turn, onForwardOptionClick, onRegenerateClick, onDeleteClick, onEditClick }: ChatTurnProps) {
    const isUser = turn.type === 'user'
    const [isEditing, setIsEditing] = useState(false)
    const [editContent, setEditContent] = useState(turn.content)
    
    const handleEditStart = () => {
        setIsEditing(true)
        setEditContent(turn.content)
    }
    
    const handleEditSave = () => {
        if (onEditClick && editContent.trim() !== turn.content) {
            onEditClick(turn.id, editContent.trim())
        }
        setIsEditing(false)
    }
    
    const handleEditCancel = () => {
        setEditContent(turn.content)
        setIsEditing(false)
    }
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            handleEditSave()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            handleEditCancel()
        }
    }
    
    return (
        <div className={`chat-turn chat-turn--${isUser ? 'user' : 'assistant'} interaction-fade-in`}>
            <div className="chat-turn__avatar">
                {isUser ? (
                    <div className="chat-turn__avatar-icon chat-turn__avatar-icon--user" aria-label="Player">
                        <span>P</span>
                    </div>
                ) : (
                    <div className="chat-turn__avatar-icon chat-turn__avatar-icon--assistant" aria-label="Game Master">
                        <span>GM</span>
                    </div>
                )}
            </div>
            
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
                        {onEditClick && !isEditing && !turn.isStreaming && (
                            <button 
                                className="interaction-btn interaction-btn--primary interaction-focusable"
                                onClick={handleEditStart}
                                aria-label="Edit message"
                                title="Edit this message"
                            >
                                <span className="edit-icon">✏️</span>
                                <span className="interaction-hide-mobile">Edit</span>
                            </button>
                        )}
                        {!isUser && onRegenerateClick && !turn.isStreaming && !isEditing && (
                            <button 
                                className="interaction-btn interaction-btn--secondary interaction-focusable"
                                onClick={() => onRegenerateClick(turn.id)}
                                aria-label="Regenerate response"
                                title="Regenerate this response"
                            >
                                <span className="regenerate-icon">↻</span>
                                <span className="interaction-hide-mobile">Regenerate</span>
                            </button>
                        )}
                        {onDeleteClick && !turn.isStreaming && !isEditing && (
                            <button 
                                className="interaction-btn interaction-btn--small interaction-btn--danger interaction-focusable"
                                onClick={() => onDeleteClick(turn.id)}
                                aria-label="Delete message"
                                title="Delete this message"
                            >
                                <span className="delete-icon">🗑️</span>
                                <span className="interaction-hide-mobile">Delete</span>
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="chat-turn__content">
                    {isUser ? (
                        // User content - simple layout with edit functionality
                        <>
                            {turn.imageUrl && (
                                <div className="turn-image-container">
                                    <img 
                                        src={turn.imageUrl} 
                                        alt="Generated scene" 
                                        className="turn-image"
                                        loading="lazy"
                                    />
                                </div>
                            )}
                            {isEditing ? (
                                <div className="edit-container">
                                    <textarea
                                        className="edit-textarea interaction-focusable"
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Enter your action..."
                                        autoFocus
                                        rows={3}
                                    />
                                    <div className="edit-actions">
                                        <button 
                                            className="interaction-btn interaction-btn--primary interaction-btn--small"
                                            onClick={handleEditSave}
                                            disabled={!editContent.trim()}
                                        >
                                            Save
                                        </button>
                                        <button 
                                            className="interaction-btn interaction-btn--secondary interaction-btn--small"
                                            onClick={handleEditCancel}
                                        >
                                            Cancel
                                        </button>
                                        <span className="edit-hint interaction-text--small interaction-text--secondary">Ctrl+Enter to save, Escape to cancel</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="chat-turn__text chat-turn__text--user">{turn.content}</div>
                            )}
                        </>
                    ) : (
                        // Assistant content - side-by-side layout with edit functionality
                        <>
                            {isEditing ? (
                                <div className="edit-container">
                                    <textarea
                                        className="edit-textarea interaction-focusable"
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Enter the assistant response (markdown supported)..."
                                        autoFocus
                                        rows={8}
                                    />
                                    <div className="edit-actions">
                                        <button 
                                            className="interaction-btn interaction-btn--primary interaction-btn--small"
                                            onClick={handleEditSave}
                                            disabled={!editContent.trim()}
                                        >
                                            Save
                                        </button>
                                        <button 
                                            className="interaction-btn interaction-btn--secondary interaction-btn--small"
                                            onClick={handleEditCancel}
                                        >
                                            Cancel
                                        </button>
                                        <span className="edit-hint interaction-text--small interaction-text--secondary">Ctrl+Enter to save, Escape to cancel</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="assistant-content-layout">
                                    <div className="chat-turn__text chat-turn__text--assistant">
                                        <ReactMarkdown 
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                // Custom rendering for markdown elements
                                                p: ({children}) => <p className="markdown-paragraph">{children}</p>,
                                                h1: ({children}) => <h1 className="markdown-h1">{children}</h1>,
                                                h2: ({children}) => <h2 className="markdown-h2">{children}</h2>,
                                                h3: ({children}) => <h3 className="markdown-h3">{children}</h3>,
                                                ul: ({children}) => <ul className="markdown-list">{children}</ul>,
                                                ol: ({children}) => <ol className="markdown-list markdown-list-ordered">{children}</ol>,
                                                li: ({children}) => <li className="markdown-list-item">{children}</li>,
                                                blockquote: ({children}) => <blockquote className="markdown-blockquote">{children}</blockquote>,
                                                code: ({inline, className, children}: any) => {
                                                    return inline ? (
                                                        <code className="markdown-code-inline">{children}</code>
                                                    ) : (
                                                        <code className={`markdown-code-block ${className || ''}`}>
                                                            {children}
                                                        </code>
                                                    )
                                                },
                                                // Actions (italics) - *doing something*
                                                em: ({children}) => <em className="rp-action">{children}</em>,
                                                // Thoughts (bold) - **thinking something**
                                                strong: ({children}) => <strong className="rp-thought">{children}</strong>,
                                                hr: () => <hr className="markdown-divider" />,
                                                // Process text nodes for dialogue detection
                                                text: ({value}: any) => {
                                                    const processed = processTextContent(value);
                                                    return <>{processed}</>;
                                                },
                                            }}
                                        >
                                            {turn.content}
                                        </ReactMarkdown>
                                        {turn.isStreaming && (
                                            <div className="typing-indicator">
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {turn.imageUrl && (
                                        <div className="turn-image-container assistant-image">
                                            <img 
                                                src={turn.imageUrl} 
                                                alt="Generated scene" 
                                                className="turn-image"
                                                loading="lazy"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
                
                {/* Forward Options */}
                {(turn.forwardOptions && turn.forwardOptions.length > 0) || turn.isStreamingForwardOptions ? (
                    <div className="forward-options interaction-shimmer">
                        <div className="forward-options-header">
                            <span className="forward-options-title">Suggested Actions</span>
                            {turn.isStreamingForwardOptions && (
                                <div className="interaction-loading__dots">
                                    <span className="interaction-loading__dot"></span>
                                    <span className="interaction-loading__dot"></span>
                                    <span className="interaction-loading__dot"></span>
                                </div>
                            )}
                        </div>
                        {turn.forwardOptions && turn.forwardOptions.length > 0 && (
                            <div className="forward-options-list">
                                {turn.forwardOptions.map((option, index) => (
                                    <button
                                        key={index}
                                        className="forward-option-button interaction-focusable"
                                        onClick={() => onForwardOptionClick(option.forward_question)}
                                        style={{animationDelay: `${index * 0.1}s`}}
                                    >
                                        <span className="option-icon">✨</span>
                                        <span className="option-text">{option.forward_question}</span>
                                        <span className="option-arrow">→</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    )
} 