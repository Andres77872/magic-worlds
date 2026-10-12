import type { LlmExecutionProvenance } from '@/shared/types/llm.types'
import { isCardOrganization, isOrganizationWarnings } from './workspaceContract'

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const fields = new Set([
    'id', 'name', 'alias', 'description', 'role', 'is_default_persona', 'default_persona_id',
    'race', 'greeting', 'system_instructions', 'voice', 'type', 'rarity', 'effects', 'requirements',
    'limitations', 'origin', 'value', 'category', 'triggers', 'image_url', 'theme_song_url',
    'persona', 'characters', 'world', 'latest_version_id', 'latest_version_number',
    'request_id', 'llm_execution',
    // Workspace R1: server-owned placement of the saved card (never written back).
    'organization', 'organization_warnings',
])

/**
 * A saved generated card. `organization`/`organization_warnings` are optional
 * until every route decorates them, but when present they must be exactly the
 * R1 shapes, and the card must have landed in the requesting workspace.
 */
export function verifyCardGeneration(value: unknown, requestId?: string, workspaceId?: string): value is {
    id: string; request_id: string; llm_execution: LlmExecutionProvenance
} {
    if (!object(value) || Object.keys(value).some((key) => !fields.has(key)) || !uuid(value.id)
        || typeof value.name !== 'string' || !value.name.trim() || typeof value.description !== 'string'
        || typeof value.request_id !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(value.request_id)
        || requestId !== undefined && value.request_id !== requestId || !object(value.llm_execution)) return false
    if (value.organization !== undefined && (!isCardOrganization(value.organization)
        || workspaceId !== undefined && value.organization.workspace_id !== workspaceId)) return false
    if (value.organization_warnings !== undefined && !isOrganizationWarnings(value.organization_warnings)) return false
    const plan = value.llm_execution
    const keys = ['execution_id', 'profile_id', 'revision_id', 'resolution_source', 'credential_mode', 'replayed']
    return Object.keys(plan).length === keys.length && keys.every((key) => key in plan)
        && [plan.execution_id, plan.profile_id, plan.revision_id].every(uuid) && plan.execution_id === value.id
        && ['user_feature', 'user_default', 'system_feature', 'system_default', 'explicit'].includes(plan.resolution_source as string)
        && ['platform', 'user_byok'].includes(plan.credential_mode as string) && typeof plan.replayed === 'boolean'
}
