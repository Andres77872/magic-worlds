import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { i18n } from '@/app/i18n'
import type { AbuseCounterRow, ModerationMetricsResponse } from '@/shared'
import { moderationMetrics } from '../../metricsFixtures'
import { abuseCounterValues, hasCharacterCounters } from './abuseCounters'
import { ModerationMetricsView } from './ModerationMetricsView'

const HINT = 'For drained_call_chars, events are the 20,000-character steps that day’s drains added to each user’s rolling 7-day total (the unit the abuse score counts), not characters. The drained characters have their own column.'

function withCounters(abuse_counters: AbuseCounterRow[]): ModerationMetricsResponse {
    return { ...moderationMetrics, db: { ...moderationMetrics.db, abuse_counters } }
}

function abuseTable() {
    return screen.getByRole('table', { name: 'Abuse counters by day and kind' })
}

function headers() {
    return within(abuseTable()).getAllByRole('columnheader').map((cell) => cell.textContent)
}

function cellsOf(kind: string) {
    const row = within(abuseTable()).getByText(kind).closest('tr') as HTMLElement
    return within(row).getAllByRole('cell').map((cell) => cell.textContent)
}

describe('ModerationMetricsView abuse counters (D26 6a, 11 §8.3)', () => {
    it('shows drained call characters in their own column, apart from the 20k-step events', () => {
        render(
            <ModerationMetricsView
                locale="en"
                envelope={withCounters([
                    { day: '2026-10-12', kind: 'burst', events: 4, users: 2 },
                    { day: '2026-10-12', kind: 'drained_call_chars', events: 2, users: 3, chars: 54_321 },
                ])}
            />,
        )
        expect(headers()).toEqual(['Day', 'Kind', 'Events', 'Characters', 'Users'])
        // Cells after the row header: kind, events, characters, users.
        expect(cellsOf('drained_call_chars')).toEqual(['drained_call_chars', '2', '54,321', '3'])
        expect(cellsOf('burst')).toEqual(['burst', '4', '—', '2'])
        expect(screen.getByText(HINT)).toBeInTheDocument()
    })

    it('never shows a pre-split drained row’s characters as events', () => {
        // A BFF without the split sums characters into `events` for this kind.
        render(<ModerationMetricsView locale="en" envelope={withCounters([{ day: '2026-10-12', kind: 'drained_call_chars', events: 54_321, users: 3 }])} />)
        expect(cellsOf('drained_call_chars')).toEqual(['drained_call_chars', '—', '54,321', '3'])
    })

    it('keeps the table as it was when no row counts characters', () => {
        render(<ModerationMetricsView locale="en" envelope={moderationMetrics} />)
        expect(headers()).toEqual(['Day', 'Kind', 'Events', 'Users'])
        expect(cellsOf('burst')).toEqual(['burst', '4', '2'])
        expect(screen.queryByText(HINT)).not.toBeInTheDocument()
    })

    it('labels the characters column in Spanish too', async () => {
        await i18n.changeLanguage('es')
        try {
            render(
                <ModerationMetricsView
                    locale="es"
                    envelope={withCounters([{ day: '2026-10-12', kind: 'drained_call_chars', events: 1, users: 1, chars: 20_001 }])}
                />,
            )
            const table = screen.getByRole('table', { name: 'Contadores de abuso por día y tipo' })
            expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Día', 'Tipo', 'Eventos', 'Caracteres', 'Usuarios'])
            expect(screen.getByText(/^En drained_call_chars, los eventos son los tramos de 20\.000 caracteres .*\(la unidad que cuenta la puntuación de abuso\), no caracteres\./)).toBeInTheDocument()
        } finally {
            await i18n.changeLanguage('en')
        }
    })
})

describe('abuseCounterValues', () => {
    it('keeps events and characters apart', () => {
        expect(abuseCounterValues({ day: 'd', kind: 'burst', events: 4, users: 2 })).toEqual({ events: 4, chars: null })
        expect(abuseCounterValues({ day: 'd', kind: 'drained_call_chars', events: 2, users: 1, chars: 40_001 })).toEqual({ events: 2, chars: 40_001 })
        expect(abuseCounterValues({ day: 'd', kind: 'drained_call_chars', events: 0, users: 1, chars: 0 })).toEqual({ events: 0, chars: 0 })
        expect(abuseCounterValues({ day: 'd', kind: 'drained_call_chars', events: 9_000, users: 1, chars: null })).toEqual({ events: null, chars: 9_000 })
        expect(hasCharacterCounters([{ day: 'd', kind: 'burst', events: 4, users: 2 }])).toBe(false)
        expect(hasCharacterCounters([{ day: 'd', kind: 'drained_call_chars', events: 0, users: 1, chars: 0 }])).toBe(true)
        expect(hasCharacterCounters([])).toBe(false)
    })
})
