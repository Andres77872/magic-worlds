import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { FishInventoryPanel } from './FishInventoryPanel'

const api = vi.hoisted(() => ({ getFishInventory: vi.fn(), getFishReferences: vi.fn(), importFishReference: vi.fn() }))
vi.mock('@/infrastructure/api', () => ({ apiService: api }))

beforeEach(() => {
    api.getFishInventory.mockReset().mockResolvedValue({ items: [] })
    api.getFishReferences.mockReset().mockResolvedValue({ items: [], next_page: null })
    api.importFishReference.mockReset().mockRejectedValue(new Error('Unavailable'))
})

it('requires reference rights and retains the complete draft after an import failure', async () => {
    const imported = vi.fn()
    render(<FishInventoryPanel onImported={imported} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add an existing Fish voice' }))
    expect(screen.getByRole('button', { name: 'Import draft' })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Fish reference ID' }), { target: { value: 'a'.repeat(32) } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Catalog name' }), { target: { value: 'Lantern keeper' } })
    expect(screen.getByRole('button', { name: 'Import draft' })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Rights review record' }), { target: { value: 'rights-review-2026-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import draft' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('textbox', { name: 'Catalog name' })).toHaveValue('Lantern keeper')
    expect(screen.getByRole('textbox', { name: 'Rights review record' })).toHaveValue('rights-review-2026-10')
    expect(imported).not.toHaveBeenCalled()
    api.importFishReference.mockResolvedValue({ voice_key: 'vk_' + 'b'.repeat(32) })
    fireEvent.click(screen.getByRole('button', { name: 'Import draft' }))
    await waitFor(() => expect(imported).toHaveBeenCalledOnce())
    expect(api.importFishReference).toHaveBeenLastCalledWith(expect.objectContaining({ source_kind: 'owned_reference', rights_reference: 'rights-review-2026-10' }))
})

it('reads inventory only on request and explains an unavailable provider', async () => {
    api.getFishInventory.mockRejectedValue(new Error('Not configured'))
    render(<FishInventoryPanel onImported={vi.fn()} />)
    expect(api.getFishInventory).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Add an existing Fish voice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Read owned inventory' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Read owned inventory' })).toBeEnabled()
})

it('browses distinct Spanish identities, deduplicates pages and imports the selected licensed voice', async () => {
    const gabriel = { provider_voice_id: 'a'.repeat(32), display_name: 'Gabriel', languages: ['es'], licensed: true, available: true }
    const serena = { ...gabriel, provider_voice_id: 'c'.repeat(32), display_name: 'Serena' }
    api.getFishReferences.mockResolvedValueOnce({ items: [gabriel], next_page: 2 })
        .mockResolvedValueOnce({ items: [gabriel, serena], next_page: null })
    api.importFishReference.mockResolvedValue({ voice_key: 'vk_' + 'b'.repeat(32) })
    render(<FishInventoryPanel onImported={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add an existing Fish voice' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Primary language' }))
    fireEvent.click(screen.getByRole('option', { name: 'Español' }))
    fireEvent.click(screen.getByRole('button', { name: 'Browse licensed voices' }))
    await screen.findByRole('button', { name: 'Load more voices' })
    expect(api.getFishReferences).toHaveBeenLastCalledWith('es', '', 1)
    fireEvent.click(screen.getByRole('button', { name: 'Load more voices' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more voices' })).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('combobox', { name: 'Licensed voice' }))
    await screen.findByRole('option', { name: 'Serena' })
    expect(api.getFishReferences).toHaveBeenLastCalledWith('es', '', 2)
    expect(screen.getAllByRole('option', { name: 'Gabriel' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Load more voices' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: 'Serena' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Rights review record' }), { target: { value: 'licensed-development-review' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import draft' }))
    await waitFor(() => expect(api.importFishReference).toHaveBeenCalledWith({
        provider_voice_id: serena.provider_voice_id, display_name: 'Serena', primary_language: 'es',
        source_kind: 'licensed_reference', rights_reference: 'licensed-development-review',
    }))
})

it('clears stale voice selections when changing the language or search', async () => {
    api.getFishReferences.mockResolvedValue({ items: [{ provider_voice_id: 'a'.repeat(32), display_name: 'Dave', available: true }], next_page: null })
    render(<FishInventoryPanel onImported={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add an existing Fish voice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Browse licensed voices' }))
    fireEvent.click(await screen.findByRole('combobox', { name: 'Licensed voice' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Dave' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Voice name' }), { target: { value: 'Sofiah' } })
    expect(screen.getByRole('textbox', { name: 'Fish reference ID' })).toHaveValue('')
    expect(screen.queryByRole('combobox', { name: 'Licensed voice' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Browse licensed voices' }))
    await waitFor(() => expect(api.getFishReferences).toHaveBeenLastCalledWith('en', 'Sofiah', 1))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Primary language' })).toBeEnabled())
    fireEvent.click(screen.getByRole('combobox', { name: 'Primary language' }))
    fireEvent.click(screen.getByRole('option', { name: 'Español' }))
    expect(screen.queryByRole('combobox', { name: 'Licensed voice' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Fish reference ID' })).toHaveValue('')
})
