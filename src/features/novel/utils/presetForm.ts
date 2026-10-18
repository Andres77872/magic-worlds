/** The prompt-preset editor's form (A19): what the author types, and the exact definition it saves. */
import type { LlmSelection } from '@/shared/types/llm.types'
import type { StoryAssistantPreset, StoryAssistantPresetDefinition } from '@/shared/types/storyAssistant.types'
import { presetIssues, type PresetIssue } from '@/infrastructure/api/storyAssistantPresetContract'
import { withoutAction, type AssistantSourceSettings } from '../persistence/assistantDraftJournal'

export interface PresetInputForm { key: string; label: string; kind: 'text' | 'choice'; required: boolean; maxLength: string; options: string }
/** keep: the drawer's choice stays; inherit: the application's profile; current/saved: the profile chosen in the drawer now, or saved with the preset. */
export type PresetProfileChoice = 'keep' | 'inherit' | 'current' | 'saved'
export interface PresetForm {
    name: string; instruction: string; inputs: PresetInputForm[]
    /** The task and action, chosen with the drawer's own action picker; the other source choices are not saved from here. */
    settings: AssistantSourceSettings
    scope: '' | NonNullable<StoryAssistantPresetDefinition['scope']>
    revealPolicy: '' | NonNullable<StoryAssistantPresetDefinition['revealPolicy']>
    profile: PresetProfileChoice
}

export function newPresetForm(settings: AssistantSourceSettings): PresetForm {
    return { name: '', instruction: '', inputs: [], settings: structuredClone(settings), scope: '', revealPolicy: '', profile: 'keep' }
}

export function presetToForm(preset: StoryAssistantPreset, settings: AssistantSourceSettings): PresetForm {
    const definition = preset.definition
    return { name: preset.name, instruction: definition.instruction,
        inputs: definition.inputs.map((input) => ({ key: input.key, label: input.label, kind: input.kind, required: input.required,
            maxLength: input.kind === 'text' ? String(input.maxLength) : '200', options: input.kind === 'choice' ? input.options.join('\n') : '' })),
        settings: { ...withoutAction(settings), task: definition.task, ...(definition.action ? { action: structuredClone(definition.action) } : {}) },
        scope: definition.scope ?? '', revealPolicy: definition.revealPolicy ?? '',
        profile: definition.profile === null ? 'keep' : definition.profile.mode === 'inherit' ? 'inherit' : 'saved' }
}

/** The next unused input key: detail, detail_2, … */
export function nextInputKey(inputs: PresetInputForm[]): string {
    const used = new Set(inputs.map((input) => input.key))
    for (let n = 1; ; n++) { const key = n === 1 ? 'detail' : 'detail_' + n; if (!used.has(key)) return key }
}

export function formDefinition(form: PresetForm, profiles: { current: LlmSelection; saved: LlmSelection | null }): StoryAssistantPresetDefinition {
    const action = form.settings.action
    const profile = form.profile === 'inherit' ? { mode: 'inherit' as const } : form.profile === 'current' ? structuredClone(profiles.current)
        : form.profile === 'saved' && profiles.saved ? structuredClone(profiles.saved) : null
    return {
        instruction: form.instruction.trim(),
        inputs: form.inputs.map((input) => input.kind === 'text'
            ? { key: input.key.trim(), label: input.label.trim(), kind: 'text' as const, required: input.required, maxLength: Number(input.maxLength) }
            : { key: input.key.trim(), label: input.label.trim(), kind: 'choice' as const, required: input.required,
                options: input.options.split('\n').map((option) => option.trim()).filter(Boolean) }),
        task: form.settings.task,
        action: action ? action.kind === 'dialogue' ? { ...action, speaker: action.speaker.trim() } : structuredClone(action) : null,
        scope: form.scope || null, revealPolicy: form.revealPolicy || null, profile,
    }
}

export function formIssues(form: PresetForm, definition: StoryAssistantPresetDefinition): PresetIssue[] {
    return presetIssues(form.name.trim(), definition)
}

/** Each input's starting value: empty text, the first option of a required choice, no option otherwise. */
export function initialPresetValues(definition: StoryAssistantPresetDefinition): Record<string, string> {
    return Object.fromEntries(definition.inputs.map((input) => [input.key, input.kind === 'choice' && input.required ? input.options[0] : '']))
}
