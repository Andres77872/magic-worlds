import type { StoryWritingDay, StoryWritingProgress } from '@/shared/types/storyProgress.types'

export const PROGRESS_STORY = '0a1b2c3d-0000-5000-8000-000000000001'

export function writingDay(date: string, author: [number, number?], ai: [number, number?] = [0]): StoryWritingDay {
    return { date, author: { added: author[0], removed: author[1] ?? 0, saves: author[0] || author[1] ? 1 : 0 },
        ai: { added: ai[0], removed: ai[1] ?? 0, saves: ai[0] || ai[1] ? 1 : 0 } }
}

/** A week ending 2026-10-17 in Mexico City, with goals and three writing days. */
export function writingProgress(overrides: Partial<StoryWritingProgress> = {}): StoryWritingProgress {
    return {
        storyId: PROGRESS_STORY, timeZone: 'America/Mexico_City', today: '2026-10-17', firstDate: '2026-10-11', countPolicy: 'icu-word-en-v1',
        activeWords: 629, wordGoal: 1000, deadline: '2026-11-30', dailyWordGoal: 200, metadataRevision: 2,
        days: [writingDay('2026-10-14', [120, 20]), writingDay('2026-10-16', [80]), writingDay('2026-10-17', [35, 1], [486])],
        ...overrides,
    }
}
