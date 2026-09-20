import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '@/infrastructure/api'
import type { CodexEntry } from '../../hooks/useCodex'
import { CodexEntryDrawer } from './CodexEntryDrawer'
import { CodexLorebookPickerDrawer } from './CodexLorebookPickerDrawer'

describe('Codex drawer recovery', () => {
    afterEach(() => vi.restoreAllMocks())

    it('keeps a failed snapshot edit open with its entered content and a visible error', async () => {
        const onClose = vi.fn()
        const entry = { id: 'entry', kind: 'character', label: 'Lyra', description: 'Old text', enabled: true, ref: { snapshot: {} } } as CodexEntry
        render(<CodexEntryDrawer entry={entry} busy={false} onClose={onClose} onSave={async () => { throw new Error('Unable to save this copy.') }} />)
        fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: 'New text' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save this copy.')
        expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('New text')
        expect(onClose).not.toHaveBeenCalled()
    })

    it('distinguishes a lorebook loading failure from an empty search', async () => {
        vi.spyOn(apiService, 'getLorebooks').mockRejectedValue(new Error('Could not load your lorebooks.'))
        render(<CodexLorebookPickerDrawer open busy={false} existingEntryIds={new Set()} onClose={vi.fn()} onClone={async () => {}} />)
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your lorebooks.')
        expect(screen.queryByText('No matching lorebooks')).not.toBeInTheDocument()
    })
})
