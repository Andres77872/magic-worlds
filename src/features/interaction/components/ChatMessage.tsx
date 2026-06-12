import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
    if (isUser) {
        // Player turn — ember candlelit bubble
        return (
            <div className="inline-block rounded-2xl rounded-br-[4px] border border-ember-500/30 bg-ember-500/[.14] px-4 py-3 font-ui text-[15px] leading-relaxed text-parchment-50 whitespace-pre-wrap">
                {content}
            </div>
        )
    }

    // Game Master turn — literary narrative prose
    return (
        <div className="chat-prose">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
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
                    em: ({children}) => <em className="rp-action">{children}</em>,
                    strong: ({children}) => <strong className="rp-thought">{children}</strong>,
                    hr: () => <hr className="markdown-divider" />,
                    text: ({value}: any) => {
                        const processed = processTextContent(value);
                        return <>{processed}</>;
                    },
                }}
            >
                {content}
            </ReactMarkdown>
            {isStreaming && (
                <span className="ml-2 inline-flex items-center gap-1 align-middle">
                    <span className="h-1.5 w-1.5 rounded-full bg-arcane-400 animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-arcane-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-arcane-400 animate-pulse" style={{ animationDelay: '300ms' }} />
                </span>
            )}
        </div>
    )
}
