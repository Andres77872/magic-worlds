import type { NovelAssistantControl, NovelAssistantTerminalState, NovelAssistantTurnState, NovelAssistantCompletedSummary } from '@/shared/types/novelAssistantControl.types'
import { verifyAssistantTurn } from './assistantContract'
import { isRecord } from '@/shared/novelMutationJournal'

const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(key => key in v)
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const requestId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(v)

export function isNovelAssistantControl(v: unknown): v is NovelAssistantControl {
    if (!isRecord(v) || !exact(v, ['stop_requested', 'executor_stopped', 'settlement', 'usage', 'usage_complete'])
        || typeof v.stop_requested !== 'boolean' || typeof v.executor_stopped !== 'boolean' || typeof v.usage_complete !== 'boolean'
        || typeof v.settlement !== 'string' || !['not_used', 'used', 'pending'].includes(v.settlement)) return false
    const usage = v.usage
    if (usage !== null && (!isRecord(usage) || !exact(usage, ['prompt_tokens', 'completion_tokens', 'total_tokens'])
        || !count(usage.prompt_tokens) || !count(usage.completion_tokens) || !count(usage.total_tokens)
        || usage.prompt_tokens + usage.completion_tokens !== usage.total_tokens)) return false
    if (!v.executor_stopped && (v.settlement !== 'pending' || usage !== null || v.usage_complete)) return false
    if (v.settlement === 'not_used' && (!v.executor_stopped || !v.usage_complete || usage !== null && usage.total_tokens !== 0)) return false
    if (v.settlement === 'pending' && v.usage_complete || v.settlement === 'used' && v.usage_complete && usage === null) return false
    return true
}

export function isNovelAssistantTerminal(v: unknown): v is NovelAssistantTerminalState {
    if (!isRecord(v) || !exact(v, ['status', 'request_id', 'recovery_required', 'control', ...('execution_id' in v ? ['execution_id'] : [])])
        || typeof v.status !== 'string' || !['failed', 'cancelled'].includes(v.status) || !requestId(v.request_id) || v.recovery_required !== false
        || !isNovelAssistantControl(v.control)) return false
    if ('execution_id' in v) return uuid(v.execution_id)
    return v.status === 'cancelled' && v.control.stop_requested && v.control.executor_stopped
        && v.control.settlement === 'not_used' && v.control.usage === null && v.control.usage_complete
}

export function isNovelAssistantCompletedSummary(v: unknown): v is NovelAssistantCompletedSummary {
    return isRecord(v) && exact(v, ['status', 'request_id', 'execution_id']) && v.status === 'completed'
        && requestId(v.request_id) && uuid(v.execution_id)
}

export function verifyNovelAssistantTurnState(v: unknown, storyId: string, conversationId: number, originalRequestId: string): v is NovelAssistantTurnState {
    if (!isRecord(v) || v.request_id !== originalRequestId || !requestId(originalRequestId)
        || !Number.isSafeInteger(conversationId) || conversationId < 1) return false
    if (v.status === 'completed') return exact(v, ['status', 'request_id', 'recovery_required', 'turn']) && v.recovery_required === false
        && verifyAssistantTurn(v.turn, 'novel', conversationId, originalRequestId) && v.turn.conversation.story_id === storyId
    if ('control' in v) return isNovelAssistantTerminal(v)
    return exact(v, ['status', 'request_id', 'execution_id', 'recovery_required']) && uuid(v.execution_id)
        && typeof v.recovery_required === 'boolean' && typeof v.status === 'string' && ['admitted', 'running', 'awaiting_credential', 'failed', 'cancelled'].includes(v.status)
}

export function novelAssistantControlSettled(v: NovelAssistantTerminalState): boolean {
    return v.control.executor_stopped && v.control.settlement !== 'pending' && v.control.usage_complete
}
