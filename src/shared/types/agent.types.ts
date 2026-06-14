/**
 * Agent Studio types (root-only). The frontend only ever sees the structured
 * "editable surface" — provider credentials (api_key/base_url) stay server-side
 * as {{env.CARD_LLM_*}} placeholders and never appear in any of these shapes.
 */

export type AgentOutputMode = 'strict_card_schema' | 'json_object' | 'markdown'
export type AgentTruncationStrategy = 'tail' | 'token_budget'

/** The fields the Studio form edits, 1:1 with the backend AgentEditableFields. */
export interface AgentEditable {
    system_message: string
    prompt_template: string
    model: string
    temperature: number
    max_tokens: number
    top_p: number | null
    max_messages: number
    max_input_tokens: number
    truncation_strategy: AgentTruncationStrategy
    timeout: number
}

export interface AgentEditableEcho extends AgentEditable {
    /** Derived from output_mode (markdown → false, else true). */
    json_output: boolean
}

export interface AgentPublishedEcho extends AgentEditableEcho {
    version_number: number
    graph_version: string
}

export interface AgentSummary {
    workflow_key: string
    kind: string
    display_name: string
    output_mode: AgentOutputMode
    schema_model: string | null
    is_system: boolean
    has_published: boolean
    has_unpublished_draft: boolean
    published_version_number: number | null
    latest_version_number: number
    updated_at: string | null
}

export interface AgentDetail extends AgentSummary {
    graph_version_prefix: string
    draft: AgentEditableEcho
    published: AgentPublishedEcho | null
}

export interface AgentVersion {
    version_id: string
    version_number: number
    graph_version: string
    output_mode: AgentOutputMode
    is_current: boolean
    published_at: string | null
    published_by_user_id: number | null
}

export interface AgentVersionsResponse {
    versions: AgentVersion[]
}

export interface AgentModelOption {
    id: string
    label: string | null
    owned_by: string | null
    context_length: number | null
    status: string | null
}

export interface AgentModelsResponse {
    models: AgentModelOption[]
}

export interface AgentCreateRequest extends AgentEditable {
    display_name: string
    slug: string
    output_mode: Exclude<AgentOutputMode, 'strict_card_schema'>
}

export interface AgentUpdateDraftRequest extends AgentEditable {
    output_mode?: AgentOutputMode
}

export interface AgentTestRequest {
    input_text: string
    source?: 'draft' | 'published'
}

export interface AgentTestResponse {
    output_mode: AgentOutputMode
    graph_version: string
    json_output?: Record<string, unknown> | null
    text_output?: string | null
}
