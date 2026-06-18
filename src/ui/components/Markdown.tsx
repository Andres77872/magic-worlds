/**
 * Markdown — the shared GitHub-flavored markdown renderer for the app.
 *
 * Renders into the token-based `.chat-prose` / `.markdown-*` styles defined in
 * `theme.css`, so headings, lists, blockquotes, and code all match the Reverie
 * look without per-call styling. Used by the assistant prose, the lorebook
 * resource viewer, and anywhere plain explanation-style markdown is shown.
 *
 * It deliberately keeps em/strong as plain emphasis — the roleplay chat renderer
 * (`ProseMarkdown`/`SegmentMarkdown`) adds dialogue/action/thought semantics and
 * lore-trigger rehype, which would mis-style ordinary text, so that one stays
 * separate.
 */
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cx } from '@/ui/primitives'

interface MarkdownProps {
    content: string
    /** Extra classes appended to the mandatory `.chat-prose` wrapper. */
    className?: string
    /** Rendered inside the wrapper after the markdown (e.g. streaming dots). */
    trailing?: ReactNode
}

export function Markdown({ content, className, trailing }: MarkdownProps) {
    return (
        <div className={cx('chat-prose', className)}>
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
                    code: ({ className: codeClassName, children, ...rest }) => {
                        const inline = !codeClassName && !String(children).includes('\n')
                        return inline ? (
                            <code className="markdown-code-inline" {...rest}>{children}</code>
                        ) : (
                            <code className={`markdown-code-block ${codeClassName || ''}`} {...rest}>{children}</code>
                        )
                    },
                    hr: () => <hr className="markdown-divider" />,
                }}
            >
                {content}
            </ReactMarkdown>
            {trailing}
        </div>
    )
}
