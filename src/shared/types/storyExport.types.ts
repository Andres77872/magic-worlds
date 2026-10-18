import type { StoryExportRole } from './story.types'

export type StoryExportFormat = 'markdown' | 'text' | 'docx' | 'epub' | 'pdf'
/** The manuscript, or a companion file: the author's review notes or the AI proposals accepted into the same scenes, or the novel's style sheet. */
export type StoryExportDocument = 'manuscript' | 'review_notes' | 'ai_changes' | 'style_sheet'
/** Page and type rules chosen for a printed PDF only. */
export interface StoryExportPdfLayout {
    pageSize: 'letter' | 'a4' | 'a5' | 'trade' | 'digest'
    /** Text size in points, 9–16. */
    fontSize: number
    lineSpacing: 'single' | 'relaxed' | 'double'
    margins: 'narrow' | 'normal' | 'wide'
    fontFamily: 'serif' | 'sans'
    pageNumbers: boolean
    justify: boolean
}
export interface StoryExportOptions {
    format: StoryExportFormat; includeArchived: boolean; titlePage: boolean; partTitles: boolean; chapterTitles: boolean; sceneTitles: boolean
    /** Word and PDF: each part and chapter starts on a new page. */
    chapterBreaks: boolean
    /** Word, EPUB and PDF: a contents page of parts and chapters after the title page. */
    contents: boolean
    /** Codex entries (reference ids) for a generated glossary of terms; empty for none. */
    glossary: string[]
    /** The PDF's page layout; null for every other format. */
    pdf: StoryExportPdfLayout | null
    /** A companion file keeps the title, page-break, contents and glossary choices at their defaults. */
    document: StoryExportDocument
    /** Review notes only: resolved notes as well as open ones. */
    resolvedNotes: boolean
}
/** A Codex entry the author can put in the glossary: its term and the first paragraph the file would use. */
export interface StoryExportGlossaryCandidate { refId: string; kind: string; term: string; definition: string }
export interface StoryExportRequest extends StoryExportOptions { sourceVersion: string }
export type StoryExportExclusion = 'trashed' | 'merged' | 'archived' | 'excluded'
export type StoryExportNote = 'beats_omitted' | 'highlights_omitted' | 'mentions_as_text' | 'headings_shifted' | 'empty_scenes' | 'contents_omitted'
/** `role` is the chapter's front- or back-matter role; the file places those chapters before or after the main text. */
interface StoryExportScene { sceneId: string; chapterId: string; partId: string | null; title: string; chapterTitle: string; role: StoryExportRole | null }
/** What one export file holds, at the source version it was compiled from; the download must match its SHA-256. */
export interface StoryExportManifest {
    schemaVersion: 1; projection: 'manuscript_export'; storyId: string; sourceVersion: string; request: StoryExportRequest
    title: string; filename: string; contentType: string; sha256: string; bytes: number; wordCount: number | null
    scenes: Array<StoryExportScene & { revision: number; contentHash: string }>
    excluded: Array<StoryExportScene & { reason: StoryExportExclusion }>
    notes: Array<{ code: StoryExportNote; count: number }>
    /** The glossary terms in the file, alphabetically. */
    glossary: Array<{ refId: string; term: string }>
    /** How many notes, AI changes or style entries a companion file lists; null for the manuscript. */
    entries: number | null
}
export type StoryExportJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled'
/** How far a job got: reading the saved scenes, building the file, printing a PDF, saving the file. */
export type StoryExportJobStage = 'queued' | 'reading' | 'building' | 'printing' | 'storing' | 'done'
export type StoryExportJobLogCode = 'queued' | 'retry' | 'started' | 'read' | 'printing' | 'built' | 'completed' | 'failed' | 'canceled' | 'interrupted' | 'file_removed'
/** One step of a job's log, with its UTC time and the numbers or codes that step reported. */
export interface StoryExportJobLogEntry { at: string; code: StoryExportJobLogCode; values?: Record<string, string | number | null> }
/** A completed job's file; `removed` once newer files of the novel replaced it (only the newest are kept). */
export interface StoryExportJobFile { filename: string; contentType: string; bytes: number; sha256: string; wordCount: number | null; removed: boolean }
/** An export built in the background from one reviewed request, at the source version that review saw. */
export interface StoryExportJob {
    id: string; storyId: string; requestId: string; retryOf: string | null; attempt: number; sourceVersion: string; request: StoryExportRequest
    status: StoryExportJobStatus; stage: StoryExportJobStage; sceneCount: number | null; log: StoryExportJobLogEntry[]; errorCode: string | null
    file: StoryExportJobFile | null; createdAt: string; startedAt: string | null; finishedAt: string | null
}
