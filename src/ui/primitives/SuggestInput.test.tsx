import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SuggestInput, type SuggestInputProps } from './SuggestInput'
import type { SelectOption } from './Select'

const OPTIONS: SelectOption[] = [
    { value: 'Elf', label: 'Elf', description: 'Long-lived and graceful.' },
    { value: 'Dwarf', label: 'Dwarf', description: 'Stone-steady artisans.' },
    { value: 'Human', label: 'Human', description: 'Adaptable and ambitious.' },
]

function renderSuggest(props: Partial<SuggestInputProps> = {}) {
    const onChange = vi.fn()
    render(
        <SuggestInput
            value=""
            onChange={onChange}
            options={OPTIONS}
            aria-label="Race"
            {...props}
        />,
    )
    return { onChange, input: screen.getByRole('combobox', { name: 'Race' }) }
}

describe('SuggestInput', () => {
    it('passes free text through onChange on every keystroke', () => {
        const { onChange, input } = renderSuggest()
        fireEvent.change(input, { target: { value: 'Constru' } })
        expect(onChange).toHaveBeenCalledWith('Constru')
    })

    it('opens suggestions on focus and shows option descriptions', () => {
        const { input } = renderSuggest()
        fireEvent.focus(input)

        expect(screen.getByRole('listbox')).toBeInTheDocument()
        expect(screen.getAllByRole('option')).toHaveLength(3)
        expect(screen.getByText('Stone-steady artisans.')).toBeInTheDocument()
    })

    it('filters options by substring of the typed value', () => {
        const { input } = renderSuggest({ value: 'dwa' })
        fireEvent.focus(input)

        const options = screen.getAllByRole('option')
        expect(options).toHaveLength(1)
        expect(options[0]).toHaveTextContent('Dwarf')
    })

    it('commits the active option with arrow keys + Enter without submitting the form', () => {
        const onSubmit = vi.fn((e) => e.preventDefault())
        const onChange = vi.fn()
        render(
            <form onSubmit={onSubmit}>
                <SuggestInput value="" onChange={onChange} options={OPTIONS} aria-label="Race" />
            </form>,
        )
        const input = screen.getByRole('combobox', { name: 'Race' })
        fireEvent.focus(input)
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        const elfOption = screen.getByRole('option', { name: /Elf/ })
        expect(input).toHaveAttribute('aria-activedescendant', elfOption.id)

        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onChange).toHaveBeenCalledWith('Elf')
        expect(onSubmit).not.toHaveBeenCalled()
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('selects an option on click', () => {
        const { onChange, input } = renderSuggest()
        fireEvent.focus(input)
        fireEvent.click(screen.getByRole('option', { name: /Human/ }))

        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith('Human')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('closes on Escape without reaching outer listeners; passes through when closed', () => {
        const outerKeyDown = vi.fn()
        const onChange = vi.fn()
        render(
            <div onKeyDown={outerKeyDown}>
                <SuggestInput value="" onChange={onChange} options={OPTIONS} aria-label="Race" />
            </div>,
        )
        const input = screen.getByRole('combobox', { name: 'Race' })
        fireEvent.focus(input)
        outerKeyDown.mockClear()

        fireEvent.keyDown(input, { key: 'Escape' })
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(outerKeyDown).not.toHaveBeenCalled()

        fireEvent.keyDown(input, { key: 'Escape' })
        expect(outerKeyDown).toHaveBeenCalledTimes(1)
    })

    it('closes when clicking outside', () => {
        const { input } = renderSuggest()
        fireEvent.focus(input)
        expect(screen.getByRole('listbox')).toBeInTheDocument()

        fireEvent.mouseDown(document.body)
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('renders no listbox when every option is filtered out', () => {
        const { input } = renderSuggest({ value: 'zzz' })
        fireEvent.focus(input)
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
})
