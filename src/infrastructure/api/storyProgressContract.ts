import { isRecord } from '@/shared/novelMutationJournal'
import { daysBetween, isCalendarDate } from '@/shared/calendarDate'
import type { StoryWritingProgress, StoryWritingTotals } from '@/shared/types/storyProgress.types'

export const STORY_PROGRESS_MAX_DAYS = 366
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every((key) => key in v)
const count = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && Number(v) >= min
const optional = (v: unknown, max: number) => v === null || count(v, 1) && Number(v) <= max

function totals(v: unknown): v is StoryWritingTotals {
    return isRecord(v) && exact(v, ['added', 'removed', 'saves']) && count(v.added) && count(v.removed) && count(v.saves)
}

/** The progress must be this novel's, in the asked time zone and window, with ordered in-window days. */
export function verifyStoryWritingProgress(v: unknown, storyId: string, request: { timeZone: string; days: number }): v is StoryWritingProgress {
    if (!isRecord(v) || !exact(v, ['storyId', 'timeZone', 'today', 'firstDate', 'countPolicy', 'activeWords', 'wordGoal', 'deadline', 'dailyWordGoal', 'metadataRevision', 'days'])) return false
    if (v.storyId !== storyId || v.timeZone !== request.timeZone || !isCalendarDate(v.today) || !isCalendarDate(v.firstDate)) return false
    if (daysBetween(v.firstDate, v.today) !== request.days - 1 || typeof v.countPolicy !== 'string' || !v.countPolicy) return false
    if (!(v.activeWords === null || count(v.activeWords)) || !optional(v.wordGoal, 2_147_483_647) || !optional(v.dailyWordGoal, 1_000_000)) return false
    if (!(v.deadline === null || isCalendarDate(v.deadline)) || !count(v.metadataRevision, 1) || !Array.isArray(v.days)) return false
    let previous = ''
    for (const day of v.days) {
        if (!isRecord(day) || !exact(day, ['date', 'author', 'ai']) || !isCalendarDate(day.date) || !totals(day.author) || !totals(day.ai)) return false
        if (day.date <= previous || day.date < v.firstDate || day.date > v.today) return false
        previous = day.date
    }
    return true
}
