import type { StoryExportRole } from './story.types'

/** A manuscript file (Markdown, plain text, Word, EPUB, OpenDocument text or RTF) imported into a new novel after its conversion preview. */
export type StoryImportFormat = 'markdown' | 'text' | 'docx' | 'epub' | 'odt' | 'rtf'
export type StoryImportChapterLevel = 'auto' | 1 | 2 | 3 | 4 | 5 | 6

export interface StoryImportOptions {
    /** Which heading level starts a chapter; levels above it become parts. */
    chapterLevel: StoryImportChapterLevel
    /** Scene breaks start a new scene instead of staying in the scene. */
    splitScenes: boolean
}

export type StoryImportLossCode = 'lines_joined' | 'links_dropped' | 'images_dropped' | 'footnotes_dropped' | 'html_as_text' | 'code_as_text'
    | 'tables_as_text' | 'comments_dropped' | 'contents_skipped' | 'tracked_insertions_kept' | 'tracked_deletions_dropped'
    | 'embedded_documents_dropped' | 'titles_shortened' | 'ruby_dropped'

export interface StoryImportLoss { code: StoryImportLossCode; count: number }

export interface StoryImportManifest {
    schemaVersion: 1
    projection: 'manuscript_import'
    format: StoryImportFormat
    filename: string
    bytes: number
    sourceHash: string
    importVersion: string
    options: StoryImportOptions
    /** The heading level that starts chapters, or null when the file has no headings. */
    chapterLevel: number | null
    title: string
    language: string | null
    wordCount: number | null
    parts: { title: string; chapters: number }[]
    /** `role` is the front or back-matter section the file marks or the title names; such a chapter is outside any part. */
    chapters: { title: string; part: number | null; role: StoryExportRole | null; scenes: { title: string; words: number | null; excerpt: string }[] }[]
    losses: StoryImportLoss[]
}

export interface StoryImportWrite {
    requestId: string
    title: string
    sourceHash: string
    importVersion: string
    options: StoryImportOptions
}

export interface StoryImportAcknowledgement {
    kind: 'novel_import'
    requestId: string
    storyId: string
    write: StoryImportWrite
}

/** What an imported novel came from; kept with the novel together with the original file. */
export interface StoryImportRecord {
    storyId: string
    importedAt: string
    format: StoryImportFormat
    filename: string
    bytes: number
    sourceHash: string
    importVersion: string
    options: StoryImportOptions
    chapterLevel: number | null
    title: string
    language: string | null
    wordCount: number | null
    losses: StoryImportLoss[]
    parts: number
    chapters: number
    scenes: number
}
