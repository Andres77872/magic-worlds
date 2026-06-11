import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AssistantMarkdownProps {
    content: string
    isStreaming?: boolean
}

/** Three pulsing arcane dots — the assistant is composing. */
export function StreamingDots() {
    return (
        <span className="ml-1 inline-flex items-center gap-1 align-middle">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-arcane-400" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-arcane-400" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-arcane-400" style={{ animationDelay: '300ms' }} />
        </span>
    )
}

/**
 * Assistant prose on the shared `.chat-prose` styles. Unlike the interaction
 * chat's renderer, em/strong stay plain emphasis — assistant replies are
 * explanations, not roleplay, so the rp-action/rp-thought semantics would
 * mis-style text like "**name** updated".
 */
export function AssistantMarkdown({ content, isStreaming }: AssistantMarkdownProps) {
    return (
        <div className="chat-prose text-[15px] leading-[1.6]">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    p: ({ children }) => <p className="markdown-paragraph">{children}</p>,
                    h1: ({ children }) => <h1 className="markdown-h1">{children}</h1>,
                    h2: ({ children }) => <h2 className="markdown-h2">{children}</h2>,
                    h3: ({ children }) => <h3 className="markdown-h3">{children}</h3>,
                    ul: ({ children }) => <ul className="markdown-list">{children}</ul>,
                    ol: ({ children }) => <ol className="markdown-list markdown-list-ordered">{children}</ol>,
                    li: ({ children }) => <li className="markdown-list-item">{children}</li>,
                    blockquote: ({ children }) => <blockquote className="markdown-blockquote">{children}</blockquote>,
                    code: ({ className, children, ...rest }) => {
                        const inline = !className && !String(children).includes('\n')
                        return inline ? (
                            <code className="markdown-code-inline" {...rest}>{children}</code>
                        ) : (
                            <code className={`markdown-code-block ${className || ''}`} {...rest}>{children}</code>
                        )
                    },
                    hr: () => <hr className="markdown-divider" />,
                }}
            >
                {content}
            </ReactMarkdown>
            {isStreaming && <StreamingDots />}
        </div>
    )
}
