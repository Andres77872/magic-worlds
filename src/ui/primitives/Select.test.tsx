import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Select, type SelectOption } from './Select'

const OPTIONS: SelectOption[] = [
    { value: 'character', label: 'Character' },
    { value: 'world', label: 'World' },
    { value: 'faction', label: 'Faction', disabled: true },
    { value: 'secret', label: 'Secret' },
]

function renderSelect(props: Partial<Parameters<typeof Select>[0]> = {}) {
    const onChange = vi.fn()
    render(
        <Select
            options={OPTIONS}
            value="character"
            onChange={onChange}
            aria-label="Entry type"
            {...props}
        />,
    )
    return { onChange, trigger: screen.getByRole('combobox', { name: 'Entry type' }) }
}

describe('Select', () => {
    it('shows the selected label and opens a listbox on click', () => {
        const { trigger } = renderSelect()
        expect(trigger).toHaveTextContent('Character')
        expect(trigger).toHaveAttribute('aria-expanded', 'false')

        fireEvent.click(trigger)

        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        const listbox = screen.getByRole('listbox')
        expect(listbox).toBeInTheDocument()
        expect(screen.getAllByRole('option')).toHaveLength(4)
        expect(screen.getByRole('option', { name: 'Character' })).toHaveAttribute('aria-selected', 'true')
    })

    it('moves the active option with arrow keys and commits with Enter', () => {
        const { onChange, trigger } = renderSelect()
        fireEvent.click(trigger)

        fireEvent.keyDown(trigger, { key: 'ArrowDown' })
        const worldOption = screen.getByRole('option', { name: 'World' })
        expect(trigger).toHaveAttribute('aria-activedescendant', worldOption.id)

        fireEvent.keyDown(trigger, { key: 'Enter' })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith('world')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(trigger).toHaveFocus()
    })

    it('skips disabled options during keyboard navigation', () => {
        const { trigger } = renderSelect()
        fireEvent.click(trigger)

        fireEvent.keyDown(trigger, { key: 'ArrowDown' })  // -> World
        fireEvent.keyDown(trigger, { key: 'ArrowDown' })  // skips Faction -> Secret
        const secretOption = screen.getByRole('option', { name: 'Secret' })
        expect(trigger).toHaveAttribute('aria-activedescendant', secretOption.id)
    })

    it('selects an option on click without firing extra changes', () => {
        const { onChange, trigger } = renderSelect()
        fireEvent.click(trigger)

        fireEvent.click(screen.getByRole('option', { name: 'Secret' }))

        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith('secret')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('ignores clicks on disabled options', () => {
        const { onChange, trigger } = renderSelect()
        fireEvent.click(trigger)

        fireEvent.click(screen.getByRole('option', { name: 'Faction' }))

        expect(onChange).not.toHaveBeenCalled()
        expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('closes on Escape without changing the value or reaching outer listeners', () => {
        const outerKeyDown = vi.fn()
        const onChange = vi.fn()
        render(
            <div onKeyDown={outerKeyDown}>
                <Select options={OPTIONS} value="character" onChange={onChange} aria-label="Entry type" />
            </div>,
        )
        const trigger = screen.getByRole('combobox', { name: 'Entry type' })
        fireEvent.click(trigger)
        outerKeyDown.mockClear()

        fireEvent.keyDown(trigger, { key: 'Escape' })

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(onChange).not.toHaveBeenCalled()
        expect(outerKeyDown).not.toHaveBeenCalled()

        // With the popup closed, Escape passes through to outer listeners.
        fireEvent.keyDown(trigger, { key: 'Escape' })
        expect(outerKeyDown).toHaveBeenCalledTimes(1)
    })

    it('jumps to a matching option via type-ahead', () => {
        const { trigger } = renderSelect()
        fireEvent.click(trigger)

        fireEvent.keyDown(trigger, { key: 's' })
        const secretOption = screen.getByRole('option', { name: 'Secret' })
        expect(trigger).toHaveAttribute('aria-activedescendant', secretOption.id)
    })

    it('opens on type-ahead from a closed state', () => {
        const { trigger } = renderSelect()
        fireEvent.keyDown(trigger, { key: 'w' })

        expect(screen.getByRole('listbox')).toBeInTheDocument()
        const worldOption = screen.getByRole('option', { name: 'World' })
        expect(trigger).toHaveAttribute('aria-activedescendant', worldOption.id)
    })

    it('closes when clicking outside', () => {
        const { trigger } = renderSelect()
        fireEvent.click(trigger)
        expect(screen.getByRole('listbox')).toBeInTheDocument()

        fireEvent.mouseDown(document.body)

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('renders the placeholder when no value is set and respects disabled', () => {
        const onChange = vi.fn()
        render(
            <Select
                options={OPTIONS}
                value={undefined}
                onChange={onChange}
                placeholder="Pick a type…"
                disabled
                aria-label="Entry type"
            />,
        )
        const trigger = screen.getByRole('combobox', { name: 'Entry type' })
        expect(trigger).toHaveTextContent('Pick a type…')
        expect(trigger).toBeDisabled()

        fireEvent.click(trigger)
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
})
