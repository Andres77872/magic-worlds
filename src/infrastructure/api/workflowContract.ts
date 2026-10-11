import type {
    AgentDetail, AgentSummary, AgentTestResponse, AgentVersionsResponse, CustomAgentDetail,
} from '@/shared/types/agent.types'

type RecordValue = Record<string, unknown>
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max = 128): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0
const nullableText = (value: unknown): boolean => value === null || text(value)
const uuid = (value: unknown): boolean => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const exact = (value: RecordValue, keys: string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => key in value)
const mode = (value: unknown): boolean => ['strict_card_schema', 'json_object', 'markdown'].includes(value as string)
const commonKeys = ['workflow_key', 'kind', 'display_name', 'output_mode', 'schema_model']
const customKeys = [...commonKeys, 'row_version', 'has_draft_changes', 'current_version_number', 'latest_version_number', 'updated_at']
const builtinKeys = [...commonKeys, 'builtin_version', 'graph_version']
const editableKeys = ['system_message', 'prompt_template', 'json_output']

function summary(value: RecordValue): boolean {
    return text(value.workflow_key, 96) && text(value.display_name) && mode(value.output_mode)
        && (value.output_mode === 'strict_card_schema'
            ? ['Character', 'World', 'Item', 'AdventureTemplate'].includes(value.schema_model as string)
            : value.schema_model === null)
        && (value.kind === 'custom'
            ? positive(value.row_version) && typeof value.has_draft_changes === 'boolean'
                && (value.current_version_number === null
                    // Unpublished (a draft-only workflow retired by the profile cutover): never a runtime current.
                    ? value.has_draft_changes === true && Number.isSafeInteger(value.latest_version_number)
                        && (value.latest_version_number as number) >= 0
                    : positive(value.current_version_number) && positive(value.latest_version_number)
                        && value.current_version_number <= value.latest_version_number)
                && nullableText(value.updated_at)
            : ['builtin_card', 'builtin_story'].includes(value.kind as string)
                && positive(value.builtin_version) && text(value.graph_version)
                && (value.kind === 'builtin_story') === (value.output_mode === 'markdown'))
}
function editable(value: unknown, outputMode: unknown, current = false): boolean {
    return record(value) && exact(value, current ? [...editableKeys, 'output_mode', 'schema_model', 'version_number', 'graph_version'] : editableKeys)
        && text(value.system_message, 20_000) && text(value.prompt_template, 40_000)
        && value.prompt_template.includes('{{handle_parser_input_0}}')
        && value.json_output === (outputMode !== 'markdown')
        && (!current || positive(value.version_number) && text(value.graph_version) && mode(value.output_mode)
            && (value.output_mode === 'strict_card_schema' ? ['Character', 'World', 'Item', 'AdventureTemplate'].includes(value.schema_model as string) : value.schema_model === null))
}
export function verifyAgentSummary(value: unknown): value is AgentSummary {
    return record(value) && exact(value, value.kind === 'custom' ? customKeys : builtinKeys) && summary(value)
}
export function verifyAgentList(value: unknown): value is AgentSummary[] {
    return Array.isArray(value) && value.every(verifyAgentSummary)
}
export function verifyAgentDetail(value: unknown): value is AgentDetail {
    if (!record(value) || !summary(value) || !text(value.graph_version_prefix, 96)) return false
    if (value.kind === 'custom') {
        return exact(value, [...customKeys, 'graph_version_prefix', 'draft', 'current'])
            && editable(value.draft, value.output_mode)
            && (value.current === null
                ? value.current_version_number === null
                : record(value.current) && editable(value.current, value.current.output_mode, true)
                    && value.current.version_number === value.current_version_number)
    }
    return exact(value, [...builtinKeys, 'graph_version_prefix', 'editable']) && editable(value.editable, value.output_mode)
}
export function verifyCustomAgentDetail(value: unknown): value is CustomAgentDetail {
    return verifyAgentDetail(value) && value.kind === 'custom'
}
export function verifyAgentVersions(value: unknown): value is AgentVersionsResponse {
    return record(value) && exact(value, ['versions']) && Array.isArray(value.versions)
        && value.versions.every((version) => record(version)
            && exact(version, ['version_id', 'version_number', 'graph_version', 'output_mode', 'is_current', 'created_at', 'created_by_user_id'])
            && uuid(version.version_id) && positive(version.version_number) && text(version.graph_version)
            && mode(version.output_mode) && typeof version.is_current === 'boolean'
            && nullableText(version.created_at) && (version.created_by_user_id === null || positive(version.created_by_user_id)))
}
export function verifyAgentTest(value: unknown): value is AgentTestResponse {
    if (!record(value) || Object.keys(value).some((key) => !['output_mode', 'graph_version', 'llm_execution', 'json_output', 'text_output'].includes(key))
        || !mode(value.output_mode) || !text(value.graph_version) || !record(value.llm_execution)) return false
    const plan = value.llm_execution
    if (!exact(plan, ['execution_id', 'profile_id', 'revision_id', 'resolution_source', 'credential_mode', 'replayed'])
        || ![plan.execution_id, plan.profile_id, plan.revision_id].every(uuid)
        || !['explicit', 'user_feature', 'user_default', 'system_feature', 'system_default'].includes(plan.resolution_source as string)
        || !['platform', 'user_byok'].includes(plan.credential_mode as string) || typeof plan.replayed !== 'boolean') return false
    return value.output_mode === 'markdown'
        ? text(value.text_output, 512 * 1024) && (value.json_output === null || value.json_output === undefined)
        : record(value.json_output) && (value.text_output === null || value.text_output === undefined)
}
