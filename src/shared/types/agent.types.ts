/** Workflows version prompts/topology; profiles own models and execution settings. */
import type { LlmExecutionProvenance, LlmRequest } from './llm.types'

export type AgentOutputMode = 'strict_card_schema' | 'json_object' | 'markdown'

export interface AgentEditable {
    system_message: string
    prompt_template: string
}
export interface AgentEditableEcho extends AgentEditable { json_output: boolean }
export interface AgentCurrentEcho extends AgentEditableEcho {
    version_number: number
    graph_version: string
    output_mode: AgentOutputMode
    schema_model: string | null
}
interface WorkflowSummary {
    workflow_key: string
    display_name: string
    output_mode: AgentOutputMode
    schema_model: string | null
}
export interface BuiltinAgentSummary extends WorkflowSummary {
    kind: 'builtin_card' | 'builtin_story'
    builtin_version: number
    graph_version: string
}
export interface CustomAgentSummary extends WorkflowSummary {
    kind: 'custom'
    row_version: number
    has_draft_changes: boolean
    /** Null while unpublished: a draft-only workflow the profile cutover kept without a current. */
    current_version_number: number | null
    latest_version_number: number
    updated_at: string | null
}
export type AgentSummary = BuiltinAgentSummary | CustomAgentSummary
export interface BuiltinAgentDetail extends BuiltinAgentSummary {
    graph_version_prefix: string
    editable: AgentEditableEcho
}
export interface CustomAgentDetail extends CustomAgentSummary {
    graph_version_prefix: string
    draft: AgentEditableEcho
    current: AgentCurrentEcho | null
}
export type AgentDetail = BuiltinAgentDetail | CustomAgentDetail
export interface AgentVersion {
    version_id: string
    version_number: number
    graph_version: string
    output_mode: AgentOutputMode
    is_current: boolean
    created_at: string | null
    created_by_user_id: number | null
}
export interface AgentVersionsResponse { versions: AgentVersion[] }
export interface AgentCreateRequest {
    display_name: string
    slug: string
    source_workflow_key: string
    expected_source_version?: number
}
export interface AgentUpdateDraftRequest extends AgentEditable { output_mode?: AgentOutputMode }
export interface AgentTestRequest {
    input_text: string
    source: 'draft' | 'current'
    llm: LlmRequest
}
export interface AgentTestResponse {
    output_mode: AgentOutputMode
    graph_version: string
    llm_execution: LlmExecutionProvenance
    json_output?: Record<string, unknown> | null
    text_output?: string | null
}
