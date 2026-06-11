import type { CardAssistantAppliedAction, CardAssistantMessage } from '@/shared/types/aiCard.types'

/** Human-readable summary of one card mutation the assistant performed. */
export interface AppliedChangeSummary {
    kind: 'replace' | 'patch'
    cardId?: string
    fields: string[]
}

/** A visible chat turn (user or assistant) with its card changes attached. */
export interface AssistantTurnBase {
    message: CardAssistantMessage
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
        }
        // mw_no_card_change and unknown action types carry no card mutation.
    }
    return summaries
}

/** Persisted tool messages carry `{applied_actions, card_id}` as JSON content. */
export function parseToolMessageActions(message: CardAssistantMessage): AppliedChangeSummary[] {
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
export function attachAppliedChanges(
    messages: CardAssistantMessage[],
    liveActions?: Map<number, AppliedChangeSummary[]>,
): AssistantTurnBase[] {
    const turns: AssistantTurnBase[] = []
    let lastAssistant: AssistantTurnBase | null = null
    for (const message of messages) {
        if (message.role === 'user') {
            turns.push({ message, appliedChanges: [] })
            lastAssistant = null
            continue
        }
        if (message.role === 'assistant') {
            const live = liveActions?.get(message.message_id)
            const turn: AssistantTurnBase = { message, appliedChanges: live ? [...live] : [] }
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
export function formatAppliedChange(change: AppliedChangeSummary): { label: string; title?: string } {
    if (change.kind === 'replace') return { label: 'Card saved' }
    if (!change.fields.length) return { label: 'Card updated' }
    const shown = change.fields.slice(0, 4)
    const extra = change.fields.length - shown.length
    return {
        label: `Updated: ${shown.join(', ')}${extra > 0 ? ` +${extra} more` : ''}`,
        title: `Updated fields: ${change.fields.join(', ')}`,
    }
}
