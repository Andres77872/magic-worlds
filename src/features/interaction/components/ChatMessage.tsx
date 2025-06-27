import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './ChatMessage.css'

interface ChatMessageProps {
    content: string
    isUser: boolean
    isStreaming?: boolean
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

export function ChatMessage({ content, isUser, isStreaming }: ChatMessageProps) {
    return (
        <div className={`chat-message chat-message--${isUser ? 'user' : 'assistant'}`}>
            {isUser ? (
                // Simple text for user messages
                <div className="chat-message__text">{content}</div>
            ) : (
                // Rich markdown for assistant messages
                <>
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
                        {content}
                    </ReactMarkdown>
                    {isStreaming && (
                        <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    )}
                </>
            )}
        </div>
    )
} 