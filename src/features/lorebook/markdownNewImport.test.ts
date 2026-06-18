import { describe, expect, it, vi } from 'vitest'
import {
    MarkdownNewImportError,
    buildMarkdownNewConversionUrl,
    deriveMarkdownResourceIdentity,
    importMarkdownFromUrl,
    normalizeMarkdownImportUrl,
} from './markdownNewImport'

describe('markdown.new import helpers', () => {
    it('normalizes http URLs and strips fragments', () => {
        expect(normalizeMarkdownImportUrl('example.com/path?chapter=1#notes')).toBe('https://example.com/path?chapter=1')
        expect(normalizeMarkdownImportUrl('http://example.com/#top')).toBe('http://example.com/')
    })

    it('builds the markdown.new conversion URL without encoding the source URL', () => {
        expect(buildMarkdownNewConversionUrl('https://example.com/docs?chapter=1')).toBe(
            'https://markdown.new/https://example.com/docs?chapter=1',
        )
    })

    it('rejects unsupported protocols', () => {
        expect(() => normalizeMarkdownImportUrl('ftp://example.com/source.txt')).toThrow(MarkdownNewImportError)
        try {
            normalizeMarkdownImportUrl('ftp://example.com/source.txt')
        } catch (err) {
            expect(err).toMatchObject({ code: 'unsupported-url' })
        }
    })

    it('imports trimmed markdown and exposes rate-limit headers', async () => {
        const fetcher = vi.fn(async () => new Response('\n# Source\n', {
            headers: { 'x-rate-limit-remaining': '499' },
        }))

        const result = await importMarkdownFromUrl('example.com', fetcher)

        expect(fetcher).toHaveBeenCalledWith('https://markdown.new/https://example.com/', expect.objectContaining({
            method: 'GET',
            credentials: 'omit',
        }))
        expect(result).toMatchObject({
            sourceUrl: 'https://example.com/',
            conversionUrl: 'https://markdown.new/https://example.com/',
            markdown: '# Source',
            rateLimitRemaining: '499',
        })
    })

    it('maps rate limits, non-OK responses, and blocked browser reads to typed errors', async () => {
        await expect(importMarkdownFromUrl('example.com', vi.fn(async () => new Response('', { status: 429 }))))
            .rejects.toMatchObject({ code: 'rate-limited', status: 429 })

        await expect(importMarkdownFromUrl('example.com', vi.fn(async () => new Response('', { status: 500 }))))
            .rejects.toMatchObject({ code: 'conversion-failed', status: 500 })

        await expect(importMarkdownFromUrl('example.com', vi.fn(async () => {
            throw new TypeError('Failed to fetch')
        }))).rejects.toMatchObject({
            code: 'cors',
            conversionUrl: 'https://markdown.new/https://example.com/',
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
