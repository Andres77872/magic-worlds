import type { TFunction } from 'i18next'
import type { CardAssistantAppliedAction } from '@/shared/types/aiCard.types'

/** Human-readable summary of one card mutation the assistant performed. */
export interface AppliedChangeSummary {
    kind: 'replace' | 'patch'
    subject?: 'lorebook'
    cardId?: string
    lorebookId?: string
    fields: string[]
}

export interface AssistantChatMessage {
    message_id: number
    conversation_id: number
    sequence_no: number
    sequence?: number
    role: 'system' | 'user' | 'assistant' | 'tool'
    status: 'pending' | 'completed' | 'failed'
    content: string
    created_at?: string
    tool_calls?: unknown
    tool_call_id?: string | null
    tool_name?: string | null
    metadata?: Record<string, unknown>
}

/** A visible chat turn (user or assistant) with its changes attached. */
export interface AssistantTurnBase<TMessage extends AssistantChatMessage = AssistantChatMessage> {
    message: TMessage
    appliedChanges: AppliedChangeSummary[]
}

export function humanizeField(field: string): string {
    return field.replace(/_/g, ' ')
}

/** Parse the `applied_actions` payload from a `final` stream event or tool message. */
export function parseAppliedActions(actions: unknown): AppliedChangeSummary[] {
    if (!Array.isArray(actions)) return []
    const summaries: AppliedChangeSummary[] = []
    for (const raw of actions) {
        if (!raw || typeof raw !== 'object') continue
        const action = raw as CardAssistantAppliedAction
        const cardId = typeof action.card_id === 'string' ? action.card_id : undefined
        if (action.type === 'replace_card') {
            summaries.push({ kind: 'replace', cardId, fields: [] })
        } else if (action.type === 'patch_card') {
            const fields = Array.isArray(action.fields)
                ? action.fields.filter((field): field is string => typeof field === 'string').map(humanizeField)
                : []
            summaries.push({ kind: 'patch', cardId, fields })
        } else if (action.type === 'replace_lorebook') {
            const lorebookId = typeof (action as { lorebook_id?: unknown }).lorebook_id === 'string'
                ? (action as { lorebook_id: string }).lorebook_id
                : undefined
            summaries.push({ kind: 'replace', subject: 'lorebook', lorebookId, fields: [] })
        } else if (action.type === 'patch_lorebook') {
            const lorebookId = typeof (action as { lorebook_id?: unknown }).lorebook_id === 'string'
                ? (action as { lorebook_id: string }).lorebook_id
                : undefined
            const fields = Array.isArray(action.fields)
                ? action.fields.filter((field): field is string => typeof field === 'string').map(humanizeField)
                : []
            summaries.push({ kind: 'patch', subject: 'lorebook', lorebookId, fields })
        }
        // mw_no_card_change and unknown action types carry no card mutation.
    }
    return summaries
}

/** Persisted tool messages carry `{applied_actions, card_id}` as JSON content. */
export function parseToolMessageActions(message: AssistantChatMessage): AppliedChangeSummary[] {
    if (message.role !== 'tool' || !message.content) return []
    try {
        const parsed = JSON.parse(message.content) as { applied_actions?: unknown } | null
        return parseAppliedActions(parsed?.applied_actions)
    } catch {
        return []
    }
}

/**
 * Reduce a raw message history (all roles) to visible user/assistant turns,
 * attaching each tool message's changes to the nearest preceding assistant
 * message. Live actions (from the `final` stream event) win over the
 * tool-message reconstruction for the same assistant message.
 */
export function attachAppliedChanges<TMessage extends AssistantChatMessage>(
    messages: TMessage[],
    liveActions?: Map<number, AppliedChangeSummary[]>,
): AssistantTurnBase<TMessage>[] {
    const turns: AssistantTurnBase<TMessage>[] = []
    let lastAssistant: AssistantTurnBase<TMessage> | null = null
    for (const message of messages) {
        if (message.role === 'user') {
            turns.push({ message, appliedChanges: [] })
            lastAssistant = null
            continue
        }
        if (message.role === 'assistant') {
            const live = liveActions?.get(message.message_id)
            const turn: AssistantTurnBase<TMessage> = { message, appliedChanges: live ? [...live] : [] }
            turns.push(turn)
            lastAssistant = turn
            continue
        }
        if (message.role === 'tool' && lastAssistant) {
            if (!liveActions?.has(lastAssistant.message.message_id)) {
                lastAssistant.appliedChanges.push(...parseToolMessageActions(message))
            }
        }
    }
    return turns
}

/** Chip copy for one applied change; `title` carries the untruncated field list. */
export function formatAppliedChange(change: AppliedChangeSummary, t: TFunction): { label: string; title?: string } {
    const subject = change.subject === 'lorebook'
        ? t('creation.common.assistant.applied.lorebook')
        : t('creation.common.assistant.applied.card')
    if (change.kind === 'replace') return { label: t('creation.common.assistant.applied.saved', { subject }) }
    if (!change.fields.length) return { label: t('creation.common.assistant.applied.updated', { subject }) }
    const shown = change.fields.slice(0, 4)
    const extra = change.fields.length - shown.length
    const fields = shown.join(', ')
    return {
        label: extra > 0
            ? t('creation.common.assistant.applied.updatedFieldsMore', { fields, count: extra })
            : t('creation.common.assistant.applied.updatedFields', { fields }),
        title: t('creation.common.assistant.applied.updatedFieldsTitle', { fields: change.fields.join(', ') }),
    }
}
