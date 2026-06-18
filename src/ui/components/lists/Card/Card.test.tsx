import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Card } from './Card'
import type { CardOption } from './CardOptions'

describe('Card', () => {
    it('opens a context menu without firing the primary card action', async () => {
        const onOpen = vi.fn()
        const onDelete = vi.fn()
        const options: CardOption[] = [{ type: 'delete', label: 'Delete', onClick: onDelete }]

        render(
            <Card title="Lyra Dawnwhisper" options={options} onClick={onOpen}>
                <p>Half-elf bard</p>
            </Card>,
        )

        fireEvent.contextMenu(screen.getByTestId('card'), { clientX: 42, clientY: 64 })

        const menu = await screen.findByTestId('card-context-menu')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete' }))

        expect(onDelete).toHaveBeenCalledTimes(1)
        expect(onOpen).not.toHaveBeenCalled()
    })

    it('opens a context menu from the keyboard even without a primary card action', async () => {
        const onEdit = vi.fn()
        const options: CardOption[] = [{ type: 'edit', label: 'Edit', onClick: onEdit }]

        render(<Card title="Lyra Dawnwhisper" options={options} />)

        const card = screen.getByTestId('card')
        card.focus()
        fireEvent.keyDown(card, { key: 'ContextMenu' })

        const menu = await screen.findByTestId('card-context-menu')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Edit' }))

        expect(onEdit).toHaveBeenCalledTimes(1)
    })
})
