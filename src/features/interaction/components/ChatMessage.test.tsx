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

describe('ChatMessage roleplay formatting', () => {
    it('renders single-tilde actions as actions, not strikethrough', () => {
        const { container } = render(
            <ChatMessage content="~risita~ ¡Hola, hola~! ~se acomoda el pelo~ Pasa." isUser={false} />,
        )
        expect(container.querySelector('del')).toBeNull()
        const actions = [...container.querySelectorAll('em.rp-action')].map((node) => node.textContent)
        expect(actions).toEqual(['risita', 'se acomoda el pelo'])
        // A playful trailing tilde stays as written.
        expect(container).toHaveTextContent('¡Hola, hola~!')
    })

    it('keeps double-tilde strikethrough', () => {
        const { container } = render(<ChatMessage content="It was ~~never~~ finished." isUser={false} />)
        expect(container.querySelector('del')).toHaveTextContent('never')
    })

    it('formats tilde actions inside speech segments too', () => {
        const { container } = render(
            <ChatMessage content="" isUser={false} segments={[{ kind: 'speech', content: '~sonríe~ Hola', speaker_id: 'kai', speaker_name: 'Kai' }]} />,
        )
        expect(container.querySelector('.chat-segment em.rp-action')).toHaveTextContent('sonríe')
    })

    it('drops the repeated speaker header for the only character of a 1:1 chat', () => {
        const segments = [
            { kind: 'speech' as const, content: 'Hola', speaker_id: 'kai', speaker_name: 'Kai' },
            { kind: 'thought' as const, content: 'Qué alto', speaker_id: 'kai', speaker_name: 'Kai' },
        ]
        const { container, rerender } = render(<ChatMessage content="" isUser={false} segments={segments} />)
        expect(container).toHaveTextContent('KaiHola')
        rerender(<ChatMessage content="" isUser={false} segments={segments} soloSpeakerId="kai" />)
        expect(container).not.toHaveTextContent('KaiHola')
        // Thoughts keep their label: it marks them as unspoken.
        expect(container).toHaveTextContent('Kai thinks')
    })
})
