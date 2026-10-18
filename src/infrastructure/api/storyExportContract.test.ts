import { describe, expect, it } from 'vitest'
import { exportManifest, exportRequest } from '@/test/fixtures/storyExport'
import { isStoryExportRequest, sha256Hex, storyExportQuery, verifyStoryExportManifest } from './storyExportContract'

describe('manuscript export contract', () => {
    it('accepts a manifest that describes exactly the requested file', () => {
        expect(verifyStoryExportManifest(exportManifest(), 'story-1', exportRequest())).toBe(true)
        const markdown = exportRequest({ format: 'markdown' })
        expect(verifyStoryExportManifest(exportManifest(markdown, { filename: 'Gull-Point.md', contentType: 'text/markdown; charset=utf-8', wordCount: null }), 'story-1', markdown)).toBe(true)
        const epub = exportRequest({ format: 'epub' })
        expect(verifyStoryExportManifest(exportManifest(epub, { filename: 'Gull-Point.epub', contentType: 'application/epub+zip' }), 'story-1', epub)).toBe(true)
        expect(verifyStoryExportManifest(exportManifest(epub, { filename: 'Gull-Point.epub', contentType: 'application/zip' }), 'story-1', epub)).toBe(false)
        expect(verifyStoryExportManifest(exportManifest(exportRequest(), { scenes: [{ ...exportManifest().scenes[0], role: 'dedication' }] }), 'story-1', exportRequest())).toBe(true)
        // The glossary lists exactly the chosen Codex entries, each once, and the download asks for the same ones.
        const glossary = exportRequest({ glossary: ['mara', 'gull'] })
        expect(verifyStoryExportManifest(exportManifest(glossary), 'story-1', glossary)).toBe(true)
        expect(verifyStoryExportManifest(exportManifest(glossary, { glossary: [{ refId: 'mara', term: 'Mara' }] }), 'story-1', glossary)).toBe(false)
        expect(verifyStoryExportManifest(exportManifest(glossary, { glossary: [{ refId: 'mara', term: 'Mara' }, { refId: 'other', term: 'Other' }] }), 'story-1', glossary)).toBe(false)
        expect(isStoryExportRequest(exportRequest({ glossary: ['mara', 'mara'] }))).toBe(false)
        expect(storyExportQuery(glossary).endsWith('&contents=false&glossary=mara&glossary=gull')).toBe(true)
    })

    it('keeps the manuscript choices at their defaults in a companion file and counts its entries', () => {
        const notes = exportRequest({ format: 'markdown', document: 'review_notes', resolvedNotes: true })
        expect(isStoryExportRequest(notes)).toBe(true)
        const file = { filename: 'Gull-Point-Review-notes.md', contentType: 'text/markdown; charset=utf-8' }
        expect(verifyStoryExportManifest(exportManifest(notes, { ...file, entries: 3 }), 'story-1', notes)).toBe(true)
        expect(verifyStoryExportManifest(exportManifest(notes, { ...file, entries: null }), 'story-1', notes)).toBe(false)
        expect(verifyStoryExportManifest(exportManifest(exportRequest(), { entries: 0 }), 'story-1', exportRequest())).toBe(false)
        expect(storyExportQuery(notes).endsWith('&contents=false&document=review_notes&resolvedNotes=true')).toBe(true)
        expect(storyExportQuery(exportRequest()).includes('document=')).toBe(false)
        for (const odd of [exportRequest({ resolvedNotes: true }), exportRequest({ document: 'ai_changes', resolvedNotes: true }), exportRequest({ document: 'review_notes', contents: true }),
            exportRequest({ document: 'ai_changes', glossary: ['mara'] }), exportRequest({ document: 'review_notes', sceneTitles: true }), { ...exportRequest(), document: 'notes' }])
            expect(isStoryExportRequest(odd)).toBe(false)
    })

    it('carries the page layout with a PDF and only with a PDF', () => {
        const layout = { pageSize: 'a5', fontSize: 12, lineSpacing: 'double', margins: 'wide', fontFamily: 'sans', pageNumbers: false, justify: true } as const
        const pdf = exportRequest({ format: 'pdf', pdf: layout })
        expect(isStoryExportRequest(pdf)).toBe(true)
        expect(verifyStoryExportManifest(exportManifest(pdf, { filename: 'Gull-Point.pdf', contentType: 'application/pdf' }), 'story-1', pdf)).toBe(true)
        expect(verifyStoryExportManifest(exportManifest(pdf, { filename: 'Gull-Point.pdf', contentType: 'application/pdf' }), 'story-1', { ...pdf, pdf: { ...layout, fontSize: 13 } })).toBe(false)
        expect(storyExportQuery(pdf).endsWith('&contents=false&pdf.pageSize=a5&pdf.fontSize=12&pdf.lineSpacing=double&pdf.margins=wide&pdf.fontFamily=sans&pdf.pageNumbers=false&pdf.justify=true')).toBe(true)
        for (const odd of [{ ...pdf, pdf: null }, { ...exportRequest(), pdf: layout }, { ...pdf, pdf: { ...layout, fontSize: 17 } }, { ...pdf, pdf: { ...layout, fontSize: 11.5 } },
            { ...pdf, pdf: { ...layout, pageSize: 'legal' } }, { ...pdf, pdf: { ...layout, extra: true } }]) expect(isStoryExportRequest(odd)).toBe(false)
    })

    it('refuses other choices, another novel, a mismatched type or a scene listed twice', () => {
        const request = exportRequest()
        for (const [manifest, storyId] of [
            [exportManifest(exportRequest({ titlePage: false })), 'story-1'], [exportManifest(), 'story-2'],
            [exportManifest(request, { contentType: 'text/plain; charset=utf-8' }), 'story-1'], [exportManifest(request, { filename: 'Gull-Point.md' }), 'story-1'],
            [exportManifest(request, { excluded: [{ sceneId: 's1', chapterId: 'c1', partId: null, title: 'Arrival', chapterTitle: 'One', role: null, reason: 'archived' }] }), 'story-1'],
            [exportManifest(request, { scenes: [{ ...exportManifest().scenes[0], role: 'prologue' as never }] }), 'story-1'],
            [exportManifest(request, { notes: [{ code: 'beats_omitted', count: 0 }] }), 'story-1'], [{ ...exportManifest(), extra: true }, 'story-1'],
        ] as const) expect(verifyStoryExportManifest(manifest, storyId, request)).toBe(false)
        expect(isStoryExportRequest({ ...request, format: 'pdf' })).toBe(false)
        expect(isStoryExportRequest({ ...request, titlePage: 'yes' })).toBe(false)
        const withoutContents: Record<string, unknown> = { ...request }
        delete withoutContents.contents
        expect(isStoryExportRequest(withoutContents)).toBe(false)
        expect(verifyStoryExportManifest(exportManifest(request, { notes: [{ code: 'lists_as_text' as never, count: 1 }] }), 'story-1', request)).toBe(false)
    })

    it('names every choice in the download query and hashes the downloaded bytes', async () => {
        expect(storyExportQuery(exportRequest({ format: 'text', sceneTitles: true }))).toBe('sourceVersion=' + 'a'.repeat(64)
            + '&format=text&includeArchived=false&titlePage=true&partTitles=true&chapterTitles=true&sceneTitles=true&chapterBreaks=true&contents=false')
        expect(await sha256Hex(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    })
})
