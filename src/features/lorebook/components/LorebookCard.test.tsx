import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Lorebook } from '@/shared'
import type { CardOption } from '@/ui/components'
import { LorebookCard } from './LorebookCard'

const LOREBOOK: Lorebook = {
    id: 'lore-1',
    name: 'Glass Courts',
    description: 'Moonlit court law and old grudges.',
    tags: ['court', 'moon'],
    enabled: true,
    settings: {
        scanDepth: 8,
        tokenBudget: 1200,
        recursiveScanning: false,
        matchWholeWords: true,
        caseSensitive: false,
    },
    entries: [
        {
            id: 'entry-1',
            lorebookId: 'lore-1',
            title: 'Court oath',
            entryType: 'rule',
            content: 'Never bargain under blue glass.',
            keys: ['oath', 'glass'],
            secondaryKeys: [],
            selectiveLogic: 'any',
            enabled: true,
            constant: false,
            caseSensitive: false,
            matchWholeWords: true,
            regex: false,
            isSecret: false,
            insertionOrder: 0,
            priority: 0,
            insertionPosition: 'before_context',
        },
    ],
    attachments: [],
}

describe('LorebookCard', () => {
    it('opens the context menu without opening the card', async () => {
        const onOpen = vi.fn()
        const onEdit = vi.fn()
        const options: CardOption[] = [{ type: 'edit', label: 'Edit', onClick: onEdit }]

        render(<LorebookCard lorebook={LOREBOOK} options={options} onClick={onOpen} />)

        fireEvent.contextMenu(screen.getByTestId('lorebook-card'), { clientX: 72, clientY: 88 })

        const menu = await screen.findByTestId('card-context-menu')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Edit' }))

        expect(onEdit).toHaveBeenCalledTimes(1)
        expect(onOpen).not.toHaveBeenCalled()
    })
})
