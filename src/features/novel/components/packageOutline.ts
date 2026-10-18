import type { StoryPackageCounts } from '@/shared/types/storyPackage.types'

/** "3 chapters with 12 scenes", with parts first when there are any; shared by the backup and restore summaries. */
export function packageOutline(counts: StoryPackageCounts, text: (key: string, values?: Record<string, unknown>) => string) {
    const counted = (name: string, count: number) => text('count.' + name, { count })
    return text(counts.parts ? 'holdsParts' : 'holds', { parts: counted('parts', counts.parts), chapters: counted('chapters', counts.chapters), scenes: counted('scenes', counts.scenes) })
}
