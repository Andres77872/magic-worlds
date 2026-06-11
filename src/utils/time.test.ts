import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './time'

// Derive expected strings from Intl itself so the assertions hold under any CI locale/ICU.
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' })

const NOW = Date.parse('2026-06-10T12:00:00')

function at(offsetMs: number): string {
    return new Date(NOW + offsetMs).toISOString()
}

describe('formatRelativeTime', () => {
    it('returns an empty string for missing or unparseable input', () => {
        expect(formatRelativeTime(undefined, NOW)).toBe('')
        expect(formatRelativeTime(null, NOW)).toBe('')
        expect(formatRelativeTime('', NOW)).toBe('')
        expect(formatRelativeTime('not-a-date', NOW)).toBe('')
    })

    it('collapses timestamps within 45 seconds to "now"', () => {
        expect(formatRelativeTime(at(0), NOW)).toBe(rtf.format(0, 'second'))
        expect(formatRelativeTime(at(-30_000), NOW)).toBe(rtf.format(0, 'second'))
        expect(formatRelativeTime(at(30_000), NOW)).toBe(rtf.format(0, 'second'))
    })

    it('formats past timestamps in minutes, hours, and days', () => {
        expect(formatRelativeTime(at(-2 * 60_000), NOW)).toBe(rtf.format(-2, 'minute'))
        expect(formatRelativeTime(at(-3 * 3_600_000), NOW)).toBe(rtf.format(-3, 'hour'))
        expect(formatRelativeTime(at(-2 * 86_400_000), NOW)).toBe(rtf.format(-2, 'day'))
    })

    it('formats future timestamps', () => {
        expect(formatRelativeTime(at(5 * 60_000), NOW)).toBe(rtf.format(5, 'minute'))
    })

    it('rolls 90 minutes over to the hour unit', () => {
        expect(formatRelativeTime(at(-90 * 60_000), NOW)).toBe(rtf.format(-1, 'hour'))
    })
})
