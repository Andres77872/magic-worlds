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
import type { BuiltinAgentDetail } from '@/shared'

// Echoes the key plus any interpolation values so assertions can match on key
// substrings (e.g. "reserved") and interpolated tokens.
const t = ((key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${Object.values(vars).join(' ')}` : key) as unknown as TFunction

function newForm() {
    const form = blankForm()
    form.displayName = 'My Generator'
    form.slug = 'my_generator'
    form.sourceWorkflowKey = 'character_generation'
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
        expect(validateAgentForm(newForm(), { isNew: true, schemaModel: null }, t)).toEqual({})
    })

    it('requires the input token in the prompt template', () => {
        const form = newForm()
        form.editable.prompt_template = 'no token here'
        const errors = validateAgentForm(form, { isNew: true, schemaModel: null }, t)
        expect(errors.prompt_template).toContain(INPUT_TOKEN)
    })

    it('accepts a slug that matches a built-in key because custom_ namespacing prevents a collision', () => {
        const form = newForm()
        form.slug = 'story_writer'
        expect(validateAgentForm(form, { isNew: true, schemaModel: null }, t).slug).toBeUndefined()
    })

    it('builds the exact detached-copy create request', () => {
        const form = newForm()
        const request = toCreateRequest(form)
        expect(request).toEqual({
            display_name: 'My Generator',
            slug: 'my_generator',
            source_workflow_key: 'character_generation',
        })
    })

    it('omits output_mode for built-in updates and includes it for custom', () => {
        const detail: BuiltinAgentDetail = {
            workflow_key: 'character_generation',
            kind: 'builtin_card',
            display_name: 'Character generator',
            output_mode: 'strict_card_schema',
            schema_model: 'Character',
            builtin_version: 2,
            graph_version: 'mw-content-character-v2',
            graph_version_prefix: 'mw-content-character',
            editable: {
                system_message: 'sys',
                prompt_template: INPUT_TOKEN,
                json_output: true,
            },
        }
        const builtinForm = formFromDetail(detail)
        expect(toUpdateRequest(builtinForm, true)).not.toHaveProperty('output_mode')
        expect(toUpdateRequest(newForm(), false).output_mode).toBe('json_object')
    })

    it('accepts returned strict schemas on database copies and enforces string maxima', () => {
        const form = newForm()
        form.outputMode = 'strict_card_schema'
        expect(validateAgentForm(form, { isNew: false, schemaModel: 'Character' }, t).outputMode).toBeUndefined()

        form.displayName = 'x'.repeat(129)
        form.editable.system_message = 'x'.repeat(20001)
        form.editable.prompt_template = `${INPUT_TOKEN}${'x'.repeat(40000)}`
        const errors = validateAgentForm(form, { isNew: true, schemaModel: 'Character' }, t)
        expect(errors.displayName).toBeDefined()
        expect(errors.system_message).toBeDefined()
        expect(errors.prompt_template).toBeDefined()
    })
})
