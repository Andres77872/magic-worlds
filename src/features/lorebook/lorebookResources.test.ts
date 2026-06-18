import { describe, expect, it } from 'vitest'
import type { LorebookResource } from '@/shared'
import { lorebookToApiPayload } from './lorebookTransforms'
import {
    invalidateLorebookResourceExtraction,
    lorebookResourceFileTypeFromName,
    lorebookResourceStats,
    normalizeLorebookResource,
    withLorebookResources,
} from './lorebookResources'

describe('lorebook resource utilities', () => {
    it('normalizes backend link counts and derives file type from the file name', () => {
        const resource = normalizeLorebookResource({
            id: 'resource-1',
            title: 'Court archive',
            file_name: 'court.md',
            content: '# Court notes',
            link_count: 3,
        })

        expect(resource).toMatchObject({
            id: 'resource-1',
            fileName: 'court.md',
            fileType: 'md',
            linkCount: 3,
        })
    })

    it('normalizes extraction source hash and metadata freshness', () => {
        const resource = normalizeLorebookResource({
            id: 'resource-1',
            file_name: 'court.md',
            content: '# Court notes',
            extraction_status: 'completed',
            evaluation_hash: 'hash-new',
            extraction: {
                keywords: ['mirror court'],
                short_summary: 'Court notes.',
                long_summary: 'Long court notes.',
                source_hash: 'hash-old',
                snippets: [],
            },
        })

        expect(resource?.metadataOutdated).toBe(true)
        expect(resource?.extraction?.sourceHash).toBe('hash-old')
    })

    it('marks completed extraction as stale when resource fields change', () => {
        const resource = normalizeLorebookResource({
            id: 'resource-1',
            file_name: 'court.md',
            content: '# Court notes',
            extraction_status: 'completed',
            extraction: {
                keywords: ['mirror court'],
                short_summary: 'Court notes.',
                long_summary: 'Long court notes.',
                snippets: [{ title: 'Mirror oath', content: 'Names bind.', triggers: [] }],
            },
        })

        const next = invalidateLorebookResourceExtraction(resource!, { content: '# New notes' })

        expect(next.extractionStatus).toBe('completed')
        expect(next.extraction).toBe(resource!.extraction)
        expect(next.metadataOutdated).toBe(true)
        expect(next.contentLength).toBe('# New notes'.length)
    })

    it('counts snippets and keywords only for completed extraction', () => {
        const completed = normalizeLorebookResource({
            id: 'resource-1',
            file_name: 'court.md',
            content: 'Court notes',
            extraction_status: 'completed',
            extraction: {
                keywords: ['mirror court'],
                short_summary: 'Court notes.',
                long_summary: 'Long court notes.',
                snippets: [{ title: 'Mirror oath', content: 'Names bind.', triggers: [] }],
            },
        })
        const pending = normalizeLorebookResource({
            id: 'resource-2',
            file_name: 'stale.md',
            content: 'Stale notes',
            extraction_status: 'pending',
            extraction: {
                keywords: ['stale'],
                short_summary: 'Stale.',
                long_summary: 'Stale.',
                snippets: [{ title: 'Stale', content: 'Stale.', triggers: [] }],
            },
        })

        expect(lorebookResourceStats([completed!, pending!])).toMatchObject({
            total: 2,
            completed: 1,
            pending: 1,
            snippets: 1,
            keywords: 1,
        })
    })

    it('keeps hydrated shared resources in the editor draft but strips them from save payloads', () => {
        const sharedResource: LorebookResource = {
            id: 'shared-resource',
            title: 'Shared atlas',
            fileName: 'atlas.txt',
            fileType: 'txt',
            content: 'Atlas notes',
            triggers: [],
        }
        const embeddedResource: LorebookResource = {
            id: 'embedded-resource',
            title: 'Embedded archive',
            fileName: 'archive.md',
            fileType: 'md',
            content: 'Archive notes',
            triggers: [],
        }
        const metadata = withLorebookResources({
            sharedResources: [sharedResource],
            resourceIds: ['shared-resource'],
            ownerNote: 'keep me',
        }, [embeddedResource])

        expect(metadata).toEqual({
            sharedResources: [sharedResource],
            resourceIds: ['shared-resource'],
            ownerNote: 'keep me',
            resources: [embeddedResource],
        })

        expect(lorebookToApiPayload({
            name: 'Glass Courts',
            tags: [],
            enabled: true,
            settings: {
                scanDepth: 8,
                tokenBudget: 1200,
                recursiveScanning: false,
                matchWholeWords: true,
                caseSensitive: false,
            },
            metadata,
            entries: [],
        }).metadata).toEqual({
            ownerNote: 'keep me',
            resources: [embeddedResource],
        })
    })

    it('maps markdown filenames to md and all other valid resources to txt', () => {
        expect(lorebookResourceFileTypeFromName('source.md')).toBe('md')
        expect(lorebookResourceFileTypeFromName('source.txt')).toBe('txt')
        expect(lorebookResourceFileTypeFromName('draft')).toBe('txt')
    })
})
