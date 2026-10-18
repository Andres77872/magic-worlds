/** Words changed by saved scene edits on one day: added and removed are summed per save, so net = added − removed. */
export interface StoryWritingTotals { added: number; removed: number; saves: number }
export interface StoryWritingDay {
    /** The author's local calendar date, YYYY-MM-DD. */
    date: string
    /** Typing and other author saves. */
    author: StoryWritingTotals
    /** Accepted AI proposals. */
    ai: StoryWritingTotals
}
/** The novel's goals, its saved active words and its writing log, grouped into local days in `timeZone`. */
export interface StoryWritingProgress {
    storyId: string
    timeZone: string
    today: string
    firstDate: string
    countPolicy: string
    /** Saved active words; null while the saved total is unavailable (never guessed as zero). */
    activeWords: number | null
    wordGoal: number | null
    deadline: string | null
    dailyWordGoal: number | null
    metadataRevision: number
    /** Only days with saves, oldest first, all within firstDate…today. */
    days: StoryWritingDay[]
}
