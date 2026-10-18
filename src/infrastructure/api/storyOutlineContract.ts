import { isRecord } from '@/shared/novelMutationJournal'
import type { StoryOutlinePlan, StoryOutlinePreview } from '@/shared/types/storyOutline.types'

/** The server's outline bounds (story_outline.py); lengths count characters (code points), as the server does. */
export const STORY_OUTLINE_MAX_TEXT = 500_000
export const STORY_OUTLINE_LIMITS = { parts: 50, chapters: 500, scenes: 5_000, beats: 100, beat: 2_000, synopsis: 20_000, title: 255 }
export const STORY_OUTLINE_NOTES = ['shortened', 'opening', 'defaultScenes', 'ignored', 'deeperHeadings', 'code'] as const

const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every((key) => key in v)
const count = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && Number(v) >= min
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v === v.trim() && [...v].length <= max
const optional = (v: unknown, max: number) => v === null || text(v, max)
const level = (v: unknown) => v === null || count(v, 1) && Number(v) <= 6

/** The exact plan shape the server applies; the dialog sends only plans that pass this. */
export function isStoryOutlinePlan(v: unknown): v is StoryOutlinePlan {
    const limit = STORY_OUTLINE_LIMITS
    if (!isRecord(v) || !exact(v, ['parts', 'chapters']) || !Array.isArray(v.parts) || !Array.isArray(v.chapters)) return false
    if (v.parts.length > limit.parts || v.chapters.length < 1 || v.chapters.length > limit.chapters) return false
    const parts = v.parts.length
    if (!v.parts.every((part) => isRecord(part) && exact(part, ['title', 'synopsis']) && text(part.title, limit.title) && optional(part.synopsis, limit.synopsis))) return false
    let scenes = 0
    for (const chapter of v.chapters) {
        if (!isRecord(chapter) || !exact(chapter, ['part', 'title', 'synopsis', 'scenes']) || !text(chapter.title, limit.title) || !optional(chapter.synopsis, limit.synopsis)) return false
        if (chapter.part !== null && !(count(chapter.part) && chapter.part < parts)) return false
        if (!Array.isArray(chapter.scenes) || chapter.scenes.length < 1) return false
        if (!chapter.scenes.every((scene) => isRecord(scene) && exact(scene, ['title', 'synopsis', 'beats']) && text(scene.title, limit.title) && optional(scene.synopsis, limit.synopsis)
            && Array.isArray(scene.beats) && scene.beats.length <= limit.beats && scene.beats.every((beat) => text(beat, limit.beat)))) return false
        scenes += chapter.scenes.length
    }
    return scenes <= limit.scenes
}

export function verifyStoryOutlinePreview(v: unknown, chapterLevel: number | null): v is StoryOutlinePreview {
    if (!isRecord(v) || !exact(v, ['schemaVersion', 'outline', 'chapterLevel', 'detectedLevel', 'counts', 'notes']) || v.schemaVersion !== 1) return false
    if (!isStoryOutlinePlan(v.outline) || !level(v.chapterLevel) || !level(v.detectedLevel)) return false
    // A chosen level is the level read; otherwise the server reads the level it detected.
    if (v.chapterLevel !== (chapterLevel ?? v.detectedLevel)) return false
    const plan = v.outline, scenes = plan.chapters.flatMap((chapter) => chapter.scenes)
    const counts = { parts: plan.parts.length, chapters: plan.chapters.length, scenes: scenes.length, beats: scenes.reduce((total, scene) => total + scene.beats.length, 0) }
    const reported = v.counts
    if (!isRecord(reported) || !exact(reported, ['parts', 'chapters', 'scenes', 'beats']) || Object.entries(counts).some(([key, value]) => reported[key] !== value)) return false
    return isRecord(v.notes) && Object.entries(v.notes).every(([key, value]) => (STORY_OUTLINE_NOTES as readonly string[]).includes(key) && count(value, 1))
}

/** The chosen chapters of a previewed plan, keeping only the outline parts they use. */
export function selectOutlineChapters(plan: StoryOutlinePlan, chosen: ReadonlySet<number>): StoryOutlinePlan {
    const chapters = plan.chapters.filter((_, index) => chosen.has(index))
    const used = [...new Set(chapters.flatMap((chapter) => chapter.part === null ? [] : [chapter.part]))].sort((a, b) => a - b)
    return { parts: used.map((index) => plan.parts[index]), chapters: chapters.map((chapter) => ({ ...chapter, part: chapter.part === null ? null : used.indexOf(chapter.part) })) }
}
