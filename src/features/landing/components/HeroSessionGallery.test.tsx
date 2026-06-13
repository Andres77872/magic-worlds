import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ResumeSession } from './resumeModel'
import { HeroSessionGallery } from './HeroSessionGallery'

// jsdom ships no Element.prototype.scrollTo; paging calls would throw without it.
const scrollToSpy = vi.fn()
const originalScrollTo = Element.prototype.scrollTo

beforeAll(() => {
    Element.prototype.scrollTo = scrollToSpy as unknown as Element['scrollTo']
})

afterAll(() => {
    Element.prototype.scrollTo = originalScrollTo
})

function session(overrides: Partial<ResumeSession>): ResumeSession {
    return {
        kind: 'adventure',
        id: 'a1',
        title: 'The Hollow Wood Vigil',
        context: 'The Hollow Wood',
        snippet: 'The lantern gutters as the path bends between black pines.',
        meta: '4 turns · 2h ago',
        updatedAtMs: 0,
        source: { id: 'a1' } as ResumeSession['source'],
        ...overrides,
    }
}

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('HeroSessionGallery', () => {
    it('caps the banner to the 10 most recent sessions it receives', () => {
        const sessions = Array.from({ length: 12 }, (_, index) =>
            session({ id: `a${index}`, title: `Recent session ${index}` }),
        )

        render(<HeroSessionGallery sessions={sessions} onOpen={vi.fn()} onBeginNew={vi.fn()} />)

        expect(screen.getAllByTestId('hero-session-slide')).toHaveLength(10)
        expect(screen.queryByText('Recent session 10')).toBeNull()
    })

    it('uses adventure and chat specific resume actions', () => {
        const onOpen = vi.fn()
        const adventure = session({ id: 'a1', kind: 'adventure', title: 'A grand gathering' })
        const chat = session({
            id: 'c1',
            kind: 'chat',
            title: 'Theron Mistwood',
            context: 'wizard',
            meta: '2 messages · 1d ago',
        })

        render(<HeroSessionGallery sessions={[adventure, chat]} onOpen={onOpen} onBeginNew={vi.fn()} />)

        expect(screen.getByText('Adventure')).toBeTruthy()
        expect(screen.getByText('Chat')).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: 'Continue the tale' }))
        expect(onOpen).toHaveBeenCalledWith(adventure)

        fireEvent.click(screen.getByRole('button', { name: 'Resume chat' }))
        expect(onOpen).toHaveBeenCalledWith(chat)
    })

    it('hides carousel controls for a single session', () => {
        render(<HeroSessionGallery sessions={[session({})]} onOpen={vi.fn()} onBeginNew={vi.fn()} />)

        expect(screen.queryByLabelText('Previous recent session')).toBeNull()
        expect(screen.queryByLabelText('Next recent session')).toBeNull()
        expect(screen.queryByTestId('hero-session-dot')).toBeNull()
    })

    it('renders one pagination dot per slide with the first active', () => {
        const sessions = Array.from({ length: 3 }, (_, index) =>
            session({ id: `a${index}`, title: `Recent session ${index}` }),
        )

        render(<HeroSessionGallery sessions={sessions} onOpen={vi.fn()} onBeginNew={vi.fn()} />)

        const dots = screen.getAllByTestId('hero-session-dot')
        expect(dots).toHaveLength(3)
        expect(dots[0].getAttribute('aria-current')).toBe('true')
        expect(dots[1].getAttribute('aria-current')).toBeNull()
        expect(screen.getByLabelText('Go to slide 2 of 3')).toBe(dots[1])
    })

    it('pages by exactly one slide via chevrons and dots', () => {
        const sessions = Array.from({ length: 3 }, (_, index) =>
            session({ id: `a${index}`, title: `Recent session ${index}` }),
        )

        render(<HeroSessionGallery sessions={sessions} onOpen={vi.fn()} onBeginNew={vi.fn()} />)

        expect(screen.getByLabelText('Previous recent session')).toHaveProperty('disabled', true)

        fireEvent.click(screen.getByLabelText('Next recent session'))
        expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ left: expect.any(Number) }))

        fireEvent.click(screen.getByLabelText('Go to slide 3 of 3'))
        expect(scrollToSpy).toHaveBeenCalledTimes(2)
    })

    it('moves the active dot as the scroller settles on a new slide', () => {
        const sessions = Array.from({ length: 2 }, (_, index) =>
            session({ id: `a${index}`, title: `Recent session ${index}` }),
        )

        render(<HeroSessionGallery sessions={sessions} onOpen={vi.fn()} onBeginNew={vi.fn()} />)

        const scroller = screen.getByRole('list')
        const [first, second] = Array.from(scroller.children) as HTMLElement[]
        Object.defineProperty(first, 'offsetLeft', { value: 0 })
        Object.defineProperty(second, 'offsetLeft', { value: 1016 })
        Object.defineProperty(scroller, 'scrollLeft', { value: 1016, writable: true })

        fireEvent.scroll(scroller)

        const dots = screen.getAllByTestId('hero-session-dot')
        expect(dots[0].getAttribute('aria-current')).toBeNull()
        expect(dots[1].getAttribute('aria-current')).toBe('true')
    })
})
