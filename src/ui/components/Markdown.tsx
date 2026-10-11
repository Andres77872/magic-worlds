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
 *
 * The element renderers are module constants on purpose: react-markdown uses
 * them as component types, so fresh functions on every render would remount the
 * whole tree on each streaming delta (and detach anything anchored to a link).
 */
import { useMemo, type AnchorHTMLAttributes, type ComponentType, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cx } from '@/ui/primitives'

/** Props a custom link renderer receives (react-markdown's own `node` is stripped). */
export type MarkdownLinkProps = AnchorHTMLAttributes<HTMLAnchorElement>

interface MarkdownProps {
    content: string
    /** Extra classes appended to the mandatory `.chat-prose` wrapper. */
    className?: string
    /** Rendered inside the wrapper after the markdown (e.g. streaming dots). */
    trailing?: ReactNode
    /**
     * Replaces the plain `<a>` (e.g. links that preview their target on hover).
     * Pass a stable component: a new one each render remounts every link.
     */
    linkComponent?: ComponentType<MarkdownLinkProps>
}

const BASE_COMPONENTS: Components = {
    p: ({ children }) => <p className="markdown-paragraph">{children}</p>,
    h1: ({ children }) => <h1 className="markdown-h1">{children}</h1>,
    h2: ({ children }) => <h2 className="markdown-h2">{children}</h2>,
    h3: ({ children }) => <h3 className="markdown-h3">{children}</h3>,
    ul: ({ children }) => <ul className="markdown-list">{children}</ul>,
    ol: ({ children }) => <ol className="markdown-list markdown-list-ordered">{children}</ol>,
    li: ({ children }) => <li className="markdown-list-item">{children}</li>,
    blockquote: ({ children }) => <blockquote className="markdown-blockquote">{children}</blockquote>,
    code: ({ className: codeClassName, children, node, ...rest }) => {
        void node // react-markdown's AST node must not reach the DOM
        const inline = !codeClassName && !String(children).includes('\n')
        return inline ? (
            <code className="markdown-code-inline" {...rest}>{children}</code>
        ) : (
            <code className={`markdown-code-block ${codeClassName || ''}`} {...rest}>{children}</code>
        )
    },
    hr: () => <hr className="markdown-divider" />,
    a: ({ node, className: linkClassName, ...rest }) => {
        void node
        return <a className={cx('markdown-link', linkClassName)} {...rest} />
    },
}

function withLinkComponent(Link: ComponentType<MarkdownLinkProps>): Components {
    return {
        ...BASE_COMPONENTS,
        a: ({ node, className: linkClassName, ...rest }) => {
            void node
            return <Link className={cx('markdown-link', linkClassName)} {...rest} />
        },
    }
}

export function Markdown({ content, className, trailing, linkComponent }: MarkdownProps) {
    const components = useMemo(() => (linkComponent ? withLinkComponent(linkComponent) : BASE_COMPONENTS), [linkComponent])
    return (
        <div className={cx('chat-prose', className)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {content}
            </ReactMarkdown>
            {trailing}
        </div>
    )
}
