import type { Lorebook } from '@/shared/types/lorebook.types'
import { AssistantBanner } from '@/features/creation/common/components/assistant/AssistantBanner'
import { AssistantComposer } from '@/features/creation/common/components/assistant/AssistantComposer'
import { AssistantHeader } from '@/features/creation/common/components/assistant/AssistantHeader'
import { AssistantMessageList } from '@/features/creation/common/components/assistant/AssistantMessageList'
import { AssistantPendingCardBanner } from '@/features/creation/common/components/assistant/CardAssistantChatbot'
import { AssistantShell } from '@/features/creation/common/components/assistant/AssistantShell'
import { ConversationMenu } from '@/features/creation/common/components/assistant/ConversationMenu'
import { LOREBOOK_ASSISTANT_SUGGESTIONS } from '@/features/creation/common/components/assistant/suggestions'
import { conversationKey } from '@/features/creation/common/components/assistant/useCardAssistant'
import { useLorebookAssistant } from '../hooks/useLorebookAssistant'

interface LorebookAssistantChatbotProps {
    lorebookId?: string | null
    title: string
    currentLorebook: Record<string, unknown>
    onLorebook: (lorebook: Lorebook) => void
    isAuthenticated: boolean
    onAuthRequired: () => void
    timeoutMs?: number
}

export function LorebookAssistantChatbot(props: LorebookAssistantChatbotProps) {
    const assistant = useLorebookAssistant(props)
    const streaming = assistant.status === 'streaming'
    const busy = assistant.status !== 'idle'

    return (
        <AssistantShell
            open={assistant.open}
            onOpen={assistant.openPanel}
            fabLabel="Open lorebook assistant"
            dialogLabel="Lorebook assistant"
        >
            <AssistantHeader
                title="Lorebook Assistant"
                cardTitle={props.title}
                streaming={streaming}
                onClose={assistant.closePanel}
                closeLabel="Close lorebook assistant"
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

            {assistant.pendingLorebook && (
                <AssistantPendingCardBanner
                    snapshotLabel="lorebook"
                    onApply={assistant.applyPendingLorebook}
                    onDismiss={assistant.dismissPendingLorebook}
                />
            )}

            <AssistantMessageList
                turns={assistant.turns}
                status={assistant.status}
                suggestions={LOREBOOK_ASSISTANT_SUGGESTIONS}
                onSuggestion={(prompt) => void assistant.send(prompt)}
                conversationKey={conversationKey(assistant.activeConversation)}
                emptyTitle="Shape this lorebook with words"
                emptyDescription="Describe the context you need and the assistant will draft, organize, and save entries for you."
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
                placeholder="Ask for a lorebook change..."
                onSend={(text) => void assistant.send(text)}
                onStop={assistant.stop}
            />
        </AssistantShell>
    )
}
