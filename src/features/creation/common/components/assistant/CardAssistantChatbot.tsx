import { Layers, MessageCircle, X } from 'lucide-react'
import { Button, IconButton } from '@/ui/primitives'
import type { CardAssistantCardResponse, CardAssistantCardType } from '@/shared/types/aiCard.types'
import { AssistantBanner } from './AssistantBanner'
import { AssistantComposer } from './AssistantComposer'
import { AssistantHeader } from './AssistantHeader'
import { AssistantMessageList } from './AssistantMessageList'
import { ConversationMenu } from './ConversationMenu'
import { ASSISTANT_SUGGESTIONS } from './suggestions'
import { conversationKey, useCardAssistant } from './useCardAssistant'

export interface CardAssistantChatbotProps<TCard extends CardAssistantCardResponse = CardAssistantCardResponse> {
    cardType: CardAssistantCardType
    cardId?: string | null
    title: string
    currentCard: Record<string, unknown>
    onCard: (card: TCard) => void
    isAuthenticated: boolean
    onAuthRequired: () => void
    timeoutMs?: number
}

/** Offers a switched-to conversation's card snapshot for explicit application. */
export function AssistantPendingCardBanner({ onApply, onDismiss }: { onApply: () => void; onDismiss: () => void }) {
    return (
        <div className="flex items-center gap-2 border-b border-parchment-50/[.08] bg-arcane-500/10 px-3.5 py-2">
            <Layers size={14} className="shrink-0 text-arcane-300" />
            <p className="min-w-0 flex-1 font-ui text-[12px] leading-snug text-parchment-200">
                This conversation has a saved card snapshot.
            </p>
            <Button kind="secondary" size="sm" className="px-2.5 py-1.5" onClick={onApply}>
                Apply to form
            </Button>
            <IconButton label="Dismiss snapshot" size="sm" className="h-7 w-7" onClick={onDismiss}>
                <X size={14} />
            </IconButton>
        </div>
    )
}

/**
 * Floating AI copilot for the card creators. The hook owns all conversation
 * and streaming state; this component is purely layout.
 */
export function CardAssistantChatbot<TCard extends CardAssistantCardResponse = CardAssistantCardResponse>(
    props: CardAssistantChatbotProps<TCard>,
) {
    const assistant = useCardAssistant<TCard>(props)
    const streaming = assistant.status === 'streaming'
    const busy = assistant.status !== 'idle'

    if (!assistant.open) {
        return (
            <button
                type="button"
                onClick={assistant.openPanel}
                title="Card assistant"
                aria-label="Open card assistant"
                className="fixed bottom-5 right-5 z-50 grid h-14 w-14 cursor-pointer place-items-center rounded-full bg-ember-500 text-on-ember shadow-lg transition-all hover:bg-ember-400 hover:shadow-glow-ember active:scale-[.98]"
            >
                <MessageCircle size={24} />
            </button>
        )
    }

    return (
        <section
            role="dialog"
            aria-label="Card assistant"
            className="fixed bottom-5 right-5 z-50 flex h-[min(640px,calc(100vh-2.5rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800 shadow-xl"
        >
            <AssistantHeader
                cardTitle={props.title}
                streaming={streaming}
                onClose={assistant.closePanel}
                menu={(
                    <ConversationMenu
                        conversations={assistant.conversations}
                        activeId={conversationKey(assistant.activeConversation)}
                        disabled={busy}
                        onSelect={(id) => void assistant.selectConversation(id)}
                        onNew={assistant.newConversation}
                        onDelete={(id) => void assistant.deleteConversation(id)}
                    />
                )}
            />

            {assistant.pendingCard && (
                <AssistantPendingCardBanner onApply={assistant.applyPendingCard} onDismiss={assistant.dismissPendingCard} />
            )}

            <AssistantMessageList
                turns={assistant.turns}
                status={assistant.status}
                suggestions={ASSISTANT_SUGGESTIONS[props.cardType]}
                onSuggestion={(prompt) => void assistant.send(prompt)}
                conversationKey={conversationKey(assistant.activeConversation)}
            />

            {assistant.notice && (
                <AssistantBanner
                    notice={assistant.notice}
                    onRetry={assistant.retry}
                    onReload={() => void assistant.reloadConversation()}
                    onDismiss={assistant.clearNotice}
                />
            )}

            <AssistantComposer
                streaming={streaming}
                disabled={assistant.status === 'switching'}
                onSend={(text) => void assistant.send(text)}
                onStop={assistant.stop}
            />
        </section>
    )
}
