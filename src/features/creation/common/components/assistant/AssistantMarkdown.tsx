import { Markdown } from '@/ui/components'

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
 * mis-style text like "**name** updated". Delegates rendering to the shared
 * {@link Markdown} component, keeping only the streaming-dots wrapper.
 */
export function AssistantMarkdown({ content, isStreaming }: AssistantMarkdownProps) {
    return (
        <Markdown
            content={content}
            className="text-[15px] leading-[1.6]"
            trailing={isStreaming ? <StreamingDots /> : null}
        />
    )
}
