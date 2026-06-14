import { useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Wand2 } from 'lucide-react'
import { Chip, Eyebrow, IconTile } from '@/ui/primitives'
import { AssistantMessage } from './AssistantMessage'
import { StreamingDots } from './AssistantMarkdown'
import type { AssistantSuggestion } from './suggestions'
import type { VisibleAssistantTurn } from './AssistantMessage'
import type { AssistantStatus } from './useCardAssistant'

interface AssistantMessageListProps {
    turns: VisibleAssistantTurn[]
    status: AssistantStatus
    suggestions: AssistantSuggestion[]
    onSuggestion: (prompt: string) => void
    /** Changes force the list back to the bottom (conversation switch / new chat). */
    conversationKey: number | null
    emptyTitle?: string
    emptyDescription?: string
}

function scrollToBottom(node: HTMLDivElement, behavior: ScrollBehavior = 'auto') {
    if (typeof node.scrollTo === 'function') {
        node.scrollTo({ top: node.scrollHeight, behavior })
    } else {
        node.scrollTop = node.scrollHeight
    }
}

function LoadingSkeleton() {
    return (
        <div className="space-y-3 py-2" aria-hidden>
            <div className="image-shimmer ml-auto h-4 w-1/2 rounded-lg" />
            <div className="image-shimmer h-16 w-3/4 rounded-lg" />
            <div className="image-shimmer ml-auto h-4 w-2/5 rounded-lg" />
        </div>
    )
}

function EmptyState({
    suggestions,
    onSuggestion,
    emptyTitle,
    emptyDescription,
}: Pick<AssistantMessageListProps, 'suggestions' | 'onSuggestion' | 'emptyTitle' | 'emptyDescription'>) {
    const { t } = useTranslation()
    const title = emptyTitle ?? t('creation.common.assistant.emptyTitle')
    const description = emptyDescription ?? t('creation.common.assistant.emptyDescription')
    return (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <IconTile icon={Sparkles} tone="arcane" size="md" />
            <h3 className="font-display text-[20px] font-semibold text-parchment-50">{title}</h3>
            <p className="max-w-[280px] font-narrative text-[14px] leading-relaxed text-parchment-300">
                {description}
            </p>
            <div className="mt-1 flex w-full flex-col items-stretch gap-2">
                {suggestions.map((suggestion) => (
                    <Chip
                        key={suggestion.labelKey}
                        icon={<Wand2 size={13} />}
                        className="justify-start"
                        onClick={() => onSuggestion(suggestion.prompt)}
                    >
                        {t(suggestion.labelKey)}
                    </Chip>
                ))}
            </div>
        </div>
    )
}

export function AssistantMessageList({ turns, status, suggestions, onSuggestion, conversationKey, emptyTitle, emptyDescription }: AssistantMessageListProps) {
    const { t } = useTranslation()
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const atBottomRef = useRef(true)
    // Mask stale turns while switching; on (re)open only skeleton an empty list.
    const showSkeleton = status === 'switching' || (status === 'initializing' && !turns.length)
    const showEmpty = !showSkeleton && !turns.length && status !== 'initializing'
    const thinking = status === 'streaming' && !turns.some((turn) => turn.isStreaming)

    const handleScroll = () => {
        const node = scrollRef.current
        if (!node) return
        atBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48
    }

    // Follow the stream only while the reader is at the bottom; instant scroll
    // avoids smooth-scroll racing rapid delta updates.
    useLayoutEffect(() => {
        const node = scrollRef.current
        if (node && atBottomRef.current) scrollToBottom(node)
    }, [turns, thinking])

    // A different conversation always starts pinned to its latest message.
    useLayoutEffect(() => {
        atBottomRef.current = true
        const node = scrollRef.current
        if (node) scrollToBottom(node)
    }, [conversationKey])

    return (
        <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3.5 py-3">
            {showSkeleton && <LoadingSkeleton />}
            {showEmpty && <EmptyState suggestions={suggestions} onSuggestion={onSuggestion} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />}
            {!showSkeleton && turns.map((turn) => (
                <AssistantMessage key={turn.message.message_id} turn={turn} />
            ))}
            {thinking && (
                <div className="flex items-center gap-2">
                    <Eyebrow tone="arcane" className="text-[10px]">{t('creation.common.assistant.thinking')}</Eyebrow>
                    <StreamingDots />
                </div>
            )}
        </div>
    )
}
