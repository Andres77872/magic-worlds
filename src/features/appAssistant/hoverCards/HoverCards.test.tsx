import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FocusRef } from '../appKnowledge'
import { AssistantMarkdown } from '@/features/creation/common/components/assistant/AssistantMarkdown'
import { AssistantLinkContext } from '@/features/creation/common/components/assistant/assistantLinkContext'
import { fetchCardPreview } from '@/features/cards/cardPreview'
import { ApiError } from '@/infrastructure/api'
import { resetHoverCardCaches } from './hoverCardCache'
import { HOVER_TIMING } from './hoverCardController'
import { HOVER_CARD_REPLY, hoverCardLibrary } from './hoverCardFixtures'
import { HoverCardLink } from './HoverCardLink'
import { HoverCardsProvider, type HoverCardsProviderProps } from './HoverCardsProvider'

vi.mock('@/features/cards/cardPreview', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/features/cards/cardPreview')>()),
    fetchCardPreview: vi.fn(),
}))

const fetchPreview = vi.mocked(fetchCardPreview)

function renderThread(overrides: Partial<HoverCardsProviderProps> = {}) {
    const props: Omit<HoverCardsProviderProps, 'children'> = {
        library: hoverCardLibrary,
        focus: [],
        focusLimit: 6,
        focusBusy: false,
        focusTokens: () => 420,
        onToggleFocus: vi.fn(),
        onOpen: vi.fn(),
        ...overrides,
    }
    const view = render(
        <HoverCardsProvider {...props}>
            <AssistantLinkContext.Provider value={HoverCardLink}>
                <AssistantMarkdown content={HOVER_CARD_REPLY} />
            </AssistantLinkContext.Provider>
        </HoverCardsProvider>,
    )
    return { ...view, props }
}

const wait = (ms: number) => act(() => {
    vi.advanceTimersByTime(ms)
})

function hover(element: Element) {
    fireEvent.pointerEnter(element, { pointerType: 'mouse' })
}

function link(name: string, index = 0): HTMLElement {
    return screen.getAllByRole('link', { name: new RegExp(`^${name}`) })[index]
}

async function openCard(name: string, index = 0): Promise<HTMLElement> {
    hover(link(name, index))
    await wait(HOVER_TIMING.openDelay)
    return screen.getByRole('dialog', { name: new RegExp(name) })
}

describe('assistant hover cards', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        fetchPreview.mockReset()
    })

    afterEach(() => {
        vi.useRealTimers()
        resetHoverCardCaches()
    })

    it('leaves links plain outside the provider', () => {
        render(<AssistantMarkdown content={HOVER_CARD_REPLY} />)
        const anchor = screen.getByRole('link', { name: 'Lyra Brisaveloz' })
        expect(anchor).not.toHaveAttribute('data-hover-link')
        expect(anchor).toHaveAttribute('href', '#/gallery/characters?card=c-lyra')
    })

    it('opens a library card on hover without any request', async () => {
        renderThread()
        expect(link('Lyra Brisaveloz')).toHaveAttribute('data-hover-link', 'character')
        const card = await openCard('Lyra Brisaveloz')
        expect(within(card).getByText('Elf · Scout')).toBeInTheDocument()
        expect(within(card).getByText(/Character · v3/i)).toBeInTheDocument()
        expect(within(card).getByRole('button', { name: 'Focus' })).toHaveAttribute('aria-pressed', 'false')
        expect(link('Lyra Brisaveloz')).toHaveAttribute('aria-describedby', card.id)
        expect(fetchPreview).not.toHaveBeenCalled()
    })

    it('ignores touch pointers (a tap keeps opening the full preview)', async () => {
        renderThread()
        fireEvent.pointerEnter(link('Lyra Brisaveloz'), { pointerType: 'touch' })
        await wait(2000)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('tells the two Kai cards apart', async () => {
        renderThread()
        const spanish = await openCard('Kai', 0)
        expect(within(spanish).getByText(/Versión en español/)).toBeInTheDocument()
        hover(link('Kai', 1))
        await wait(0)
        expect(screen.getByRole('dialog', { name: 'Kai' })).toHaveTextContent('English edition')
    })

    it('closes after the grace period unless it has locked', async () => {
        renderThread()
        await openCard('Theron Mistwood')
        fireEvent.pointerLeave(link('Theron Mistwood'), { pointerType: 'mouse' })
        await wait(HOVER_TIMING.closeGrace)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        await openCard('Theron Mistwood')
        await wait(HOVER_TIMING.lockAfter)
        fireEvent.pointerLeave(link('Theron Mistwood'), { pointerType: 'mouse' })
        await wait(2000)
        expect(screen.getByRole('dialog', { name: 'Theron Mistwood' })).toHaveTextContent('Locked open')
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('nests a card for a library name inside the description', async () => {
        renderThread()
        const outer = await openCard('Lyra Brisaveloz')
        await wait(HOVER_TIMING.lockAfter)
        const nested = within(outer).getByRole('link', { name: 'Aerindor' })
        expect(nested).toHaveAttribute('href', '#/gallery/worlds?card=w-aerindor')
        hover(nested)
        await wait(HOVER_TIMING.openDelay)
        expect(screen.getAllByRole('dialog')).toHaveLength(2)
        expect(screen.getByRole('dialog', { name: 'Aerindor' })).toHaveTextContent('Floating forest')
    })

    it('pins a card to focus and shows when it is already there', async () => {
        const onToggleFocus = vi.fn()
        const { rerender, props } = renderThread({ onToggleFocus })
        const card = await openCard('Dan')
        fireEvent.click(within(card).getByRole('button', { name: 'Focus' }))
        expect(onToggleFocus).toHaveBeenCalledWith({ kind: 'persona', id: 'p-dan' })

        const focus: FocusRef[] = [{ kind: 'character', id: 'p-dan' }]
        rerender(
            <HoverCardsProvider {...props} focus={focus}>
                <AssistantLinkContext.Provider value={HoverCardLink}>
                    <AssistantMarkdown content={HOVER_CARD_REPLY} />
                </AssistantLinkContext.Provider>
            </HoverCardsProvider>,
        )
        expect(within(card).getByRole('button', { name: 'In focus' })).toHaveAttribute('aria-pressed', 'true')
        expect(link('Dan')).toHaveTextContent('(In focus)')
    })

    it('blocks focus changes while a reply streams', async () => {
        renderThread({ focusBusy: true })
        const card = await openCard('Lyra Brisaveloz')
        const button = within(card).getByRole('button', { name: 'Focus' })
        expect(button).toBeDisabled()
        expect(button.parentElement).toHaveAttribute('title', 'Focus can change once the reply finishes.')
    })

    it('opens the record and closes the chain', async () => {
        const onOpen = vi.fn()
        renderThread({ onOpen })
        const card = await openCard('Aetheric Resonance')
        expect(card).toHaveTextContent('8 entries')
        fireEvent.click(within(card).getByRole('button', { name: 'Open' }))
        expect(onOpen).toHaveBeenCalledWith({ kind: 'lorebook', id: 'l-resonance' })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('fetches a card missing from the library once and remembers that it is gone', async () => {
        fetchPreview.mockRejectedValue(new ApiError(404, 'Not found'))
        renderThread()
        const card = await openCard('Kai \\(old draft\\)')
        await act(async () => {})
        expect(card).toHaveTextContent("This isn't in your library anymore")
        expect(card).toHaveTextContent('Checked once, remembered for this session')
        expect(within(card).queryByRole('button', { name: 'Focus' })).not.toBeInTheDocument()
        fireEvent.keyDown(document, { key: 'Escape' })
        await openCard('Kai \\(old draft\\)')
        expect(fetchPreview).toHaveBeenCalledTimes(1)
    })

    it('retries a failed request from the card', async () => {
        fetchPreview.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockRejectedValueOnce(new ApiError(404, 'Not found'))
        renderThread()
        const card = await openCard('Kai \\(old draft\\)')
        await act(async () => {})
        expect(card).toHaveTextContent("Couldn't load this card.")
        fireEvent.click(within(card).getByRole('button', { name: 'Retry' }))
        await act(async () => {})
        expect(fetchPreview).toHaveBeenCalledTimes(2)
        expect(card).toHaveTextContent("This isn't in your library anymore")
    })

    it('keeps a dragged card open until its close button', async () => {
        renderThread()
        const card = await openCard('Elara Frostveil')
        const handle = within(card).getByRole('button', { name: 'Move card. Dragging keeps it open.' })
        fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 20, clientY: 20 })
        fireEvent.pointerMove(handle, { pointerId: 1, clientX: 60, clientY: 50 })
        fireEvent.pointerUp(handle, { pointerId: 1, clientX: 60, clientY: 50 })

        fireEvent.keyDown(document, { key: 'Escape' })
        fireEvent.pointerDown(document.body)
        hover(link('Theron Mistwood'))
        await wait(HOVER_TIMING.openDelay)
        expect(screen.getAllByRole('dialog')).toHaveLength(2)

        fireEvent.click(within(card).getByRole('button', { name: 'Close card' }))
        expect(screen.queryByRole('dialog', { name: 'Elara Frostveil' })).not.toBeInTheDocument()
        expect(screen.getByRole('dialog', { name: 'Theron Mistwood' })).toBeInTheDocument()
    })
})
