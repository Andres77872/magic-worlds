import { addDays, daysBetween } from '@/shared/calendarDate'
import type { StoryWritingDay, StoryWritingProgress, StoryWritingTotals } from '@/shared/types/storyProgress.types'

export const netWords = (totals: Pick<StoryWritingTotals, 'added' | 'removed'>) => totals.added - totals.removed
const empty = (): StoryWritingTotals => ({ added: 0, removed: 0, saves: 0 })

/** Every day of the window, oldest first, with zero totals on days without saves. */
export function writingCalendar(progress: StoryWritingProgress): StoryWritingDay[] {
    const byDate = new Map(progress.days.map((day) => [day.date, day]))
    const length = daysBetween(progress.firstDate, progress.today) + 1
    return Array.from({ length }, (_, index) => {
        const date = addDays(progress.firstDate, index)
        return byDate.get(date) ?? { date, author: empty(), ai: empty() }
    })
}

/**
 * Consecutive days on which the author added words, ending today. A day with no writing yet today keeps the streak
 * that ran through yesterday. `atLeast` means the streak reaches the first day of the window and may be longer.
 */
export function writingStreak(progress: StoryWritingProgress): { days: number; atLeast: boolean } {
    const calendar = writingCalendar(progress)
    let index = calendar.length - 1
    if (index >= 0 && calendar[index].author.added === 0) index -= 1
    let days = 0
    while (index >= 0 && calendar[index].author.added > 0) { days += 1; index -= 1 }
    return { days, atLeast: days > 0 && index < 0 }
}

/** What the novel goal and deadline ask for: words left, days left (today included) and words a day to finish. */
export function deadlinePlan(progress: StoryWritingProgress) {
    const remaining = progress.wordGoal !== null && progress.activeWords !== null ? Math.max(progress.wordGoal - progress.activeWords, 0) : null
    if (!progress.deadline) return { remaining, daysLeft: null, perDay: null, overdueDays: null }
    const gap = daysBetween(progress.today, progress.deadline)
    if (gap < 0) return { remaining, daysLeft: null, perDay: null, overdueDays: -gap }
    const daysLeft = gap + 1
    return { remaining, daysLeft, perDay: remaining === null ? null : Math.ceil(remaining / daysLeft), overdueDays: null }
}

/** Net author words, writing days and the average per writing day over the last `length` days. */
export function periodSummary(calendar: StoryWritingDay[], length: number) {
    const days = calendar.slice(-length)
    const written = days.filter((day) => day.author.added > 0)
    const net = days.reduce((sum, day) => sum + netWords(day.author), 0)
    return { net, writingDays: written.length, average: written.length ? Math.round(net / written.length) : 0,
        ai: days.reduce((sum, day) => sum + netWords(day.ai), 0) }
}
