/**
 * Pure helpers for the Agent Studio form: defaults, slug rules, JSON-output
 * derivation, validation, and request builders. No React — unit-testable.
 */
import type { TFunction } from 'i18next'
import type {
    AgentCreateRequest,
    AgentDetail,
    AgentEditableEcho,
    AgentOutputMode,
    AgentUpdateDraftRequest,
} from '@/shared'

/** The parser injection token the prompt template must contain. */
export const INPUT_TOKEN = '{{handle_parser_input_0}}'

/** Built-in workflow keys cannot be reused by custom agents. */
export const RESERVED_WORKFLOW_KEYS = new Set([
    'character_generation',
    'world_generation',
    'item_generation',
    'adventure_template_generation',
    'story_writer',
])

/** json_output is a function of the output mode (markdown → false, else true). */
export function deriveJsonOutput(mode: AgentOutputMode): boolean {
    return mode !== 'markdown'
}

export function slugifyWorkflowKey(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40)
}

/** The editor's working state. */
export interface AgentForm {
    displayName: string
    slug: string
    outputMode: AgentOutputMode
    editable: AgentEditableEcho
}

export function blankEditable(): AgentEditableEcho {
    return {
        system_message: 'You are a Magic Worlds content generator. Return only the requested output.',
        prompt_template: `Use the user input below to produce the requested result.\n${INPUT_TOKEN}`,
        model: '',
        temperature: 0.7,
        max_tokens: 2048,
        top_p: null,
        json_output: true,
        max_messages: 8,
        max_input_tokens: 8000,
        truncation_strategy: 'tail',
        timeout: 120,
    }
}

export function blankForm(): AgentForm {
    return { displayName: '', slug: '', outputMode: 'json_object', editable: blankEditable() }
}

export function formFromDetail(detail: AgentDetail): AgentForm {
    return {
        displayName: detail.display_name,
        slug: detail.workflow_key,
        outputMode: detail.output_mode,
        editable: { ...detail.draft },
    }
}

function inRange(value: number, min: number, max: number): boolean {
    return Number.isFinite(value) && value >= min && value <= max
}

export interface ValidateOptions {
    isNew: boolean
    isBuiltin: boolean
}

export function validateAgentForm(
    form: AgentForm,
    { isNew, isBuiltin }: ValidateOptions,
    t: TFunction,
): Record<string, string> {
    const errors: Record<string, string> = {}
    const e = form.editable

    if (isNew) {
        if (!form.displayName.trim()) errors.displayName = t('admin.agents.validation.nameRequired')
        const slug = form.slug.trim()
        if (!slug) {
            errors.slug = t('admin.agents.validation.keyRequired')
        } else if (!/^[a-z][a-z0-9_]{2,40}$/.test(slug)) {
            errors.slug = t('admin.agents.validation.keyFormat')
        } else if (RESERVED_WORKFLOW_KEYS.has(slug)) {
            errors.slug = t('admin.agents.validation.keyReserved')
        }
    }

    if (!isNew && isBuiltin && form.outputMode === 'strict_card_schema') {
        // Built-in cards stay strict; nothing to validate here.
    } else if (form.outputMode === 'strict_card_schema' && !isBuiltin) {
        errors.outputMode = t('admin.agents.validation.strictSchemaCustom')
    }

    if (!e.system_message.trim()) errors.system_message = t('admin.agents.validation.systemMessageRequired')
    if (!e.prompt_template.includes(INPUT_TOKEN)) {
        errors.prompt_template = t('admin.agents.validation.inputTokenRequired', { token: INPUT_TOKEN })
    }
    if (!e.model.trim()) errors.model = t('admin.agents.validation.modelRequired')

    if (!inRange(e.temperature, 0, 2)) errors.temperature = t('admin.agents.validation.temperatureRange')
    if (e.top_p !== null && !inRange(e.top_p, 0, 1)) errors.top_p = t('admin.agents.validation.topPRange')
    if (!inRange(e.max_tokens, 1, 32000)) errors.max_tokens = t('admin.agents.validation.maxTokensRange')
    if (!inRange(e.max_messages, 1, 64)) errors.max_messages = t('admin.agents.validation.maxMessagesRange')
    if (!inRange(e.max_input_tokens, 256, 200000)) {
        errors.max_input_tokens = t('admin.agents.validation.maxInputTokensRange')
    }
    if (!inRange(e.timeout, 1, 600)) errors.timeout = t('admin.agents.validation.timeoutRange')

    return errors
}

function editablePayload(e: AgentEditableEcho) {
    return {
        system_message: e.system_message,
        prompt_template: e.prompt_template,
        model: e.model.trim(),
        temperature: e.temperature,
        max_tokens: e.max_tokens,
        top_p: e.top_p,
        max_messages: e.max_messages,
        max_input_tokens: e.max_input_tokens,
        truncation_strategy: e.truncation_strategy,
        timeout: e.timeout,
    }
}

export function toCreateRequest(form: AgentForm): AgentCreateRequest {
    const mode = form.outputMode === 'strict_card_schema' ? 'json_object' : form.outputMode
    return {
        ...editablePayload(form.editable),
        display_name: form.displayName.trim(),
        slug: form.slug.trim(),
        output_mode: mode,
    }
}

export function toUpdateRequest(form: AgentForm, isBuiltin: boolean): AgentUpdateDraftRequest {
    const payload: AgentUpdateDraftRequest = editablePayload(form.editable)
    // Built-ins keep their output mode fixed; only custom agents send it.
    if (!isBuiltin) payload.output_mode = form.outputMode
    return payload
}
