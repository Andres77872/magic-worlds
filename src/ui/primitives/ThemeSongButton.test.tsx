import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemeSongButton } from './ThemeSongButton'

// jsdom doesn't implement media playback; emulate play/pause by flipping `paused`
// and emitting the events ThemeSongButton listens for.
function stubMedia() {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
        Object.defineProperty(this, 'paused', { configurable: true, get: () => false })
        this.dispatchEvent(new Event('play'))
        return Promise.resolve()
    })
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
        Object.defineProperty(this, 'paused', { configurable: true, get: () => true })
        this.dispatchEvent(new Event('pause'))
    })
    return { play, pause }
}

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe('ThemeSongButton', () => {
    it('toggles play/pause state on click', () => {
        const { play, pause } = stubMedia()
        render(<ThemeSongButton src="/generated-audio/t.mp3" />)

        const btn = screen.getByRole('button', { name: /play theme song/i })
        expect(btn.getAttribute('aria-pressed')).toBe('false')

        fireEvent.click(btn)
        expect(play).toHaveBeenCalledTimes(1)
        const playing = screen.getByRole('button', { name: /pause theme song/i })
        expect(playing.getAttribute('aria-pressed')).toBe('true')

        fireEvent.click(playing)
        expect(pause).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('button', { name: /play theme song/i }).getAttribute('aria-pressed')).toBe('false')
    })

    it('does not bubble clicks to an enclosing clickable parent', () => {
        stubMedia()
        const onParentClick = vi.fn()
        render(
            <div onClick={onParentClick}>
                <ThemeSongButton src="/generated-audio/t.mp3" />
            </div>,
        )
        fireEvent.click(screen.getByRole('button', { name: /play theme song/i }))
        expect(onParentClick).not.toHaveBeenCalled()
    })
})
