import { Fragment, memo, useContext, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatNarratorIdentity, ChatResponseSegment } from '../../../shared'
import { Avatar, cx, Eyebrow } from '../../../ui/primitives'
import {
    LoreTriggerContext,
    LoreTriggerMark,
    LORE_TRIGGER_TAG,
    rehypeLoreTriggers,
    scanText,
    segmentText,
    type TriggerMatcher,
} from '@/features/lorebook'

// Wrap any session-lore trigger hits in `text` with an interactive LoreTriggerMark.
// Returns the raw string untouched when there's no matcher or no hit (cheap, common).
function renderWithTriggers(text: string, matcher: TriggerMatcher | null): ReactNode {
    if (!text || !matcher) return text
    const matches = scanText(text, matcher)
    if (matches.length === 0) return text
    return segmentText(text, matches).map((segment, index) =>
        segment.match ? (
            <LoreTriggerMark key={index} match={segment.match}>
                {segment.text}
            </LoreTriggerMark>
        ) : (
            <Fragment key={index}>{segment.text}</Fragment>
        ),
    )
}

// react-markdown component for the `<loretrigger>` nodes injected by rehypeLoreTriggers
// (the hast node is passed through, carrying the resolved match).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LoreTriggerComponent({ node }: any) {
    const match = node?.loreMatch
    return match ? <LoreTriggerMark match={match} /> : null
}

interface ChatMessageProps {
    content: string
    isUser: boolean
    isStreaming?: boolean
    segments?: ChatResponseSegment[]
    /** Narrator identity for this turn (drives the "{narrator} is writing…" status). */
    narratorIdentity?: ChatNarratorIdentity | null
    /** Fallback AI label (e.g. "Game Master" / character name). */
    aiLabel?: string
    /** Session-lore matcher; when set, words touching lore are underlined + Ctrl/Cmd-click openable. */
    loreMatcher?: TriggerMatcher | null
}

// Process text nodes to handle dialogue formatting
function processTextContent(content: string): ReactNode[] {
    const parts = content.split(/("([^"]+)")/g);
    const result: ReactNode[] = [];

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

function ProseMarkdown({ content }: { content: string }) {
    const matcher = useContext(LoreTriggerContext)
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={matcher ? [[rehypeLoreTriggers, { matcher }]] : undefined}
            components={{
                [LORE_TRIGGER_TAG]: LoreTriggerComponent,
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
            } as Components}
        >
            {content}
        </ReactMarkdown>
    )
}

function SegmentMarkdown({ content, thought = false }: { content: string; thought?: boolean }) {
    const matcher = useContext(LoreTriggerContext)
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={matcher ? [[rehypeLoreTriggers, { matcher }]] : undefined}
            components={{
                [LORE_TRIGGER_TAG]: LoreTriggerComponent,
                p: ({children}) => <p className={cx('m-0', thought && 'italic')}>{children}</p>,
                em: ({children}) => <em className={thought ? undefined : 'rp-action'}>{children}</em>,
                strong: ({children}) => <strong className="rp-thought">{children}</strong>,
                text: ({value}: any) => <>{processTextContent(value)}</>,
            } as Components}
        >
            {content}
        </ReactMarkdown>
    )
}

function ChatSegments({ segments }: { segments: ChatResponseSegment[] }) {
    const { t } = useTranslation()
    return (
        <div className="flex w-full flex-col gap-3">
            {segments.map((segment, index) => {
                if (segment.kind === 'narrator') {
                    return (
                        <div key={`${segment.kind}-${index}`} className="chat-prose">
                            <ProseMarkdown content={segment.content} />
                        </div>
                    )
                }

                const isThought = segment.kind === 'thought'
                const speakerName = segment.speaker_name || segment.speaker_id || t('interaction.chat.fallbackCharacter')
                return (
                    <div
                        key={`${segment.kind}-${segment.speaker_id || speakerName}-${index}`}
                        className={cx(
                            'w-full rounded-lg border px-3 py-2',
                            isThought
                                ? 'border-arcane-500/25 bg-arcane-500/10 text-arcane-100'
                                : 'border-parchment-50/10 bg-ink-700/70 text-parchment-100',
                        )}
                    >
                        <div className="mb-1.5 flex items-center gap-2">
                            <Avatar
                                name={speakerName}
                                src={segment.image_url ?? undefined}
                                size={24}
                                ring={isThought ? 'arcane' : 'none'}
                                status={isThought ? 'think' : segment.streaming ? 'live' : 'none'}
                            />
                            <Eyebrow tone={isThought ? 'arcane' : 'ember'} className="text-[10px] tracking-[0.12em]">
                                {isThought ? t('interaction.chat.speakerThinks', { name: speakerName }) : speakerName}
                            </Eyebrow>
                        </div>
                        <div className="font-narrative text-[15px] leading-relaxed">
                            <SegmentMarkdown content={segment.content} thought={isThought} />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function StreamingDots() {
    return (
        <span className="ml-2 inline-flex items-center gap-1 align-middle">
            <span className="h-1.5 w-1.5 rounded-full bg-arcane-400 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-arcane-400 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-arcane-400 animate-pulse" style={{ animationDelay: '300ms' }} />
        </span>
    )
}

/** Live "who is writing / speaking / thinking" line for the open streaming segment. */
function streamingStatusLabel(
    t: TFunction,
    segment: ChatResponseSegment | undefined,
    narratorIdentity?: ChatNarratorIdentity | null,
    aiLabel?: string,
): string {
    if (!segment) return aiLabel ? t('interaction.chat.responding', { name: aiLabel }) : t('interaction.chat.respondingGeneric')
    if (segment.kind === 'narrator') {
        if (narratorIdentity?.kind === 'scene' || !narratorIdentity?.name) return t('interaction.chat.settingScene')
        return t('interaction.chat.writing', { name: narratorIdentity.name || aiLabel || t('interaction.chat.fallbackNarrator') })
    }
    const name = segment.speaker_name || segment.speaker_id || t('interaction.chat.fallbackSomeone')
    return segment.kind === 'thought' ? t('interaction.chat.thinking', { name }) : t('interaction.chat.speaking', { name })
}

function StreamingStatus({ label }: { label: string }) {
    return (
        <div className="mt-1.5 inline-flex items-center font-mono text-[11px] tracking-[0.08em] text-parchment-500">
            <span>{label}</span>
            <StreamingDots />
        </div>
    )
}

// Memoized: the turn list re-renders on every composer keystroke, but a turn's
// markdown/segments only change when the turn itself does. Props all derive from
// the stable `turn` object, so shallow compare skips the expensive react-markdown
// re-parse for every message on each keystroke.
export const ChatMessage = memo(function ChatMessage({ content, isUser, isStreaming, segments, narratorIdentity, aiLabel, loreMatcher }: ChatMessageProps) {
    const { t } = useTranslation()
    if (isUser) {
        // Player turn — ember candlelit bubble (plain text + inline lore marks)
        return (
            <div className="inline-block rounded-2xl rounded-br-[4px] border border-ember-500/30 bg-ember-500/[.14] px-4 py-3 font-ui text-[15px] leading-relaxed text-parchment-50 whitespace-pre-wrap">
                {renderWithTriggers(content, loreMatcher ?? null)}
            </div>
        )
    }

    const hasSegments = Boolean(segments?.length)
    const openSegment = isStreaming ? segments?.find((segment) => segment.streaming) : undefined

    // Game Master turn — literary narrative prose. The matcher rides a context so the
    // nested markdown renderers can wire up rehypeLoreTriggers without prop-drilling.
    return (
        <LoreTriggerContext.Provider value={loreMatcher ?? null}>
        <div className={hasSegments ? 'w-full' : 'chat-prose'}>
            {hasSegments ? <ChatSegments segments={segments!} /> : <ProseMarkdown content={content} />}
            {/* With segments, paint the live "{who} is …" status; otherwise the plain dots. */}
            {isStreaming &&
                (hasSegments ? (
                    <StreamingStatus label={streamingStatusLabel(t, openSegment, narratorIdentity, aiLabel)} />
                ) : (
                    <StreamingDots />
                ))}
        </div>
        </LoreTriggerContext.Provider>
    )
})
