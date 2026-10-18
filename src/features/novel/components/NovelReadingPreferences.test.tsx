import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { DEFAULT_READING } from '../utils/readingPreferences'
import { NovelReadingPreferences } from './NovelReadingPreferences'

function Demo() {
    const [value, setValue] = useState(DEFAULT_READING)
    const [open, setOpen] = useState(true)
    return <NovelReadingPreferences open={open} onClose={() => setOpen(false)} value={value} onChange={setValue} storageUnavailable />
}
function choose(field: string, option: string) {
    fireEvent.click(screen.getByRole('combobox', { name: field }))
    fireEvent.click(screen.getByRole('option', { name: option }))
}

it('offers labeled presets/custom controls, announces session-only storage and resets only display choices', async () => {
    render(<Demo />)
    expect(screen.getByRole('status')).toHaveTextContent('Your choices work while this reading room is open')
    choose('Reading preset', 'Close reading')
    expect(screen.getByRole('combobox', { name: 'Prose font' })).toHaveTextContent('Sans serif')
    expect(screen.getByRole('combobox', { name: 'Text size' })).toHaveTextContent('Large')
    expect(screen.getByRole('combobox', { name: 'Reading width' })).toHaveTextContent('Narrow')
    choose('Reading width', 'Wide')
    expect(screen.getByRole('combobox', { name: 'Reading preset' })).toHaveTextContent('Custom')
    fireEvent.click(screen.getByRole('button', { name: 'Reset reading preferences' }))
    expect(screen.getByRole('combobox', { name: 'Reading preset' })).toHaveTextContent('Literary')
    expect(screen.getByRole('dialog', { name: 'Reading preferences' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Reading preferences' })).not.toBeInTheDocument())
})
