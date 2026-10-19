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

    it('labels a continuous speaker once and restores attribution after a speaker, kind or scene change', () => {
        const { getAllByText, getByText } = render(<ChatMessage content="" isUser={false} segments={[
            { kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'The bridge is damaged.' },
            { kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'We should inspect the stones.' },
            { kind: 'speech', speaker_id: 'bram', speaker_name: 'Bram', content: 'I will check the bank.' },
            { kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'Wait for the current to slow.' },
            { kind: 'thought', speaker_id: 'aria', speaker_name: 'Aria', content: 'Something feels wrong.' },
            { kind: 'thought', speaker_id: 'aria', speaker_name: 'Aria', content: 'Where are the birds?' },
            { kind: 'narrator', content: 'A branch drifts past.' },
            { kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'There is our clue.' },
        ]} />)
        expect(getAllByText('Aria', { exact: true })).toHaveLength(3)
        expect(getAllByText('Bram', { exact: true })).toHaveLength(1)
        expect(getAllByText('Aria thinks', { exact: true })).toHaveLength(1)
        for (const text of [
            'The bridge is damaged.', 'We should inspect the stones.', 'I will check the bank.',
            'Wait for the current to slow.', 'Something feels wrong.', 'Where are the birds?',
            'A branch drifts past.', 'There is our clue.',
        ]) expect(getByText(text, { exact: true })).toBeVisible()
    })
})

describe('ChatMessage JSON presentation', () => {
    it('preserves paragraphs in every kind and makes thought an explicit label', () => {
        const { container } = render(<ChatMessage content="" isUser={false} segments={[
            { kind: 'narrator', content: 'First scene.\n\nSecond scene.' },
            { kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'One **important** word.\n\nAnother paragraph.' },
            { kind: 'thought', speaker_id: 'aria', speaker_name: 'Aria', content: 'Unspoken.\n\nStill unspoken.' },
        ]} />)
        expect(container.querySelectorAll('p')).toHaveLength(6)
        expect(container.querySelector('strong')).toHaveTextContent('important')
        expect(container.querySelector('strong')).not.toHaveClass('rp-thought')
        expect(container).toHaveTextContent('Aria thinks')
        expect(container.textContent).not.toContain('(important)')
    })

    it('keeps inline artifacts inline and unsupported blocks readable', () => {
        const { container } = render(<ChatMessage content={'A `silver key` rests here.\n\n```text\nAn old inscription\n```'} isUser={false} />)
        expect(container.querySelector('p > code')).toHaveTextContent('silver key')
        expect(container.querySelector('.markdown-code-block')).toBeNull()
        expect(container).toHaveTextContent('An old inscription')
    })

    it('does not load media, create navigation or generate task/table controls from prose', () => {
        const { container } = render(<ChatMessage isUser={false} content={[
            '![A readable bird](https://outside.invalid/bird.png)',
            '[The gate](https://outside.invalid/)',
            '<iframe src="https://outside.invalid/"></iframe>',
            '- [x] Read this',
            '| A | B |\n| - | - |\n| one | two |',
        ].join('\n\n')} />)
        expect(container.querySelector('img,a,iframe,input,table')).toBeNull()
        expect(container).toHaveTextContent('A readable bird')
        expect(container).toHaveTextContent('The gate')
        expect(container).toHaveTextContent('Read this')
        expect(container).toHaveTextContent('one')
    })

    it('styles an unfinished emphasis/code tail without changing the underlying text', () => {
        const { container, rerender } = render(<ChatMessage isUser={false} isStreaming content="Look **closely" />)
        const paragraph = container.querySelector('p')
        expect(container.querySelector('strong')).toHaveTextContent('closely')
        expect(container.textContent).not.toContain('**')
        rerender(<ChatMessage isUser={false} content="Look **closely**." />)
        expect(container.querySelector('p')).toBe(paragraph)
        expect(container).toHaveTextContent('Look closely.')
    })

    it('keeps settled DOM nodes while later segments grow and complete', () => {
        const first = { kind: 'narrator' as const, content: 'A settled paragraph.' }
        const active = { kind: 'speech' as const, speaker_id: 'aria', speaker_name: 'Aria', content: 'Hello', streaming: true }
        const { container, rerender } = render(<ChatMessage isUser={false} isStreaming content="" segments={[first, active]} />)
        const settled = container.querySelector('p')
        rerender(<ChatMessage isUser={false} isStreaming content="" segments={[first, { ...active, content: 'Hello again' }]} />)
        expect(container.querySelector('p')).toBe(settled)
        rerender(<ChatMessage isUser={false} content="" segments={[{ ...first }, { ...active, content: 'Hello again.', streaming: undefined }]} />)
        expect(container.querySelector('p')).toBe(settled)
    })
})
