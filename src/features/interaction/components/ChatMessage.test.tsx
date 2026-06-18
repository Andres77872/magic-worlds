import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LorebookEntry } from '@/shared'
import { buildTriggerMatcher } from '@/features/lorebook'
import { ChatMessage } from './ChatMessage'

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
    keys: ['Citadel'],
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

const matcher = buildTriggerMatcher([{ entry: ENTRY, lorebookId: 'lb-1', lorebookName: 'Glass Courts' }])

describe('ChatMessage lore trigger marking', () => {
    beforeEach(() => vi.clearAllMocks())

    it('marks a trigger inside AI markdown (via rehype) and opens it on Ctrl/Cmd-click', () => {
        const { container } = render(
            <ChatMessage content="The **Citadel** stands tall." isUser={false} loreMatcher={matcher} />,
        )
        const mark = container.querySelector('.lore-trigger')
        expect(mark).not.toBeNull()
        expect(mark).toHaveTextContent('Citadel')

        fireEvent.click(mark!, { ctrlKey: true })
        expect(openWindow).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.objectContaining({ kind: 'loreEntry', entry: ENTRY }) }),
        )
    })

    it('marks a trigger in a plain user turn', () => {
        const { container } = render(
            <ChatMessage content="I enter the Citadel." isUser loreMatcher={matcher} />,
        )
        expect(container.querySelector('.lore-trigger')).toHaveTextContent('Citadel')
    })

    it('renders no marks when there is no matcher', () => {
        const { container } = render(<ChatMessage content="The Citadel stands." isUser={false} />)
        expect(container.querySelector('.lore-trigger')).toBeNull()
    })
})
