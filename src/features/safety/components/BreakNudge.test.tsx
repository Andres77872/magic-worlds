import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ensureSafetyLocales } from '../test/ensureSafetyLocales'
import { BreakNudge } from './BreakNudge'

function ui(minutes: number | null, active: boolean) {
    return (
        <I18nextProvider i18n={i18n.cloneInstance({ lng: 'en' })}>
            <BreakNudge minutes={minutes} active={active} />
        </I18nextProvider>
    )
}

beforeAll(ensureSafetyLocales)

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
})

describe('BreakNudge', () => {
    it('appears after the interval of activity and hides on dismiss without stopping anything', () => {
        render(ui(30, true))
        expect(screen.queryByTestId('break-nudge')).toBeNull()

        act(() => vi.advanceTimersByTime(30 * 60_000))
        const nudge = screen.getByTestId('break-nudge')
        expect(nudge).toHaveTextContent('Time for a break?')
        expect(nudge).toHaveTextContent('Taking a short break is a good idea.')

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
        expect(screen.queryByTestId('break-nudge')).toBeNull()
    })

    it('never appears without an interval (every non-companion caller)', () => {
        render(ui(null, true))
        act(() => vi.advanceTimersByTime(24 * 60 * 60_000))
        expect(screen.queryByTestId('break-nudge')).toBeNull()
    })
})
