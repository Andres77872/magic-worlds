import { expect, it } from 'vitest'
import type { StoryAssistantPreset, StoryAssistantPresetDefinition } from '@/shared/types/storyAssistant.types'
import { activeAssistantPreset, initialAssistantSettings, isNovelAssistantDraft, newAssistantDraft } from '@/features/novel/persistence/assistantDraftJournal'
import { isPresetDefinition, isPresetSnapshot, isStoryAssistantPresetList, presetIssues, presetPlaceholders, presetReference, presetSnapshot, renderPreset } from './storyAssistantPresetContract'

const ID = '0b6f6d1e-2d43-4a8e-9b1e-0f5c3a7d9e21'
// The same definition the BFF tests use, so both sides agree on what is valid and how it renders.
const DEFINITION: StoryAssistantPresetDefinition = { instruction: 'How old is {{who}}? Answer in a {{tone}} way.', task: 'ask', action: null, scope: 'novel', revealPolicy: null, profile: null,
    inputs: [{ key: 'who', label: 'Character', kind: 'text', required: true, maxLength: 40 }, { key: 'tone', label: 'Tone', kind: 'choice', required: false, options: ['short', 'plain'] }] }
const PRESET: StoryAssistantPreset = { id: ID, revision: 3, name: 'Age check', definition: DEFINITION, trashedAt: null, createdAt: '2026-10-18T01:02:03+00:00', updatedAt: '2026-10-18T01:02:03+00:00' }
const defined = (patch: Partial<StoryAssistantPresetDefinition>) => ({ ...structuredClone(DEFINITION), ...patch })

it('accepts exactly the definitions the BFF accepts, with every input used once declared', () => {
    expect(isPresetDefinition(DEFINITION)).toBe(true)
    expect(presetPlaceholders('{{a}} then {{b_2}} and {{a}}')).toEqual(['a', 'b_2'])
    expect(presetPlaceholders('{{ a }}')).toBeNull()
    expect(isPresetDefinition(defined({ instruction: 'Rewrite in first person.', inputs: [], task: 'suggest', action: { kind: 'transform', pov: 'first', tense: null },
        profile: { mode: 'profile', profile_id: '6a0d3c55-6c8e-4f61-8a41-3f1b2c9d7e10' } }))).toBe(true)
    for (const bad of [defined({ instruction: 'How old is {{who}}?' }), defined({ instruction: 'How old is {{who}} and {{when}}? {{tone}}' }), defined({ instruction: 'How old is {{ who }}? {{tone}}' }),
        defined({ instruction: ' How old is {{who}}? {{tone}}' }), defined({ inputs: [DEFINITION.inputs[0], DEFINITION.inputs[0]] }),
        defined({ inputs: [DEFINITION.inputs[0], { ...DEFINITION.inputs[1], options: ['short', 'short'] } as StoryAssistantPresetDefinition['inputs'][number]] }),
        defined({ action: { kind: 'summary' }, task: 'suggest' }), defined({ scope: 'scenes' as never }), defined({ profile: { mode: 'profile', profile_id: 'NOT-A-UUID' } })]) {
        expect(isPresetDefinition(bad)).toBe(false)
    }
    expect(presetIssues('Age check', defined({ instruction: 'How old is {{who}} and {{when}}?' }))).toEqual(expect.arrayContaining(['unused', 'undeclared']))
    expect(presetIssues(' ', DEFINITION)).toEqual(['name'])
    expect(isStoryAssistantPresetList({ schemaVersion: 1, limit: 50, presets: [PRESET, { ...PRESET, id: '1b6f6d1e-2d43-4a8e-9b1e-0f5c3a7d9e21', trashedAt: PRESET.createdAt }] })).toBe(true)
    expect(isStoryAssistantPresetList({ schemaVersion: 1, limit: 50, presets: [PRESET, PRESET] })).toBe(false)
})

it('renders the message as the BFF does, and a frozen snapshot only for that exact message, task and action', () => {
    expect(renderPreset(DEFINITION, { who: 'Aria', tone: 'short' })).toBe('How old is Aria? Answer in a short way.')
    expect(renderPreset(DEFINITION, { who: '{{tone}}', tone: '' })).toBe('How old is {{tone}}? Answer in a  way.')
    for (const values of [{ who: 'Aria' }, { who: '', tone: '' }, { who: 'A'.repeat(41), tone: '' }, { who: ' Aria', tone: '' }, { who: 'Aria', tone: 'loud' }]) {
        expect(renderPreset(DEFINITION, values as Record<string, string>)).toBeNull()
    }
    const snapshot = presetSnapshot(PRESET, { who: 'Aria', tone: 'short' })
    expect(presetReference(snapshot)).toEqual({ id: ID, revision: 3, inputs: { who: 'Aria', tone: 'short' } })
    expect(isPresetSnapshot(snapshot, { message: 'How old is Aria? Answer in a short way.', task: 'ask' })).toBe(true)
    expect(isPresetSnapshot(snapshot, { message: 'How old is Aria?', task: 'ask' })).toBe(false)
    expect(isPresetSnapshot(snapshot, { message: 'How old is Aria? Answer in a short way.', task: 'ask', action: { kind: 'summary' } })).toBe(false)
})

it('keeps a draft’s preset only while its message and task are still what the preset filled in', () => {
    const base = newAssistantDraft('story-1', 'scene-1', null), preset = presetSnapshot(PRESET, { who: 'Aria', tone: 'short' })
    const draft = { ...base, message: 'How old is Aria? Answer in a short way.', settings: { ...initialAssistantSettings('scene-1', null), scope: 'novel' as const }, preset }
    expect(isNovelAssistantDraft(draft)).toBe(true)
    expect(activeAssistantPreset(draft)).toEqual(preset)
    expect(activeAssistantPreset({ ...draft, message: 'How old is Aria? Answer briefly.' })).toBeNull()
    expect(activeAssistantPreset({ ...draft, settings: { ...draft.settings, task: 'suggest' } })).toBeNull()
    expect(isNovelAssistantDraft({ ...draft, preset: { ...preset, inputs: { who: 'Aria' } } })).toBe(false)
})
