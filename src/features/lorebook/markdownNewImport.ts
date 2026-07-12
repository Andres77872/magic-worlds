import { ApiError, apiService } from '@/infrastructure/api'

export type MarkdownNewImportErrorCode =
    | 'invalid-url'
    | 'unsupported-url'
    | 'rate-limited'
    | 'conversion-failed'
    | 'empty-response'

export interface MarkdownNewImportResult {
    sourceUrl: string
    markdown: string
    rateLimitRemaining?: string | null
}

export interface MarkdownResourceIdentity {
    title: string
    fileName: string
}

export class MarkdownNewImportError extends Error {
    code: MarkdownNewImportErrorCode
    status?: number

    constructor(code: MarkdownNewImportErrorCode, message: string, options: { status?: number } = {}) {
        super(message)
        this.name = 'MarkdownNewImportError'
        this.code = code
        this.status = options.status
    }
}

type MarkdownImporter = typeof apiService.importMarkdownUrl

export function normalizeMarkdownImportUrl(input: string): string {
    const trimmed = input.trim()
    if (!trimmed) {
        throw new MarkdownNewImportError('invalid-url', 'Enter a URL to import.')
    }

    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
        ? trimmed
        : `https://${trimmed.replace(/^\/\//, '')}`

    let url: URL
    try {
        url = new URL(candidate)
    } catch {
        throw new MarkdownNewImportError('invalid-url', 'Enter a valid URL.')
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new MarkdownNewImportError('unsupported-url', 'Only http and https URLs can be imported.')
    }

    url.hash = ''
    return url.toString()
}

export async function importMarkdownFromUrl(
    input: string,
    importer: MarkdownImporter = apiService.importMarkdownUrl.bind(apiService),
): Promise<MarkdownNewImportResult> {
    const sourceUrl = normalizeMarkdownImportUrl(input)
    let response: Awaited<ReturnType<MarkdownImporter>>
    try {
        response = await importer(sourceUrl)
    } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
            throw new MarkdownNewImportError(
                'rate-limited',
                'markdown.new rate limit reached.',
                { status: error.status },
            )
        }
        throw new MarkdownNewImportError(
            'conversion-failed',
            'The server could not convert that URL.',
            { status: error instanceof ApiError ? error.status : undefined },
        )
    }

    const markdown = response.markdown.trim()
    if (!markdown) {
        throw new MarkdownNewImportError(
            'empty-response',
            'markdown.new returned an empty response.',
        )
    }

    return {
        sourceUrl: response.source_url,
        markdown,
        rateLimitRemaining: response.rate_limit_remaining,
    }
}

export function deriveMarkdownResourceIdentity(markdown: string, sourceUrl: string): MarkdownResourceIdentity {
    const metadataTitle = markdown.match(/^Title:[ \t]*(.+)$/im)?.[1]
    const firstHeading = markdown.match(/^#\s+(.+)$/m)?.[1]
    const host = hostTitle(sourceUrl)
    const title = cleanTitle(metadataTitle ?? firstHeading ?? host) || 'Imported resource'
    return {
        title,
        fileName: `${slugifyFileStem(title || host || 'imported-resource')}.md`,
    }
}

function hostTitle(sourceUrl: string): string {
    try {
        return new URL(sourceUrl).hostname.replace(/^www\./i, '')
    } catch {
        return 'Imported resource'
    }
}

function cleanTitle(value: string): string {
    return value
        .replace(/[*_`#>\[\]()]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120)
}

function slugifyFileStem(value: string): string {
    const stem = value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
    return stem || 'imported-resource'
}
