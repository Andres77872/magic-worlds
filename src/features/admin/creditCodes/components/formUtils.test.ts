import { describe, expect, it } from 'vitest'
import { parseEmails, toDateTimeLocal, toIsoOrNull } from './formUtils'

// Assertions are derived from Date itself so they hold in any CI timezone.
const NAIVE_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

describe('toIsoOrNull', () => {
    it('emits a timezone-naive, whole-second UTC stamp the admin API accepts', () => {
        const stamp = toIsoOrNull('2026-09-24T09:34')

        // The API rejects a trailing Z and sub-second precision outright.
        expect(stamp).toMatch(NAIVE_SECONDS)
        expect(stamp).not.toContain('Z')
        expect(stamp).not.toContain('.')
    })

    it('converts the local wall clock the picker produced into UTC', () => {
        const stamp = toIsoOrNull('2026-09-24T09:34')

        expect(Date.parse(`${stamp}Z`)).toBe(new Date('2026-09-24T09:34').getTime())
    })

    it('truncates sub-minute precision from a seconds-granularity picker', () => {
        expect(toIsoOrNull('2026-09-24T09:34:56')).toMatch(NAIVE_SECONDS)
        expect(Date.parse(`${toIsoOrNull('2026-09-24T09:34:56')}Z`)).toBe(new Date('2026-09-24T09:34:56').getTime())
    })

    it('returns null for blank or unparseable input', () => {
        expect(toIsoOrNull('')).toBeNull()
        expect(toIsoOrNull('   ')).toBeNull()
        expect(toIsoOrNull('not-a-date')).toBeNull()
    })
})

describe('toDateTimeLocal', () => {
    it('reads an offsetless API stamp as UTC', () => {
        const field = toDateTimeLocal('2026-09-24T07:34:00')

        expect(new Date(field).getTime()).toBe(Date.parse('2026-09-24T07:34:00Z'))
    })

    it('honours an explicit offset', () => {
        const field = toDateTimeLocal('2026-09-24T09:34:00+02:00')

        expect(new Date(field).getTime()).toBe(Date.parse('2026-09-24T07:34:00Z'))
    })

    it('round-trips a picker value through toIsoOrNull', () => {
        expect(toDateTimeLocal(toIsoOrNull('2026-09-24T09:34'))).toBe('2026-09-24T09:34')
    })

    it('returns an empty string for blank or unparseable input', () => {
        expect(toDateTimeLocal(null)).toBe('')
        expect(toDateTimeLocal(undefined)).toBe('')
        expect(toDateTimeLocal('')).toBe('')
        expect(toDateTimeLocal('not-a-date')).toBe('')
    })
})

describe('parseEmails', () => {
    it('splits, lowercases and de-duplicates addresses', () => {
        expect(parseEmails('A@b.com, c@d.com\n a@B.com; e@f.com')).toEqual(['a@b.com', 'c@d.com', 'e@f.com'])
    })

    it('returns an empty list for blank input', () => {
        expect(parseEmails('   \n ')).toEqual([])
    })
})
