import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LorebookEntry } from '@/shared'
import type { TriggerMatch } from '../loreTriggers'
import { LoreTriggerMark } from './LoreTriggerMark'

const openWindow = vi.fn()

vi.mock('@/app/hooks', () => ({
    useFloatingWindows: () => ({ openWindow, closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
}))

const ENTRY: LorebookEntry = {
    id: 'entry-1',
    lorebookId: 'lb-1',
    title: 'Iron Citadel',
    entryType: 'place',
    content: 'A fortress of black iron.',
    keys: ['Iron Citadel'],
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
}

const MATCH: TriggerMatch = { start: 0, end: 12, keyword: 'Iron Citadel', entry: ENTRY, lorebookName: 'Glass Courts' }

describe('LoreTriggerMark', () => {
    beforeEach(() => vi.clearAllMocks())

    it('opens the entry floating card on Ctrl/Cmd-click', () => {
        render(<LoreTriggerMark match={MATCH} />)
        fireEvent.click(screen.getByText('Iron Citadel'), { ctrlKey: true })
        expect(openWindow).toHaveBeenCalledTimes(1)
        expect(openWindow).toHaveBeenCalledWith(
            expect.objectContaining({
                dedupKey: 'loreEntry:entry-1',
                content: expect.objectContaining({ kind: 'loreEntry', entry: ENTRY }),
            }),
        )
    })

    it('does not open on a plain (unmodified) click', () => {
        render(<LoreTriggerMark match={MATCH} />)
        fireEvent.click(screen.getByText('Iron Citadel'))
        expect(openWindow).not.toHaveBeenCalled()
    })
})
