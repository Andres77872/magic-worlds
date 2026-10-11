import type { TFunction } from 'i18next'
import type { AssistantAppliedAction, AssistantChatMessage } from '@/shared/types/assistant.types'

/** Human-readable summary of one card or lorebook mutation the assistant performed. */
export interface AppliedChangeSummary {
    kind: 'replace' | 'patch'
    subject?: 'lorebook'
    targetId?: string
    fields: string[]
}

/** A visible chat turn (user or assistant) with its changes attached. */
export interface AssistantTurnBase {
    message: AssistantChatMessage
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
        const action = raw as AssistantAppliedAction
        const targetId = typeof action.target_id === 'string' ? action.target_id : undefined
        const fields = Array.isArray(action.fields)
            ? action.fields.filter((field): field is string => typeof field === 'string').map(humanizeField)
            : []
        if (action.type === 'replace_card') {
            summaries.push({ kind: 'replace', targetId, fields: [] })
        } else if (action.type === 'patch_card') {
            summaries.push({ kind: 'patch', targetId, fields })
        } else if (action.type === 'replace_lorebook') {
            summaries.push({ kind: 'replace', subject: 'lorebook', targetId, fields: [] })
        } else if (action.type === 'patch_lorebook') {
            summaries.push({ kind: 'patch', subject: 'lorebook', targetId, fields })
        }
        // mw_no_card_change and unknown action types carry no mutation.
    }
    return summaries
}

/** Persisted tool messages carry `{applied_actions, target_id}` as JSON content. */
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
export function attachAppliedChanges(
    messages: AssistantChatMessage[],
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
