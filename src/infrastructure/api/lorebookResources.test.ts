import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from './index'
import type { LorebookResource } from '@/shared'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    })
}

function resource(overrides: Partial<LorebookResource> = {}): LorebookResource {
    return {
        id: 'resource-1',
        title: 'Archive',
        description: 'Court notes.',
        triggers: ['mirror court'],
        fileName: 'archive.md',
        fileType: 'md',
        content: 'The mirror court keeps a glass seal.',
        contentLength: 37,
        extractionStatus: 'pending',
        extraction: null,
        ...overrides,
    }
}

describe('lorebook resource API wire format', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', 'true')
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'test-token')
        vi.stubGlobal('fetch', fetchMock)
        fetchMock.mockResolvedValue(jsonResponse(resource({ extractionStatus: 'completed' })))
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('saves pending standalone resources without extraction unless requested', async () => {
        await apiService.createLorebookResource(resource())

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toContain('/lorebook-resources')
        expect(url).not.toContain('extractMetadata=true')
        const body = JSON.parse(String(init.body))
        expect(body).toMatchObject({
            id: 'resource-1',
            title: 'Archive',
            fileName: 'archive.md',
            fileType: 'md',
            content: 'The mirror court keeps a glass seal.',
            contentLength: 37,
        })
        expect(body).not.toHaveProperty('extraction')
        expect(body).not.toHaveProperty('extractionStatus')
    })

    it('requests extraction only when resource metadata sync is explicit', async () => {
        await apiService.createLorebookResource(resource(), { extractMetadata: true, requestId: 'resource-sync-1' })

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toContain('/lorebook-resources?extractMetadata=true')
        expect(init.headers).toMatchObject({
            'X-Request-Id': 'resource-sync-1',
            'Idempotency-Key': 'resource-sync-1',
        })
    })

    it('does not request extraction for unchanged completed standalone resources', async () => {
        await apiService.updateLorebookResource('resource-1', resource({
            extractionStatus: 'completed',
            extraction: {
                keywords: ['mirror court'],
                shortSummary: 'Court notes.',
                longSummary: 'Long court notes.',
                snippets: [],
            },
        }))

        const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toContain('/lorebook-resources/resource-1')
        expect(url).not.toContain('extractMetadata=true')
    })

    it('does not request extraction for lorebook payloads unless requested', async () => {
        await apiService.createLorebook({
            name: 'Archive lore',
            tags: [],
            enabled: true,
            metadata: { resources: [resource()] },
        })

        const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toContain('/lorebooks')
        expect(url).not.toContain('extractMetadata=true')
    })

    it('requests extraction for lorebook payloads when metadata sync is explicit', async () => {
        await apiService.createLorebook({
            name: 'Archive lore',
            tags: [],
            enabled: true,
            metadata: { resources: [resource()] },
        }, { extractMetadata: true })

        const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toContain('/lorebooks?extractMetadata=true')
    })
})
