import type { StoryImportManifest, StoryImportOptions, StoryImportRecord } from '@/shared/types/storyImport.types'

export const IMPORT_HASH = 'a'.repeat(64)

export function importManifest(options: StoryImportOptions = { chapterLevel: 'auto', splitScenes: true }, patch: Partial<StoryImportManifest> = {}): StoryImportManifest {
    return {
        schemaVersion: 1, projection: 'manuscript_import', format: 'markdown', filename: 'gull.md', bytes: 42, sourceHash: IMPORT_HASH,
        importVersion: (options.splitScenes ? 'b' : 'c').repeat(64), options, chapterLevel: 2, title: 'Gull Point', language: 'en', wordCount: 1200,
        parts: [{ title: 'Part One', chapters: 2 }],
        chapters: [
            { title: 'Low tide', part: 0, role: null, scenes: options.splitScenes ? [{ title: 'Scene 1', words: 700, excerpt: 'Mara read the letter.' }, { title: 'Scene 2', words: 300, excerpt: 'Morning.' }]
                : [{ title: 'Scene 1', words: 1000, excerpt: 'Mara read the letter.' }] },
            { title: 'The bell', part: 0, role: null, scenes: [{ title: 'Scene 1', words: 200, excerpt: 'Ring.' }] },
        ],
        losses: [{ code: 'images_dropped', count: 2 }, { code: 'footnotes_dropped', count: 1 }],
        ...patch,
    }
}

export function importRecord(patch: Partial<StoryImportRecord> = {}): StoryImportRecord {
    return {
        storyId: '0a1b2c3d-0000-5000-8000-000000000001', importedAt: '2026-10-17T20:00:00+00:00', format: 'docx', filename: 'gull.docx', bytes: 42,
        sourceHash: IMPORT_HASH, importVersion: 'b'.repeat(64), options: { chapterLevel: 'auto', splitScenes: true }, chapterLevel: 1, title: 'Gull Point',
        language: 'en', wordCount: 1200, losses: [{ code: 'comments_dropped', count: 3 }], parts: 0, chapters: 2, scenes: 3, ...patch,
    }
}
