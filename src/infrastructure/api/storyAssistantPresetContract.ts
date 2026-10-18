/** The author's own prompt presets for the novel assistant (A19), with the same exact rules as the BFF. */
import { isRecord } from '@/shared/novelMutationJournal'
import type { NovelPresetReference, NovelPresetSnapshot, StoryAssistantAction, StoryAssistantContextRequest, StoryAssistantPreset,
    StoryAssistantPresetDefinition, StoryAssistantPresetInput, StoryAssistantPresetList } from '@/shared/types/storyAssistant.types'
import { canonicalJson } from '@/utils/json'
import { ASSISTANT_ACTION_TASKS, isAssistantAction } from './storyAssistantContextContract'

export const PRESET_LIMITS = { presets: 50, name: 120, instruction: 4000, inputs: 8, label: 80, options: 12, option: 80, textInput: 500 } as const
export const PRESET_KEY = /^[a-z][a-z0-9_]{0,31}$/
export const PRESET_SCOPES = ['selection', 'scene', 'chapter', 'novel'] as const
const PLACEHOLDER = /\{\{([a-z][a-z0-9_]{0,31})\}\}/g
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const DEFINITION = ['instruction', 'inputs', 'task', 'action', 'scope', 'revealPolicy', 'profile']
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every((key) => key in v)
/** Python counts code points and refuses surrounding whitespace. */
export const presetLength = (v: string) => Array.from(v).length
const text = (v: unknown, limit: number): v is string => typeof v === 'string' && v.length > 0 && v === v.trim() && presetLength(v) <= limit

/** The input keys an instruction names in order of first use; null when a brace pair is not exactly {{name}}. */
export function presetPlaceholders(instruction: string): string[] | null {
    const rest = instruction.replace(PLACEHOLDER, '')
    if (rest.includes('{{') || rest.includes('}}')) return null
    return [...new Set(Array.from(instruction.matchAll(PLACEHOLDER), (match) => match[1]))]
}

export type PresetIssue = 'name' | 'instruction' | 'braces' | 'unused' | 'undeclared' | 'key' | 'duplicateKey' | 'label' | 'options' | 'maxLength' | 'action' | 'tooManyInputs'

/** Why a definition would be refused, for the editor; empty when it is valid. */
export function presetIssues(name: string, definition: StoryAssistantPresetDefinition): PresetIssue[] {
    const issues = new Set<PresetIssue>()
    if (!text(name, PRESET_LIMITS.name) || /[\r\n]/.test(name)) issues.add('name')
    if (!text(definition.instruction, PRESET_LIMITS.instruction)) issues.add('instruction')
    if (definition.inputs.length > PRESET_LIMITS.inputs) issues.add('tooManyInputs')
    const keys = definition.inputs.map((input) => input.key), named = presetPlaceholders(definition.instruction)
    if (named === null) issues.add('braces')
    else {
        if (keys.some((key) => !named.includes(key))) issues.add('unused')
        if (named.some((key) => !keys.includes(key))) issues.add('undeclared')
    }
    if (keys.some((key) => !PRESET_KEY.test(key))) issues.add('key')
    if (new Set(keys).size !== keys.length) issues.add('duplicateKey')
    for (const input of definition.inputs) {
        if (!text(input.label, PRESET_LIMITS.label)) issues.add('label')
        if (input.kind === 'text' && !(Number.isSafeInteger(input.maxLength) && input.maxLength >= 1 && input.maxLength <= PRESET_LIMITS.textInput)) issues.add('maxLength')
        if (input.kind === 'choice' && (input.options.length < 2 || input.options.length > PRESET_LIMITS.options || new Set(input.options).size !== input.options.length
            || !input.options.every((option) => text(option, PRESET_LIMITS.option)))) issues.add('options')
    }
    if (definition.action !== null && (!isAssistantAction(definition.action) || ASSISTANT_ACTION_TASKS[definition.action.kind] !== definition.task)) issues.add('action')
    return [...issues]
}

function isInput(v: unknown): v is StoryAssistantPresetInput {
    if (!isRecord(v) || !text(v.key, 32) || !PRESET_KEY.test(v.key) || typeof v.required !== 'boolean' || !text(v.label, PRESET_LIMITS.label)) return false
    if (v.kind === 'text') return exact(v, ['key', 'label', 'kind', 'required', 'maxLength']) && Number.isSafeInteger(v.maxLength) && Number(v.maxLength) >= 1 && Number(v.maxLength) <= PRESET_LIMITS.textInput
    return v.kind === 'choice' && exact(v, ['key', 'label', 'kind', 'required', 'options']) && Array.isArray(v.options) && v.options.length >= 2 && v.options.length <= PRESET_LIMITS.options
        && v.options.every((option) => text(option, PRESET_LIMITS.option)) && new Set(v.options).size === v.options.length
}

export function isPresetDefinition(v: unknown): v is StoryAssistantPresetDefinition {
    if (!isRecord(v) || !exact(v, DEFINITION) || !text(v.instruction, PRESET_LIMITS.instruction) || !Array.isArray(v.inputs) || v.inputs.length > PRESET_LIMITS.inputs
        || !v.inputs.every(isInput) || (v.task !== 'ask' && v.task !== 'suggest')) return false
    const keys = v.inputs.map((input) => input.key), named = presetPlaceholders(v.instruction)
    if (new Set(keys).size !== keys.length || named === null || named.length !== keys.length || !named.every((key) => keys.includes(key))) return false
    if (v.action !== null && (!isAssistantAction(v.action) || ASSISTANT_ACTION_TASKS[v.action.kind] !== v.task)) return false
    if (v.scope !== null && !(PRESET_SCOPES as readonly unknown[]).includes(v.scope)) return false
    if (v.revealPolicy !== null && v.revealPolicy !== 'through_anchor' && v.revealPolicy !== 'author_analysis') return false
    const profile = v.profile
    return profile === null || isRecord(profile) && (profile.mode === 'inherit' ? exact(profile, ['mode'])
        : profile.mode === 'profile' && exact(profile, ['mode', 'profile_id']) && typeof profile.profile_id === 'string' && UUID.test(profile.profile_id))
}

/** Whether one filled value is acceptable for its input. */
export function presetValueValid(input: StoryAssistantPresetInput, value: string): boolean {
    if (input.required && !value) return false
    return input.kind === 'text' ? value === value.trim() && presetLength(value) <= input.maxLength : !value || input.options.includes(value)
}

/** The instruction filled with the author's values, exactly as the BFF renders it; null when a value is not acceptable. */
export function renderPreset(definition: StoryAssistantPresetDefinition, values: Record<string, string>): string | null {
    const rows = new Map(definition.inputs.map((input) => [input.key, input]))
    if (!isRecord(values) || Object.keys(values).length !== rows.size || ![...rows.keys()].every((key) => typeof values[key] === 'string' && presetValueValid(rows.get(key)!, values[key]))) return null
    const message = definition.instruction.replace(PLACEHOLDER, (_match, key: string) => values[key]).trim()
    return message && presetLength(message) <= PRESET_LIMITS.instruction ? message : null
}

const name = (v: unknown): v is string => text(v, PRESET_LIMITS.name) && !/[\r\n]/.test(v)
const time = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v))

export function isStoryAssistantPreset(v: unknown): v is StoryAssistantPreset {
    return isRecord(v) && exact(v, ['id', 'revision', 'name', 'definition', 'trashedAt', 'createdAt', 'updatedAt']) && typeof v.id === 'string' && UUID.test(v.id)
        && Number.isSafeInteger(v.revision) && Number(v.revision) >= 1 && name(v.name) && isPresetDefinition(v.definition)
        && (v.trashedAt === null || time(v.trashedAt)) && time(v.createdAt) && time(v.updatedAt)
}

export function isStoryAssistantPresetList(v: unknown): v is StoryAssistantPresetList {
    return isRecord(v) && exact(v, ['schemaVersion', 'presets', 'limit']) && v.schemaVersion === 1 && v.limit === PRESET_LIMITS.presets
        && Array.isArray(v.presets) && v.presets.every(isStoryAssistantPreset) && new Set(v.presets.map((preset) => preset.id)).size === v.presets.length
}

/** A frozen preset version that still renders exactly this request's message for its task and action. */
export function isPresetSnapshot(v: unknown, request: Pick<StoryAssistantContextRequest, 'message' | 'task'> & { action?: StoryAssistantAction }): v is NovelPresetSnapshot {
    return isRecord(v) && exact(v, ['id', 'revision', 'name', 'definition', 'inputs']) && typeof v.id === 'string' && UUID.test(v.id)
        && Number.isSafeInteger(v.revision) && Number(v.revision) >= 1 && name(v.name) && isPresetDefinition(v.definition) && isRecord(v.inputs)
        && renderPreset(v.definition, v.inputs as Record<string, string>) === request.message && v.definition.task === request.task
        && canonicalJson(v.definition.action) === canonicalJson(request.action ?? null)
}

/** A frozen preset the draft still carries, whatever the author has since typed: its values must still fill its definition. */
export function isPresetSnapshotRecord(v: unknown): v is NovelPresetSnapshot {
    return isRecord(v) && exact(v, ['id', 'revision', 'name', 'definition', 'inputs']) && typeof v.id === 'string' && UUID.test(v.id)
        && Number.isSafeInteger(v.revision) && Number(v.revision) >= 1 && name(v.name) && isPresetDefinition(v.definition) && isRecord(v.inputs)
        && renderPreset(v.definition, v.inputs as Record<string, string>) !== null
}

export function isPresetReference(v: unknown): v is NovelPresetReference {
    return isRecord(v) && exact(v, ['id', 'revision', 'inputs']) && typeof v.id === 'string' && UUID.test(v.id) && Number.isSafeInteger(v.revision) && Number(v.revision) >= 1
        && isRecord(v.inputs) && Object.keys(v.inputs).length <= PRESET_LIMITS.inputs
        && Object.entries(v.inputs).every(([key, value]) => PRESET_KEY.test(key) && typeof value === 'string' && presetLength(value) <= PRESET_LIMITS.textInput)
}

export const presetReference = (snapshot: NovelPresetSnapshot): NovelPresetReference => ({ id: snapshot.id, revision: snapshot.revision, inputs: structuredClone(snapshot.inputs) })

export const presetSnapshot = (preset: StoryAssistantPreset, inputs: Record<string, string>): NovelPresetSnapshot =>
    ({ id: preset.id, revision: preset.revision, name: preset.name, definition: structuredClone(preset.definition), inputs: structuredClone(inputs) })
