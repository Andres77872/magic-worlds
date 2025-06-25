import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

export function ChatTurn({ turn, onForwardOptionClick, onRegenerateClick }: ChatTurnProps) {
    const isUser = turn.type === 'user'
    
    return (
        <div className={`chat-turn ${isUser ? 'user' : 'assistant'}`}>
            <div className="turn-avatar">
                {isUser ? (
                    <div className="avatar-user" aria-label="Player">
                        <span>P</span>
                    </div>
                ) : (
                    <div className="avatar-assistant" aria-label="Game Master">
                        <span>GM</span>
                    </div>
                )}
            </div>
            
            <div className="turn-content-wrapper">
                <div className="turn-header">
                    <span className="turn-role">{isUser ? 'Player' : 'Game Master'}</span>
                    <div className="turn-header-actions">
                        <span className="turn-timestamp">
                            {new Date(turn.timestamp).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            })}
                        </span>
                        {!isUser && onRegenerateClick && !turn.isStreaming && (
                            <button 
                                className="regenerate-button"
                                onClick={() => onRegenerateClick(turn.id)}
                                aria-label="Regenerate response"
                                title="Regenerate this response"
                            >
                                <span className="regenerate-icon">↻</span>
                                <span className="regenerate-text">Regenerate</span>
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="turn-content">
                    {isUser ? (
                        // User content - simple layout
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
                            <div className="turn-text user-text">{turn.content}</div>
                        </>
                    ) : (
                        // Assistant content - side-by-side layout
                        <div className="assistant-content-layout">
                            <div className="turn-text assistant-text">
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
                </div>
                
                {/* Forward Options */}
                {(turn.forwardOptions && turn.forwardOptions.length > 0) || turn.isStreamingForwardOptions ? (
                    <div className="forward-options">
                        <div className="forward-options-header">
                            <span className="forward-options-title">Suggested Actions</span>
                            {turn.isStreamingForwardOptions && (
                                <div className="forward-options-loading">
                                    <span className="loading-dot"></span>
                                    <span className="loading-dot"></span>
                                    <span className="loading-dot"></span>
                                </div>
                            )}
                        </div>
                        {turn.forwardOptions && turn.forwardOptions.length > 0 && (
                            <div className="forward-options-list">
                                {turn.forwardOptions.map((option, index) => (
                                    <button
                                        key={index}
                                        className="forward-option-button"
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