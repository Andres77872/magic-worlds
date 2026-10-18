import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LiveTranscriptLine } from '../liveTranscript'
import { CallLiveTranscript } from './CallLiveTranscript'

function line(role: LiveTranscriptLine['role'], turnId: string, text: string, extra: Partial<LiveTranscriptLine> = {}): LiveTranscriptLine {
    return { id: `${role}:${turnId}`, turnId, role, text, streaming: false, interrupted: false, ...extra }
}

const LINES = [line('user', 't1', 'Did you find the letter?'), line('assistant', 't1', 'I did. (laughs) It was in the map case.')]

/** jsdom has no layout: give the log a scrollable size and a reader position. */
function scrollLog(scrollTop: number) {
    const log = screen.getByRole('log')
    Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(log, 'clientHeight', { configurable: true, value: 200 })
    log.scrollTop = scrollTop
    fireEvent.scroll(log)
    return log
}

describe('CallLiveTranscript', () => {
    it('labels both sides and hides the speech markup of character lines', () => {
        render(<CallLiveTranscript lines={LINES} name="Lyra" />)

        const items = screen.getAllByRole('listitem')
        expect(items[0]).toHaveTextContent('You')
        expect(items[1]).toHaveTextContent('Lyra')
        expect(items[1]).toHaveTextContent('I did. It was in the map case.')
        expect(items[1]).not.toHaveTextContent('(laughs)')
    })

    it('announces only complete lines', () => {
        const { rerender } = render(<CallLiveTranscript lines={LINES} name="Lyra" />)
        expect(screen.getByTestId('call-live-announcement')).toHaveTextContent('Lyra: I did. It was in the map case.')

        rerender(<CallLiveTranscript lines={[...LINES, line('assistant', 't2', 'And then', { streaming: true })]} name="Lyra" />)
        expect(screen.getByTestId('call-live-announcement')).toHaveTextContent('Lyra: I did. It was in the map case.')
    })

    it('offers "Jump to latest" for new lines while the reader is scrolled up, and follows again after it', () => {
        const { rerender } = render(<CallLiveTranscript lines={LINES} name="Lyra" />)
        scrollLog(100)
        expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument()

        const next = [...LINES, line('user', 't2', 'What does it say?')]
        rerender(<CallLiveTranscript lines={next} name="Lyra" />)
        fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }))
        expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument()
        expect(screen.getByRole('log').scrollTop).toBe(1000)
    })

    it('stays quiet for a reader at the bottom', () => {
        const { rerender } = render(<CallLiveTranscript lines={LINES} name="Lyra" />)
        scrollLog(780)
        rerender(<CallLiveTranscript lines={[...LINES, line('user', 't2', 'What does it say?')]} name="Lyra" />)
        expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument()
    })
})
