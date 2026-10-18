import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { VoicePerformance } from '@/shared'
import { PERFORMANCE_CAPABILITIES, PRONUNCIATION_FIXTURE } from '../performanceFixtures'
import { VoicePerformancePanel } from './VoicePerformancePanel'

const api = vi.hoisted(() => ({ getVoicePerformanceCapabilities: vi.fn(), listPronunciationDictionaries: vi.fn(), savePronunciationDictionary: vi.fn(), archivePronunciationDictionary: vi.fn() }))
const preview = vi.hoisted(() => ({ run: vi.fn(), reset: vi.fn(), previewsLeft: 10, nextCostsCredit: false, loading: false, limitReached: false, problem: null, clip: null,
    credit: { open: false, guard: vi.fn(), confirm: vi.fn(), cancel: vi.fn() } }))
vi.mock('@/infrastructure/api', () => ({ apiService: api }))
vi.mock('../useRecipePreview', () => ({ useRecipePreview: () => preview, previewProblemMessage: () => null }))

beforeEach(() => {
    vi.clearAllMocks()
    api.getVoicePerformanceCapabilities.mockResolvedValue(PERFORMANCE_CAPABILITIES)
    api.listPronunciationDictionaries.mockResolvedValue({ items: [] })
})

function Scene() {
    const [value, setValue] = useState<VoicePerformance | null>(null)
    return <><VoicePerformancePanel voiceKey={`vk_${'a'.repeat(32)}`} language="en" emotion={null} value={value} onChange={setValue} /><output data-testid="saved">{JSON.stringify(value)}</output></>
}

it('keeps selected delivery separate from text and compares against a neutral take', async () => {
    render(<Scene />)
    fireEvent.click(await screen.findByText('Advanced performance'))
    const field = screen.getByRole('textbox', { name: 'Comparison text' }) as HTMLTextAreaElement
    fireEvent.change(field, { target: { value: 'Hi 👩‍🚀 Nora.' } })
    const start = field.value.indexOf('Nora')
    field.setSelectionRange(start, start + 4); fireEvent.select(field)
    fireEvent.click(screen.getByRole('button', { name: 'Apply to selection' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Voice direction' }), { target: { value: 'quietly reassuring' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview directed' }))
    expect(preview.run).toHaveBeenLastCalledWith(expect.objectContaining({ authoredText: 'Hi 👩‍🚀 Nora.', performance: expect.objectContaining({ direction: 'quietly reassuring', spans: [{ start: 7, end: 11, delivery: 'whisper' }] }) }))
    expect(field.value).toBe('Hi 👩‍🚀 Nora.')
    expect(screen.getByTestId('saved').textContent).not.toContain('spans')
    fireEvent.click(screen.getByRole('button', { name: 'Preview neutral' }))
    expect(preview.run).toHaveBeenLastCalledWith(expect.objectContaining({ performance: expect.objectContaining({ spans: [], events: [], dictionary_refs: [] }) }))
    fireEvent.change(field, { target: { value: 'Nora returned.' } })
    expect(screen.queryByRole('button', { name: 'Remove Whisper' })).not.toBeInTheDocument()
})

it('keeps a pinned version when a dictionary is edited and requires explicit latest selection', async () => {
    api.listPronunciationDictionaries.mockResolvedValue({ items: [PRONUNCIATION_FIXTURE] })
    api.savePronunciationDictionary.mockResolvedValue({ ...PRONUNCIATION_FIXTURE, version_id: `pv_${'d'.repeat(32)}` })
    render(<Scene />)
    fireEvent.click(await screen.findByText('Advanced performance'))
    fireEvent.click(await screen.findByRole('button', { name: 'Use Harbour names' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Harbour names' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Spoken reading 1' }), { target: { value: 'Ay LOR yah' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save new version' }))
    await waitFor(() => expect(api.savePronunciationDictionary).toHaveBeenCalledWith(expect.objectContaining({ expected_version_id: PRONUNCIATION_FIXTURE.version_id }), PRONUNCIATION_FIXTURE.dictionary_id))
    await screen.findByText('Saved version kept')
    expect(screen.getByTestId('saved').textContent).toContain(PRONUNCIATION_FIXTURE.version_id)
    fireEvent.click(screen.getByRole('button', { name: 'Use latest version of Harbour names' }))
    expect(screen.getByTestId('saved').textContent).toContain(`pv_${'d'.repeat(32)}`)
})

it('retains a saved recipe while the feature is disabled', async () => {
    api.getVoicePerformanceCapabilities.mockResolvedValue({ ...PERFORMANCE_CAPABILITIES, available: false })
    render(<VoicePerformancePanel voiceKey={`vk_${'a'.repeat(32)}`} language="en" emotion={null} value={{ version: 1, direction: 'calm', dictionary_refs: [] }} onChange={vi.fn()} />)
    await screen.findByText('Advanced performance is unavailable. Your saved direction and pronunciation versions are kept.')
    expect(api.listPronunciationDictionaries).not.toHaveBeenCalled()
    expect(preview.run).not.toHaveBeenCalled()
})
