import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import {
    INPUT_TOKEN,
    blankForm,
    deriveJsonOutput,
    formFromDetail,
    slugifyWorkflowKey,
    toCreateRequest,
    toUpdateRequest,
    validateAgentForm,
} from './agentValidation'
import type { AgentDetail } from '@/shared'

// Echoes the key plus any interpolation values so assertions can match on key
// substrings (e.g. "reserved") and interpolated tokens.
const t = ((key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${Object.values(vars).join(' ')}` : key) as unknown as TFunction

function newForm() {
    const form = blankForm()
    form.displayName = 'My Generator'
    form.slug = 'my_generator'
    form.editable.model = 'gpt-4o'
    return form
}

describe('agentValidation', () => {
    it('derives json output from the output mode', () => {
        expect(deriveJsonOutput('markdown')).toBe(false)
        expect(deriveJsonOutput('json_object')).toBe(true)
        expect(deriveJsonOutput('strict_card_schema')).toBe(true)
    })

    it('slugifies names', () => {
        expect(slugifyWorkflowKey('My Cool Agent!!')).toBe('my_cool_agent')
        expect(slugifyWorkflowKey('  Spaces  ')).toBe('spaces')
    })

    it('accepts a valid new custom agent', () => {
        expect(validateAgentForm(newForm(), { isNew: true, isBuiltin: false }, t)).toEqual({})
    })

    it('requires the input token in the prompt template', () => {
        const form = newForm()
        form.editable.prompt_template = 'no token here'
        const errors = validateAgentForm(form, { isNew: true, isBuiltin: false }, t)
        expect(errors.prompt_template).toContain(INPUT_TOKEN)
    })

    it('rejects reserved workflow keys for new agents', () => {
        const form = newForm()
        form.slug = 'story_writer'
        const errors = validateAgentForm(form, { isNew: true, isBuiltin: false }, t)
        expect(errors.slug).toMatch(/reserved/i)
    })

    it('flags numeric ranges', () => {
        const form = newForm()
        form.editable.temperature = 3
        form.editable.max_tokens = 0
        form.editable.top_p = 2
        const errors = validateAgentForm(form, { isNew: true, isBuiltin: false }, t)
        expect(errors.temperature).toBeDefined()
        expect(errors.max_tokens).toBeDefined()
        expect(errors.top_p).toBeDefined()
    })

    it('builds a create request, never sending strict_card_schema for custom agents', () => {
        const form = newForm()
        const request = toCreateRequest(form)
        expect(request.slug).toBe('my_generator')
        expect(request.output_mode).toBe('json_object')
        expect(request).not.toHaveProperty('json_output')
    })

    it('omits output_mode for built-in updates and includes it for custom', () => {
        const detail: AgentDetail = {
            workflow_key: 'character_generation',
            kind: 'builtin_card',
            display_name: 'Character generator',
            output_mode: 'strict_card_schema',
            schema_model: 'Character',
            is_system: true,
            has_published: true,
            has_unpublished_draft: false,
            published_version_number: 1,
            latest_version_number: 1,
            updated_at: null,
            graph_version_prefix: 'mw-content-character',
            draft: {
                system_message: 'sys',
                prompt_template: INPUT_TOKEN,
                model: '{{env.CARD_LLM_MODEL}}',
                temperature: 0.7,
                max_tokens: 4096,
                top_p: null,
                json_output: true,
                max_messages: 4,
                max_input_tokens: 8000,
                truncation_strategy: 'tail',
                timeout: 120,
            },
            published: null,
        }
        const builtinForm = formFromDetail(detail)
        expect(toUpdateRequest(builtinForm, true)).not.toHaveProperty('output_mode')
        expect(toUpdateRequest(newForm(), false).output_mode).toBe('json_object')
    })
})
