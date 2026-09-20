import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreatorStudio } from './CreatorStudio'

afterEach(() => vi.unstubAllGlobals())

describe('CreatorStudio pinned navigation', () => {
    it('covers scrolled content at the observer boundary, including positive viewport coordinates', () => {
        let notify: IntersectionObserverCallback = () => {}
        const observerOptions: IntersectionObserverInit[] = []
        vi.stubGlobal('IntersectionObserver', class {
            constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
                notify = callback
                observerOptions.push(options)
            }
            observe() {}
            disconnect() {}
        })
        render(<main data-app-main data-testid="scroll-root">
            <CreatorStudio title="Edit character" onBack={() => {}} preview={<p>Preview</p>} nav={<nav aria-label="Sections" />}>
                <p>Character fields</p>
            </CreatorStudio>
        </main>)
        const navigation = screen.getByRole('navigation', { name: 'Sections' }).parentElement!
        expect(observerOptions[0].root).toBe(screen.getByTestId('scroll-root'))
        expect(navigation).not.toHaveClass('backdrop-blur')

        const crossing = (bottom: number, isIntersecting = false) => act(() => {
            notify([{
                isIntersecting,
                boundingClientRect: { top: bottom - 1, bottom },
                rootBounds: { top: 16 },
            } as IntersectionObserverEntry], {} as IntersectionObserver)
        })
        crossing(15)
        expect(navigation).toHaveClass('backdrop-blur')
        crossing(17, true)
        expect(navigation).not.toHaveClass('backdrop-blur')
        // An offscreen marker below the viewport is not a pinned navigation.
        crossing(900)
        expect(navigation).not.toHaveClass('backdrop-blur')
    })
})
