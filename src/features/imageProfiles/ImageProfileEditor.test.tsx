import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { ImageProfileMutation } from '@/shared/types/imageProfile.types'
import { ImageProfileEditor } from './ImageProfileEditor'
import { gptDraft, imageCatalog } from './imageProfileFixtures'

function renderEditor(draft: ImageProfileMutation) {
    return render(<ImageProfileEditor open mode="edit" systemAdmin catalog={imageCatalog} draft={draft} propsKey={0} propsValid busy={false}
        error={null} onChange={vi.fn()} onChooseModel={vi.fn()} onPropsValidity={vi.fn()} onSave={vi.fn()} onClose={vi.fn()} />)
}

it('saves a valid draft', () => {
    renderEditor(gptDraft)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
})

it('flags a stored choice the model does not take instead of hiding it', () => {
    renderEditor({ ...gptDraft, settings: { quality: 'ultra' } })
    expect(screen.getByText('This model does not take this value. Pick another one or use the default.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
})

it('flags a name that is not one plain line', () => {
    renderEditor({ ...gptDraft, name: 'GPT\u00A0Flare' })
    expect(screen.getByText('Use plain text on one line, without tabs or special spaces.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
})
