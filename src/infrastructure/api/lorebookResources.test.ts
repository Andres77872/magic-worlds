import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from './index'
import type { LorebookResource } from '@/shared'
import { EXTRACTION_HASH as HASH, extractionResult } from './__tests__/fixtures/lorebookExtraction'
import { TASK_REQUEST_FINISHED, TASK_REQUEST_STARTED, type TaskRequestEvent } from './resourceTaskEvents'

const WORKSPACE_ID = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'

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
        })
        expect(body).not.toHaveProperty('extraction')
        expect(body).not.toHaveProperty('extractionStatus')
        expect(body).not.toHaveProperty('contentLength')
    })

    it('imports PDF bytes as authenticated multipart without a JSON content type or inference request', async () => {
        const file = new File(['%PDF-document'], 'court.pdf', { type: 'application/pdf' })
        fetchMock.mockResolvedValueOnce(jsonResponse(resource()))
        await apiService.importLorebookResourcePdf(file)
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toContain('/lorebook-resources/import-pdf')
        expect(init.method).toBe('POST')
        expect(init.body).toBeInstanceOf(FormData)
        expect((init.body as FormData).get('file')).toBe(file)
        expect(new Headers(init.headers).has('Content-Type')).toBe(false)
        expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-token')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('imports a PDF in the scoped workspace and tags its task events with that workspace', async () => {
        const events: Array<{ type: string; detail: TaskRequestEvent }> = []
        const record = (event: Event) => events.push({ type: event.type, detail: (event as CustomEvent<TaskRequestEvent>).detail })
        window.addEventListener(TASK_REQUEST_STARTED, record)
        window.addEventListener(TASK_REQUEST_FINISHED, record)
        try {
            fetchMock.mockResolvedValueOnce(jsonResponse(resource()))
            await apiService.withWorkspace(WORKSPACE_ID).importLorebookResourcePdf(new File(['%PDF-document'], 'court.pdf', { type: 'application/pdf' }))
            const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
            expect(url).toContain('/lorebook-resources/import-pdf')
            expect(new Headers(init.headers).get('X-Workspace-Id')).toBe(WORKSPACE_ID)
            expect(events.map((event) => event.type)).toEqual([TASK_REQUEST_STARTED, TASK_REQUEST_FINISHED])
            expect(events.every((event) => event.detail.workspaceId === WORKSPACE_ID)).toBe(true)
        } finally {
            window.removeEventListener(TASK_REQUEST_STARTED, record)
            window.removeEventListener(TASK_REQUEST_FINISHED, record)
        }
    })

    it('sends every task route of a scoped client with its workspace', async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ items: [], limit: 20, offset: 0, next_offset: null }))
        const scoped = apiService.withWorkspace(WORKSPACE_ID)
        await scoped.listTasks({ state: 'active', operation: 'all' })
        await scoped.getTask('pdf_import', 'task-1')
        await scoped.cancelTask('lorebook_extraction', 'task-2')
        await scoped.archiveTask('pdf_import', 'task-1')
        expect(fetchMock).toHaveBeenCalledTimes(4)
        for (const [url, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
            expect(String(url)).toContain('/tasks')
            expect(new Headers(init.headers).get('X-Workspace-Id')).toBe(WORKSPACE_ID)
        }
    })

    it('requests extraction only when resource metadata sync is explicit', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(extractionResult()))
        await apiService.extractLorebookResource('resource-1', { expected_evaluation_hash: HASH, llm: { selection: { mode: 'inherit' } } }, { requestId: 'resource-sync-1' })

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toContain('/lorebook-resources/resource-1/metadata-sync')
        expect(init.headers).toMatchObject({
            'X-Request-Id': 'resource-sync-1',
        })
        expect(init.headers).not.toHaveProperty('Idempotency-Key')
        expect(JSON.parse(String(init.body))).toEqual({ expected_evaluation_hash: HASH, llm: { selection: { mode: 'inherit' } } })
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
        fetchMock.mockResolvedValueOnce(jsonResponse(extractionResult({ lorebook_id: 'book-1' })))
        await apiService.extractLorebookResource('resource-1', { expected_evaluation_hash: HASH, llm: { selection: { mode: 'inherit' } } }, { requestId: 'book-sync-1' }, 'book-1')

        const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toContain('/lorebooks/book-1/resource-extractions/resource-1')
    })
})
