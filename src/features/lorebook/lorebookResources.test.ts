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
    it('rejects removed aliases and missing identity rather than fabricating a stored resource', () => {
        expect(normalizeLorebookResource({ id: 'resource-1', file_name: 'court.md', content: 'Court' })).toBeNull()
        expect(normalizeLorebookResource({ fileName: 'court.md', content: 'Court' })).toBeNull()
        expect(normalizeLorebookResource({ id: 'resource-1', fileName: 'court.md', content: 'Court', extraction_status: 'completed' })).toBeNull()
        expect(normalizeLorebookResource({ id: 'resource-1', fileName: 'court.md', content: 'Court', extraction: { short_summary: 'Old alias' } })?.extraction).toBeNull()
    })
    it('normalizes backend link counts and derives file type from the file name', () => {
        const resource = normalizeLorebookResource({
            id: 'resource-1',
            title: 'Court archive',
            fileName: 'court.md',
            content: '# Court notes',
            linkCount: 3,
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
            fileName: 'court.md',
            content: '# Court notes',
            extractionStatus: 'completed',
            evaluationHash: 'hash-new',
            extraction: {
                keywords: ['mirror court'],
                shortSummary: 'Court notes.',
                longSummary: 'Long court notes.',
                sourceHash: 'hash-old',
                snippets: [],
            },
        })

        expect(resource?.metadataOutdated).toBe(true)
        expect(resource?.extraction?.sourceHash).toBe('hash-old')
    })

    it('marks completed extraction as stale when resource fields change', () => {
        const resource = normalizeLorebookResource({
            id: 'resource-1',
            fileName: 'court.md',
            content: '# Court notes',
            extractionStatus: 'completed',
            extraction: {
                keywords: ['mirror court'],
                shortSummary: 'Court notes.',
                longSummary: 'Long court notes.',
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
            fileName: 'court.md',
            content: 'Court notes',
            extractionStatus: 'completed',
            extraction: {
                keywords: ['mirror court'],
                shortSummary: 'Court notes.',
                longSummary: 'Long court notes.',
                snippets: [{ title: 'Mirror oath', content: 'Names bind.', triggers: [] }],
            },
        })
        const pending = normalizeLorebookResource({
            id: 'resource-2',
            fileName: 'stale.md',
            content: 'Stale notes',
            extractionStatus: 'pending',
            extraction: {
                keywords: ['stale'],
                shortSummary: 'Stale.',
                longSummary: 'Stale.',
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
            resources: [{
                ...embeddedResource,
                description: null,
            }],
        })
    })

    it('maps markdown filenames to md and all other valid resources to txt', () => {
        expect(lorebookResourceFileTypeFromName('source.md')).toBe('md')
        expect(lorebookResourceFileTypeFromName('source.txt')).toBe('txt')
        expect(lorebookResourceFileTypeFromName('draft')).toBe('txt')
    })
})
