import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi, type Mock } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import type { StoryAssistantPreset, StoryAssistantPresetDefinition } from '@/shared/types/storyAssistant.types'
import { initialAssistantSettings } from '../persistence/assistantDraftJournal'
import { NovelAssistantPresets, type AssistantPresetsApi } from './NovelAssistantPresets'

const DEFINITION: StoryAssistantPresetDefinition = { instruction: 'How old is {{who}}? Answer in a {{tone}} way.', task: 'ask', action: null, scope: 'novel', revealPolicy: null, profile: null,
    inputs: [{ key: 'who', label: 'Character', kind: 'text', required: true, maxLength: 40 }, { key: 'tone', label: 'Tone', kind: 'choice', required: false, options: ['short', 'plain'] }] }
const PRESET: StoryAssistantPreset = { id: '0b6f6d1e-2d43-4a8e-9b1e-0f5c3a7d9e21', revision: 3, name: 'Age check', definition: DEFINITION, trashedAt: null,
    createdAt: '2026-10-18T01:02:03+00:00', updatedAt: '2026-10-18T01:02:03+00:00' }
const settings = initialAssistantSettings('scene-1', null)

type Mocked = { [K in keyof AssistantPresetsApi]: Mock<AssistantPresetsApi[K]> }
function api(presets: StoryAssistantPreset[] = [PRESET]): Mocked {
    return {
        list: vi.fn<AssistantPresetsApi['list']>().mockResolvedValue({ schemaVersion: 1, limit: 50, presets }),
        create: vi.fn<AssistantPresetsApi['create']>(async (id, name, definition) => ({ ...PRESET, id, name, definition, revision: 1 })),
        update: vi.fn<AssistantPresetsApi['update']>(async (_id, name, definition, revision) => ({ ...PRESET, name, definition, revision: revision + 1 })),
        setTrashed: vi.fn<AssistantPresetsApi['setTrashed']>(async (_id, trashed) => ({ ...PRESET, trashedAt: trashed ? PRESET.createdAt : null })),
        remove: vi.fn<AssistantPresetsApi['remove']>().mockResolvedValue(undefined),
    }
}
const open = async (props: Partial<Parameters<typeof NovelAssistantPresets>[0]> = {}) => {
    const view = render(<NovelAssistantPresets api={api()} settings={settings} selection={{ mode: 'inherit' }} onUse={vi.fn().mockReturnValue('applied')} {...props} />)
    const element = view.container.querySelector('details')!
    element.open = true; fireEvent(element, new Event('toggle'))
    await screen.findByRole('list', { name: 'Your presets' })
    return view
}

it('fills a preset’s inputs, shows the exact message and asks before replacing the author’s own words', async () => {
    const onUse = vi.fn().mockReturnValueOnce('confirm').mockReturnValueOnce('applied')
    await open({ onUse })
    fireEvent.click(screen.getByRole('button', { name: 'Use Age check' }))
    const form = screen.getByRole('region', { name: 'Fill Age check' })
    expect(within(form).getByRole('button', { name: 'Fill the message' })).toBeDisabled()
    fireEvent.change(within(form).getByLabelText('Character'), { target: { value: 'Aria' } })
    // The message is exactly what the BFF renders, spaces included.
    expect(within(form).getByText((_, node) => node?.tagName === 'BLOCKQUOTE' && node.textContent === 'How old is Aria? Answer in a  way.')).toBeInTheDocument()
    fireEvent.click(within(form).getByRole('button', { name: 'Fill the message' }))
    expect(onUse).toHaveBeenLastCalledWith(PRESET, { who: 'Aria', tone: '' }, false)
    expect(within(form).getByText('This replaces the message you wrote in the composer.')).toBeInTheDocument()
    fireEvent.click(within(form).getByRole('button', { name: 'Replace my message' }))
    expect(onUse).toHaveBeenLastCalledWith(PRESET, { who: 'Aria', tone: '' }, true)
    expect(screen.queryByRole('region', { name: 'Fill Age check' })).not.toBeInTheDocument()
})

it('saves a new preset only when every input is used, under one id for retries', async () => {
    const client = api([])
    render(<NovelAssistantPresets api={client} settings={settings} selection={{ mode: 'inherit' }} onUse={vi.fn()} />)
    const element = document.querySelector('details')!
    element.open = true; fireEvent(element, new Event('toggle'))
    fireEvent.click(await screen.findByRole('button', { name: 'New preset' }))
    const form = screen.getByRole('region', { name: 'New preset' })
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Scene mood' } })
    fireEvent.change(within(form).getByLabelText(/^Instruction/), { target: { value: 'Describe the mood of this scene.' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add an input' }))
    fireEvent.change(within(form).getByLabelText('Label'), { target: { value: 'Focus' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save preset' }))
    expect(await within(form).findByText('Every input must appear in the instruction.')).toBeInTheDocument()
    expect(client.create).not.toHaveBeenCalled()
    fireEvent.click(within(form).getByRole('button', { name: 'Insert {{detail}}' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Save preset' }))
    await waitFor(() => expect(client.create).toHaveBeenCalledTimes(1))
    const [id, name, definition] = client.create.mock.calls[0]
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(name).toBe('Scene mood')
    expect(definition).toEqual({ instruction: 'Describe the mood of this scene. {{detail}}', task: 'ask', action: null, scope: null, revealPolicy: null, profile: null,
        inputs: [{ key: 'detail', label: 'Focus', kind: 'text', required: true, maxLength: 200 }] })
    expect(await screen.findByText('Preset saved.')).toBeInTheDocument()
})

it('saves an edit as the next version at the version read, and reloads when another tab saved first', async () => {
    const client = api()
    await open({ api: client })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Age check' }))
    const form = screen.getByRole('region', { name: 'Edit preset' })
    expect(within(form).getByText(/Saving makes version 4/)).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Age check, short' } })
    client.update.mockRejectedValueOnce(new ApiError(409, 'changed', { code: 'STORY_ASSISTANT_PRESET_CHANGED', retryable: false }))
    fireEvent.click(within(form).getByRole('button', { name: 'Save preset' }))
    expect(await screen.findByText(/changed in another tab or device/)).toBeInTheDocument()
    expect(client.update).toHaveBeenCalledWith(PRESET.id, 'Age check, short', DEFINITION, 3)
    await waitFor(() => expect(client.list).toHaveBeenCalledTimes(2))
})

it('moves a preset to Trash, restores it, and deletes it from Trash only after a confirmation', async () => {
    const client = api([PRESET, { ...PRESET, id: '1b6f6d1e-2d43-4a8e-9b1e-0f5c3a7d9e21', name: 'Old one', trashedAt: PRESET.createdAt }])
    await open({ api: client })
    fireEvent.click(screen.getByRole('button', { name: 'Move Age check to Trash' }))
    await waitFor(() => expect(client.setTrashed).toHaveBeenCalledWith(PRESET.id, true, 3))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Old one' }))
    expect(client.remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deleting Old one' }))
    await waitFor(() => expect(client.remove).toHaveBeenCalledWith('1b6f6d1e-2d43-4a8e-9b1e-0f5c3a7d9e21', 3))
    expect(await screen.findByText('Preset deleted.')).toBeInTheDocument()
})

it('lets a read-only drawer read presets but not use or change them', async () => {
    await open({ disabled: true })
    expect(screen.getByText('Age check')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Use Age check|Edit Age check|New preset/ })).not.toBeInTheDocument()
})
