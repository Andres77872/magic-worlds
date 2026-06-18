const MARKDOWN_NEW_BASE_URL = 'https://markdown.new'

export type MarkdownNewImportErrorCode =
    | 'invalid-url'
    | 'unsupported-url'
    | 'rate-limited'
    | 'conversion-failed'
    | 'cors'
    | 'empty-response'

export interface MarkdownNewImportResult {
    sourceUrl: string
    conversionUrl: string
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
    conversionUrl?: string

    constructor(code: MarkdownNewImportErrorCode, message: string, options: { status?: number; conversionUrl?: string } = {}) {
        super(message)
        this.name = 'MarkdownNewImportError'
        this.code = code
        this.status = options.status
        this.conversionUrl = options.conversionUrl
    }
}

type MarkdownFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

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

export function buildMarkdownNewConversionUrl(input: string): string {
    return `${MARKDOWN_NEW_BASE_URL}/${normalizeMarkdownImportUrl(input)}`
}

export async function importMarkdownFromUrl(input: string, fetcher: MarkdownFetch = fetch): Promise<MarkdownNewImportResult> {
    const sourceUrl = normalizeMarkdownImportUrl(input)
    const conversionUrl = `${MARKDOWN_NEW_BASE_URL}/${sourceUrl}`

    let response: Response
    try {
        response = await fetcher(conversionUrl, {
            method: 'GET',
            credentials: 'omit',
            headers: { Accept: 'text/markdown' },
        })
    } catch {
        throw new MarkdownNewImportError(
            'cors',
            'The browser could not read the markdown.new response.',
            { conversionUrl },
        )
    }

    if (response.status === 429) {
        throw new MarkdownNewImportError(
            'rate-limited',
            'markdown.new rate limit reached.',
            { status: response.status, conversionUrl },
        )
    }

    if (!response.ok) {
        throw new MarkdownNewImportError(
            'conversion-failed',
            'markdown.new could not convert that URL.',
            { status: response.status, conversionUrl },
        )
    }

    const markdown = (await response.text()).trim()
    if (!markdown) {
        throw new MarkdownNewImportError(
            'empty-response',
            'markdown.new returned an empty response.',
            { status: response.status, conversionUrl },
        )
    }

    return {
        sourceUrl,
        conversionUrl,
        markdown,
        rateLimitRemaining: response.headers.get('x-rate-limit-remaining'),
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
