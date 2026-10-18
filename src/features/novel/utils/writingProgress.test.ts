import { expect, it } from 'vitest'
import { writingDay, writingProgress } from '@/test/fixtures/storyProgress'
import { deadlinePlan, periodSummary, writingCalendar, writingStreak } from './writingProgress'

it('fills every day of the window, oldest first', () => {
    const calendar = writingCalendar(writingProgress())
    expect(calendar.map((day) => day.date)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'])
    expect(calendar[2].author).toEqual({ added: 0, removed: 0, saves: 0 })
})

it('counts a streak of days with added words, kept through a today without writing yet', () => {
    expect(writingStreak(writingProgress())).toEqual({ days: 2, atLeast: false })
    expect(writingStreak(writingProgress({ days: [writingDay('2026-10-15', [5]), writingDay('2026-10-16', [5])] }))).toEqual({ days: 2, atLeast: false })
    expect(writingStreak(writingProgress({ days: [writingDay('2026-10-15', [5])] }))).toEqual({ days: 0, atLeast: false })
    // Removing words or accepting AI text alone is not a writing day.
    expect(writingStreak(writingProgress({ days: [writingDay('2026-10-17', [0, 9], [40])] }))).toEqual({ days: 0, atLeast: false })
    const everyDay = ['11', '12', '13', '14', '15', '16', '17'].map((day) => writingDay('2026-10-' + day, [1]))
    expect(writingStreak(writingProgress({ days: everyDay }))).toEqual({ days: 7, atLeast: true })
})

it('plans the deadline with today included and refuses to guess an unknown word total', () => {
    expect(deadlinePlan(writingProgress())).toEqual({ remaining: 371, daysLeft: 45, perDay: 9, overdueDays: null })
    expect(deadlinePlan(writingProgress({ deadline: '2026-10-17' }))).toMatchObject({ daysLeft: 1, perDay: 371 })
    expect(deadlinePlan(writingProgress({ deadline: '2026-10-10' }))).toEqual({ remaining: 371, daysLeft: null, perDay: null, overdueDays: 7 })
    expect(deadlinePlan(writingProgress({ activeWords: 1200 }))).toMatchObject({ remaining: 0, perDay: 0 })
    expect(deadlinePlan(writingProgress({ activeWords: null }))).toMatchObject({ remaining: null, daysLeft: 45, perDay: null })
    expect(deadlinePlan(writingProgress({ deadline: null }))).toEqual({ remaining: 371, daysLeft: null, perDay: null, overdueDays: null })
})

it('sums net author words and AI words apart over a period', () => {
    expect(periodSummary(writingCalendar(writingProgress()), 30)).toEqual({ net: 214, writingDays: 3, average: 71, ai: 486 })
    expect(periodSummary(writingCalendar(writingProgress()), 1)).toEqual({ net: 34, writingDays: 1, average: 34, ai: 486 })
})
