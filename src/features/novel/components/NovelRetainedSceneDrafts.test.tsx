import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { manuscript } from '@/test/fixtures/story'
import type { RetainedSceneDraft } from '../persistence/retainedSceneDrafts'
import { NovelRetainedSceneDrafts } from './NovelRetainedSceneDrafts'
const download = vi.hoisted(() => vi.fn())
vi.mock('@/utils/download', async (original) => ({ ...await original<typeof import('@/utils/download')>(), downloadBlob: download }))
const item: RetainedSceneDraft = { schema: 1, title: 'The gate', document: manuscript('Preserved device prose 🦋'), baseRevision: 3, baseMetadataRevision: 2, reason: 'reconciliation', retainedAt: 100, storageKey: 'author-copy' }
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
beforeEach(() => vi.clearAllMocks())
afterEach(() => { if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor); else Reflect.deleteProperty(navigator, 'clipboard') })

it('keeps original canonical recovery download and manual copy reachable without a discard action', () => {
    render(<NovelRetainedSceneDrafts items={[item]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download recovery JSON' }))
    expect(download).toHaveBeenCalledWith(expect.any(Blob), 'The-gate.device-draft.json')
    fireEvent.click(screen.getByRole('button', { name: 'Show copyable manuscript' }))
    expect(screen.getByRole('textbox', { name: 'Copyable device manuscript' })).toHaveValue('Preserved device prose 🦋')
    expect(screen.queryByRole('button', { name: /delete|discard|remove/i })).toBeNull()
})

it('falls back to selectable manuscript text when clipboard permission is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } })
    render(<NovelRetainedSceneDrafts items={[item]} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy manuscript' })) })
    expect(screen.getByRole('status')).toHaveTextContent('Select and copy the manuscript below')
    expect(screen.getByRole('textbox', { name: 'Copyable device manuscript' })).toHaveAttribute('readonly')
})

it('does not expose old-account details after the scoped copies change', () => {
    const view = render(<NovelRetainedSceneDrafts items={[item]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show copyable manuscript' }))
    view.rerender(<NovelRetainedSceneDrafts items={[{ ...item, title: 'Another account', storageKey: 'another-copy', document: manuscript('Another author') }]} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText('Preserved device prose 🦋')).toBeNull()
})

it('reports unreadable storage while preserving the recovery surface', () => {
    render(<NovelRetainedSceneDrafts items={[]} unavailable />)
    expect(screen.getByRole('alert')).toHaveTextContent('Existing records have been preserved')
})
