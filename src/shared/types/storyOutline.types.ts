/** A Markdown or plain-text outline read as reviewable structure (S18): titles, synopses and planned beats, never prose. */
export interface StoryOutlineScene { title: string; synopsis: string | null; beats: string[] }
/** `part` is the index of the outline part the chapter belongs to; null places it at the chosen destination. */
export interface StoryOutlineChapter { part: number | null; title: string; synopsis: string | null; scenes: StoryOutlineScene[] }
export interface StoryOutlinePart { title: string; synopsis: string | null }
export interface StoryOutlinePlan { parts: StoryOutlinePart[]; chapters: StoryOutlineChapter[] }
export type StoryOutlineNote = 'shortened' | 'opening' | 'defaultScenes' | 'ignored' | 'deeperHeadings' | 'code'
export interface StoryOutlinePreview {
    schemaVersion: 1
    outline: StoryOutlinePlan
    /** The heading level read as chapters; null when chapters came from plain "Chapter" lines or there were no headings. */
    chapterLevel: number | null
    detectedLevel: number | null
    counts: { parts: number; chapters: number; scenes: number; beats: number }
    notes: Partial<Record<StoryOutlineNote, number>>
}
/** Appends the reviewed plan in one organization change: outline parts at the end of the novel, other chapters at the end of `parentId`. */
export interface StoryOutlineOperation { op: 'add_outline'; parentId: string | null; outline: StoryOutlinePlan }
