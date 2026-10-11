import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, X } from 'lucide-react'
import { useNavigation } from '@/app/hooks'
import { Button, IconButton } from '@/ui/primitives'
import type { AssistantDocumentKind, AssistantTargetOf } from '@/shared/types/assistant.types'
import { LlmFeatureControl } from '@/features/llmProfiles/LlmFeatureControl'
import { AssistantBanner } from './AssistantBanner'
import { AssistantComposer } from './AssistantComposer'
import { AssistantHeader } from './AssistantHeader'
import { AssistantMessageList } from './AssistantMessageList'
import { AssistantShell } from './AssistantShell'
import { ConversationMenu } from './ConversationMenu'
import { takeAssistantConversation } from './assistantHandoff'
import { conversationKey, type AssistantAdapter, type AssistantBindings } from './assistantModel'
import { ASSISTANT_SUGGESTIONS, LOREBOOK_ASSISTANT_SUGGESTIONS, type AssistantSuggestion } from './suggestions'
import { useAssistant } from './useAssistant'

export interface AssistantChatbotProps<K extends AssistantDocumentKind, T extends AssistantTargetOf<K> = AssistantTargetOf<K>> {
    adapter: AssistantAdapter<K>
    binding: AssistantBindings[K]
    /** Applies a target the assistant saved, or a staged snapshot the reader chose to apply. */
    onTarget: (target: T) => void
    isAuthenticated: boolean
    onAuthRequired: () => void
    timeoutMs?: number
}

interface ChatbotConfig<K extends AssistantDocumentKind> {
    copy: {
        fabLabel: string
        dialogLabel: string
        title: string
        close: string
        snapshotLabel: string
        emptyTitle: string
        emptyDescription: string
        composerPlaceholder: string
    }
    suggestions: (binding: AssistantBindings[K]) => AssistantSuggestion[]
}

const CHATBOT_CONFIG: { [K in AssistantDocumentKind]: ChatbotConfig<K> } = {
    card: {
        copy: {
            fabLabel: 'creation.common.assistant.fabLabel',
            dialogLabel: 'creation.common.assistant.dialogLabel',
            title: 'creation.common.assistant.title',
            close: 'creation.common.assistant.close',
            snapshotLabel: 'creation.common.assistant.snapshotFallback',
            emptyTitle: 'creation.common.assistant.emptyTitle',
            emptyDescription: 'creation.common.assistant.emptyDescription',
            composerPlaceholder: 'creation.common.assistant.composerPlaceholder',
        },
        suggestions: (binding) => ASSISTANT_SUGGESTIONS[binding.cardType],
    },
    lorebook: {
        copy: {
            fabLabel: 'lorebookStudio.assistant.fabLabel',
            dialogLabel: 'lorebookStudio.assistant.dialogLabel',
            title: 'lorebookStudio.assistant.title',
            close: 'lorebookStudio.assistant.close',
            snapshotLabel: 'lorebookStudio.assistant.snapshotLabel',
            emptyTitle: 'lorebookStudio.assistant.emptyTitle',
            emptyDescription: 'lorebookStudio.assistant.emptyDescription',
            composerPlaceholder: 'lorebookStudio.assistant.composerPlaceholder',
        },
        suggestions: () => LOREBOOK_ASSISTANT_SUGGESTIONS,
    },
}

/** Offers a switched-to conversation's saved snapshot for explicit application. */
export function AssistantPendingTargetBanner({
    snapshotLabel,
    onApply,
    onDismiss,
}: {
    snapshotLabel?: string
    onApply: () => void
    onDismiss: () => void
}) {
    const { t } = useTranslation()
    const label = snapshotLabel ?? t('creation.common.assistant.snapshotFallback')
    return (
        <div className="flex items-center gap-2 border-b border-parchment-50/[.08] bg-arcane-500/10 px-3.5 py-2">
            <Layers size={14} className="shrink-0 text-arcane-300" />
            <p className="min-w-0 flex-1 font-ui text-[12px] leading-snug text-parchment-200">
                {t('creation.common.assistant.pendingSnapshot', { label })}
            </p>
            <Button variant="secondary" size="sm" className="px-2.5 py-1.5" onClick={onApply}>
                {t('creation.common.assistant.applyToForm')}
            </Button>
            <IconButton label={t('creation.common.assistant.dismissSnapshot', { label })} size="sm" className="h-7 w-7" onClick={onDismiss}>
                <X size={14} />
            </IconButton>
        </div>
    )
}

/**
 * Floating AI copilot for the card creators and the lorebook studio. The hook
 * owns all conversation and streaming state; this component is purely layout.
 */
export function AssistantChatbot<K extends AssistantDocumentKind, T extends AssistantTargetOf<K> = AssistantTargetOf<K>>(
    props: AssistantChatbotProps<K, T>,
) {
    const { t } = useTranslation()
    const { currentHash, replaceHash } = useNavigation()
    // A conversation handed over from the assistant page opens the panel on it, once.
    const [handoff] = useState(() => takeAssistantConversation(currentHash))
    useEffect(() => {
        if (handoff) replaceHash(handoff.hash)
    }, [handoff, replaceHash])
    const assistant = useAssistant<K, T>({ ...props, initialConversationId: handoff?.conversationId ?? null })
    const { kind } = props.adapter
    const config: ChatbotConfig<K> = CHATBOT_CONFIG[kind]
    const { copy } = config
    const streaming = assistant.status === 'streaming'
    const busy = assistant.status !== 'idle'

    return (
        <AssistantShell
            open={assistant.open}
            onOpen={assistant.openPanel}
            fabLabel={t(copy.fabLabel)}
            dialogLabel={t(copy.dialogLabel)}
        >
            <AssistantHeader
                title={t(copy.title)}
                cardTitle={props.binding.title}
                streaming={streaming}
                onClose={assistant.closePanel}
                closeLabel={t(copy.close)}
                onNewChat={assistant.newConversation}
                newChatDisabled={busy}
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

            <div className="p-3"><LlmFeatureControl feature={`${kind}_assistant`} disabled={busy} /></div>
            {assistant.pendingTarget && (
                <AssistantPendingTargetBanner
                    snapshotLabel={t(copy.snapshotLabel)}
                    onApply={assistant.applyPendingTarget}
                    onDismiss={assistant.dismissPendingTarget}
                />
            )}

            <AssistantMessageList
                turns={assistant.turns}
                status={assistant.status}
                suggestions={assistant.unavailable ? [] : config.suggestions(props.binding)}
                onSuggestion={(prompt) => void assistant.send(prompt)}
                conversationKey={conversationKey(assistant.activeConversation)}
                emptyTitle={t(copy.emptyTitle)}
                emptyDescription={t(copy.emptyDescription)}
            />

            {assistant.unavailable && (
                <AssistantBanner notice={{ kind: 'info', message: t('creation.common.assistant.notices.unavailable') }} />
            )}
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
                disabled={assistant.status === 'switching' || assistant.unavailable}
                placeholder={t(copy.composerPlaceholder)}
                onSend={(text) => void assistant.send(text)}
                onStop={assistant.stop}
            />
        </AssistantShell>
    )
}
