import type { AssistantTurnResponse } from './assistant.types'

export interface NovelAssistantControl {
    stop_requested: boolean
    executor_stopped: boolean
    settlement: 'not_used' | 'used' | 'pending'
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null
    usage_complete: boolean
}
export interface NovelAssistantTerminalState {
    status: 'failed' | 'cancelled'
    request_id: string
    execution_id?: string
    recovery_required: false
    control: NovelAssistantControl
}
export interface NovelAssistantCompletedSummary {
    status: 'completed'
    request_id: string
    execution_id: string
}
export type NovelAssistantTurnState = NovelAssistantTerminalState | {
    status: 'admitted' | 'running' | 'awaiting_credential' | 'failed' | 'cancelled'
    request_id: string
    execution_id: string
    recovery_required: boolean
    control?: never
} | {
    status: 'completed'
    request_id: string
    recovery_required: false
    turn: AssistantTurnResponse<'novel'>
    control?: never
}
