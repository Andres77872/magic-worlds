import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import {
    MarkdownNewImportError,
    deriveMarkdownResourceIdentity,
    importMarkdownFromUrl,
    normalizeMarkdownImportUrl,
} from './markdownNewImport'

describe('server-side Markdown import helpers', () => {
    it('normalizes http URLs and strips fragments', () => {
        expect(normalizeMarkdownImportUrl('example.com/path?chapter=1#notes')).toBe('https://example.com/path?chapter=1')
        expect(normalizeMarkdownImportUrl('http://example.com/#top')).toBe('http://example.com/')
    })

    it('rejects unsupported protocols', () => {
        expect(() => normalizeMarkdownImportUrl('ftp://example.com/source.txt')).toThrow(MarkdownNewImportError)
        try {
            normalizeMarkdownImportUrl('ftp://example.com/source.txt')
        } catch (err) {
            expect(err).toMatchObject({ code: 'unsupported-url' })
        }
    })

    it('imports trimmed markdown through the BFF and exposes rate-limit metadata', async () => {
        const importer = vi.fn(async () => ({
            source_url: 'https://example.com/',
            markdown: '\n# Source\n',
            rate_limit_remaining: '499',
        }))

        const result = await importMarkdownFromUrl('example.com', importer)

        expect(importer).toHaveBeenCalledWith('https://example.com/')
        expect(result).toMatchObject({
            sourceUrl: 'https://example.com/',
            markdown: '# Source',
            rateLimitRemaining: '499',
        })
    })

    it('maps BFF rate limits and conversion failures to typed errors', async () => {
        await expect(importMarkdownFromUrl('example.com', vi.fn(async () => {
            throw new ApiError(429, 'Rate limited')
        })))
            .rejects.toMatchObject({ code: 'rate-limited', status: 429 })

        await expect(importMarkdownFromUrl('example.com', vi.fn(async () => {
            throw new ApiError(502, 'Conversion failed')
        }))).rejects.toMatchObject({
            code: 'conversion-failed',
            status: 502,
        })
    })

    it('derives resource title and markdown filename from markdown.new output', () => {
        expect(deriveMarkdownResourceIdentity(
            'Title: Example Domain\n\nMarkdown Content:\n# Ignored heading',
            'https://example.com',
        )).toEqual({
            title: 'Example Domain',
            fileName: 'example-domain.md',
        })

        expect(deriveMarkdownResourceIdentity('# Mirror Court', 'https://docs.example.com/source')).toEqual({
            title: 'Mirror Court',
            fileName: 'mirror-court.md',
        })
    })
})
