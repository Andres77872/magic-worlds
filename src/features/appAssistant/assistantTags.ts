/**
 * Which assistant a conversation belongs to, as the assistant page tags and
 * filters its history: the guide (`app`), one card type, or the lorebook studio.
 */
import type { LucideIcon } from 'lucide-react'
import { BookOpen, Compass, Gem, Globe, Swords, Users } from 'lucide-react'
import { conversationTargetId } from '@/features/creation/common/components/assistant/assistantModel'
import type { AssistantCardType, AssistantConversation } from '@/shared/types/assistant.types'

export type AssistantTag = 'app' | AssistantCardType | 'lorebook'

/** Filter order on the page: the guide first, then the editors. */
export const ASSISTANT_TAGS: readonly AssistantTag[] = ['app', 'character', 'world', 'item', 'adventure_template', 'lorebook']

export const ASSISTANT_TAG_ICONS: Record<AssistantTag, LucideIcon> = {
    app: Compass,
    character: Users,
    world: Globe,
    item: Gem,
    adventure_template: Swords,
    lorebook: BookOpen,
}

export function assistantTag(conversation: AssistantConversation): AssistantTag {
    if (conversation.kind !== 'card') return conversation.kind
    // The server always sets card_type on card conversations.
    return conversation.card_type ?? 'character'
}

/** The live name of the card or lorebook a conversation edits, else the conversation's own title. */
export function conversationLabel(conversation: AssistantConversation, targetNames: ReadonlyMap<string, string>): string | null {
    const targetId = conversationTargetId(conversation)
    return (targetId && targetNames.get(targetId)?.trim()) || conversation.title?.trim() || null
}
