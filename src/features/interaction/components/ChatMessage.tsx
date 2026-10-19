import { createContext, Fragment, memo, useContext, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamingMarkdown } from '../utils/roleplayMarkdown'
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
    /**
     * The only AI speaker of a 1:1 chat. The turn header already names them, so
     * their speech segments skip the repeated avatar + name.
     */
    soloSpeakerId?: string
}

// Roleplay writers wrap actions in single tildes (`~se ríe~`) and end lines with
// a playful `hola~`. GFM reads `~text~` as strikethrough, which crossed out
// every action; a single-tilde span is an action, `~~text~~` stays a deletion.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TildeSpan({ source, node, children }: { source: string; node?: any; children?: ReactNode }) {
    const offset = node?.position?.start?.offset
    const single = typeof offset === 'number' && source[offset] === '~' && source[offset + 1] !== '~'
    return single ? <em className="rp-action">{children}</em> : <del>{children}</del>
}

const RoleplayRenderContext = createContext({ content: '', narrator: false, thought: false })

// Stable component types keep active paragraphs mounted as their text grows.
const markdownComponents = {
    [LORE_TRIGGER_TAG]: LoreTriggerComponent,
    p: function Paragraph({ children }: { children?: ReactNode }) {
        const { narrator, thought } = useContext(RoleplayRenderContext)
        return <p className={cx('markdown-paragraph', !narrator && 'm-0 mb-3 last:mb-0', thought && 'italic')}>{children}</p>
    },
    h2: ({ children }) => <h2 className="markdown-h2">{children}</h2>,
    h3: ({ children }) => <h3 className="markdown-h3">{children}</h3>,
    ul: ({ children }) => <ul className="markdown-list">{children}</ul>,
    ol: ({ children }) => <ol className="markdown-list markdown-list-ordered">{children}</ol>,
    li: ({ children }) => <li className="markdown-list-item">{children}</li>,
    blockquote: ({ children }) => <blockquote className="markdown-blockquote">{children}</blockquote>,
    code: ({ children }) => <code className="markdown-code-inline">{children}</code>,
    pre: ({ children }) => <span className="whitespace-pre-wrap">{children}</span>,
    em: function Emphasis({ children }: { children?: ReactNode }) {
        const { thought } = useContext(RoleplayRenderContext)
        return <em className={thought ? undefined : 'rp-action'}>{children}</em>
    },
    del: function Deletion({ node, children }) {
        const { content } = useContext(RoleplayRenderContext)
        return <TildeSpan source={content} node={node}>{children}</TildeSpan>
    },
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    // Owned media and lore are separate components. Model Markdown cannot load/navigate.
    a: ({ children }) => <>{children}</>,
    img: ({ alt }) => <>{alt}</>,
} satisfies Components & Record<typeof LORE_TRIGGER_TAG, typeof LoreTriggerComponent>

const RoleplayMarkdown = memo(function RoleplayMarkdown({ content, narrator = false, thought = false, isStreaming = false }: {
    content: string; narrator?: boolean; thought?: boolean; isStreaming?: boolean
}) {
    const matcher = useContext(LoreTriggerContext)
    return (
        <RoleplayRenderContext.Provider value={{ content, narrator, thought }}>
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={matcher ? [[rehypeLoreTriggers, { matcher }]] : undefined}
            allowedElements={[
                'p', 'em', 'strong', 'del', 'br', 'a', 'img', LORE_TRIGGER_TAG,
                ...(narrator ? ['h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'] : []),
            ]}
            unwrapDisallowed
            components={markdownComponents}
        >
            {isStreaming ? streamingMarkdown(content) : content}
        </ReactMarkdown>
        </RoleplayRenderContext.Provider>
    )
})

const ChatSegment = memo(function ChatSegment({ segment, soloSpeakerId, continuesSpeaker = false }: {
    segment: ChatResponseSegment; soloSpeakerId?: string; continuesSpeaker?: boolean
}) {
    const { t } = useTranslation()
    if (segment.kind === 'narrator') {
        return <div className="chat-prose roleplay-prose roleplay-narration"><RoleplayMarkdown content={segment.content} narrator isStreaming={segment.streaming} /></div>
    }
    const isThought = segment.kind === 'thought'
    const speakerName = segment.speaker_name || segment.speaker_id || t('interaction.chat.fallbackCharacter')
    const showSpeaker = !continuesSpeaker && (isThought || !soloSpeakerId || segment.speaker_id !== soloSpeakerId)
    return (
        <div className="w-full min-w-0">
            {showSpeaker && <div className="mb-1.5 flex items-center gap-2">
                <Avatar name={speakerName} src={segment.image_url ?? undefined} size={24}
                    ring={isThought ? 'arcane' : 'none'} status={segment.streaming ? (isThought ? 'think' : 'live') : 'none'} />
                <Eyebrow tone={isThought ? 'arcane' : 'muted'} className="text-caption">
                    {isThought ? t('interaction.chat.speakerThinks', { name: speakerName }) : speakerName}
                </Eyebrow>
            </div>}
            <div className={cx('chat-segment break-words', isThought ? 'roleplay-thought' : 'roleplay-speech')}>
                <RoleplayMarkdown content={segment.content} thought={isThought} isStreaming={segment.streaming} />
            </div>
        </div>
    )
})

function ChatSegments({ segments, soloSpeakerId }: { segments: ChatResponseSegment[]; soloSpeakerId?: string }) {
    return <div className="flex w-full flex-col gap-3">
        {segments.map((segment, index) => {
            const previous = segments[index - 1]
            const continuesSpeaker = segment.kind !== 'narrator'
                && Boolean(segment.speaker_id)
                && previous?.kind === segment.kind
                && previous.speaker_id === segment.speaker_id
            return <ChatSegment key={`${index}-${segment.kind}-${segment.speaker_id ?? ''}`}
                segment={segment} soloSpeakerId={soloSpeakerId} continuesSpeaker={continuesSpeaker} />
        })}
    </div>
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
        <div className="mt-2 inline-flex items-center font-mono text-caption text-parchment-400">
            <span>{label}</span>
            <StreamingDots />
        </div>
    )
}

// Memoized: the turn list re-renders on every composer keystroke, but a turn's
// markdown/segments only change when the turn itself does. Props all derive from
// the stable `turn` object, so shallow compare skips the expensive react-markdown
// re-parse for every message on each keystroke.
export const ChatMessage = memo(function ChatMessage({ content, isUser, isStreaming, segments, narratorIdentity, aiLabel, loreMatcher, soloSpeakerId }: ChatMessageProps) {
    const { t } = useTranslation()
    if (isUser) {
        // Player voice stays distinct with a light ember wash, without a second outline.
        return (
            <div className="inline-block rounded-lg bg-ember-500/10 px-4 py-3 font-ui text-body text-parchment-50 whitespace-pre-wrap break-words">
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
        <div className={cx('roleplay-message font-narrative text-roleplay', hasSegments ? 'w-full' : 'chat-prose roleplay-prose')}>
            {hasSegments ? <ChatSegments segments={segments!} soloSpeakerId={soloSpeakerId} /> : <RoleplayMarkdown content={content} narrator isStreaming={isStreaming} />}
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
