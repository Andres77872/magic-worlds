import { expect, it } from 'vitest'
import { PROGRESS_STORY, writingDay, writingProgress } from '@/test/fixtures/storyProgress'
import { verifyStoryWritingProgress } from './storyProgressContract'

const request = { timeZone: 'America/Mexico_City', days: 7 }

it('accepts the novel’s progress in the asked time zone and window', () => {
    expect(verifyStoryWritingProgress(writingProgress(), PROGRESS_STORY, request)).toBe(true)
    expect(verifyStoryWritingProgress(writingProgress({ activeWords: null, wordGoal: null, deadline: null, dailyWordGoal: null, days: [] }), PROGRESS_STORY, request)).toBe(true)
})

it('refuses another novel, zone or window, and malformed goals', () => {
    expect(verifyStoryWritingProgress(writingProgress(), 'another-novel', request)).toBe(false)
    expect(verifyStoryWritingProgress(writingProgress(), PROGRESS_STORY, { ...request, timeZone: 'UTC' })).toBe(false)
    expect(verifyStoryWritingProgress(writingProgress(), PROGRESS_STORY, { ...request, days: 30 })).toBe(false)
    for (const patch of [{ deadline: '2026-02-30' }, { dailyWordGoal: 0 }, { dailyWordGoal: 1_000_001 }, { wordGoal: 2.5 }, { activeWords: -1 }, { metadataRevision: 0 }, { today: '2026-10-17T00:00' }])
        expect(verifyStoryWritingProgress(writingProgress(patch), PROGRESS_STORY, request)).toBe(false)
    expect(verifyStoryWritingProgress({ ...writingProgress(), extra: true }, PROGRESS_STORY, request)).toBe(false)
})

it('refuses days out of order, outside the window or with impossible totals', () => {
    const day = writingDay('2026-10-14', [10])
    for (const days of [[writingDay('2026-10-16', [1]), writingDay('2026-10-14', [1])], [day, day], [writingDay('2026-10-10', [1])], [writingDay('2026-10-18', [1])],
        [{ ...day, author: { added: -1, removed: 0, saves: 1 } }], [{ ...day, ai: { added: 1, removed: 0 } }]])
        expect(verifyStoryWritingProgress(writingProgress({ days: days as never }), PROGRESS_STORY, request)).toBe(false)
})
