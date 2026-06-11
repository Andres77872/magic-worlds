import { describe, it, expect, vi } from 'vitest'
import { apiService, resolveMediaUrl } from './index'

describe('resolveMediaUrl', () => {
    it('returns undefined for empty input', () => {
        expect(resolveMediaUrl(undefined)).toBeUndefined()
        expect(resolveMediaUrl(null)).toBeUndefined()
        expect(resolveMediaUrl('')).toBeUndefined()
    })

    it('passes absolute / data / blob URLs through unchanged', () => {
        expect(resolveMediaUrl('https://cdn.example/x.png')).toBe('https://cdn.example/x.png')
        expect(resolveMediaUrl('http://cdn.example/x.png')).toBe('http://cdn.example/x.png')
        expect(resolveMediaUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA')
        expect(resolveMediaUrl('blob:abc-123')).toBe('blob:abc-123')
    })

    it('prefixes backend-relative paths with the API base', () => {
        const out = resolveMediaUrl('/generated-images/u/j/0.jpeg')
        expect(out).toBeDefined()
        expect(out!.startsWith('http')).toBe(true)
        expect(out!.endsWith('/generated-images/u/j/0.jpeg')).toBe(true)
    })

    it('adds a leading slash when the relative path lacks one', () => {
        const out = resolveMediaUrl('generated-audio/theme.mp3')
        expect(out!.endsWith('/generated-audio/theme.mp3')).toBe(true)
    })
})

describe('uploadCardImage', () => {
    it('POSTs the file as multipart form-data without a JSON content type', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
                asset_id: 'up-1',
                url: '/generated-images/uploads/2026/06/up-1.png',
                content_type: 'image/png',
                file_size_bytes: 10,
            }),
        }) as unknown as Response)
        vi.stubGlobal('fetch', fetchMock)

        const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'p.png', { type: 'image/png' })
        const res = await apiService.uploadCardImage(file)

        expect(res.url).toBe('/generated-images/uploads/2026/06/up-1.png')
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
        expect(String(url)).toContain('/images/upload')
        expect(init.method).toBe('POST')
        expect(init.body).toBeInstanceOf(FormData)
        // The browser must set `multipart/form-data; boundary=…` itself.
        expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()

        vi.unstubAllGlobals()
    })
})

describe('waitForImageJob', () => {
    it('polls until the job reaches a terminal status', async () => {
        const spy = vi
            .spyOn(apiService, 'getImageJob')
            .mockResolvedValueOnce({ job_id: 'j', status: 'in_progress', status_url: '', result_url: '', assets: [] })
            .mockResolvedValueOnce({
                job_id: 'j',
                status: 'completed',
                status_url: '',
                result_url: '',
                assets: [{ asset_id: 'a', url: '/generated-images/x.jpeg', content_type: 'image/jpeg' }],
            })
        const job = await apiService.waitForImageJob('j', { intervalMs: 1 })
        expect(job.status).toBe('completed')
        expect(job.assets?.[0]?.url).toBe('/generated-images/x.jpeg')
        expect(spy).toHaveBeenCalledTimes(2)
        spy.mockRestore()
    })
})

describe('listImageJobs', () => {
    function jsonFetchMock(payload: unknown) {
        return vi.fn(async () => ({
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => payload,
        }) as unknown as Response)
    }

    it('includes card_type/card_id only when provided', async () => {
        const fetchMock = jsonFetchMock({ items: [], limit: 24, offset: 0, next_offset: null })
        vi.stubGlobal('fetch', fetchMock)

        await apiService.listImageJobs({ cardType: 'character', cardId: 'card-9' })
        let [url] = fetchMock.mock.calls[0] as unknown as [string]
        expect(String(url)).toContain('/images/jobs?')
        expect(String(url)).toContain('status=completed')
        expect(String(url)).toContain('card_type=character')
        expect(String(url)).toContain('card_id=card-9')

        await apiService.listImageJobs({})
        ;[url] = fetchMock.mock.calls[1] as unknown as [string]
        expect(String(url)).not.toContain('card_type=')
        expect(String(url)).not.toContain('card_id=')

        vi.unstubAllGlobals()
    })
})

describe('listUserThemeSongs', () => {
    it('GETs /theme-songs/user with only the provided filters and parses next_offset', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({ items: [], limit: 20, offset: 20, next_offset: 40 }),
        }) as unknown as Response)
        vi.stubGlobal('fetch', fetchMock)

        const res = await apiService.listUserThemeSongs({ targetType: 'world', status: 'completed', offset: 20 })
        expect(res.next_offset).toBe(40)
        let [url] = fetchMock.mock.calls[0] as unknown as [string]
        expect(String(url)).toContain('/theme-songs/user?')
        expect(String(url)).toContain('target_type=world')
        expect(String(url)).toContain('status=completed')
        expect(String(url)).toContain('offset=20')
        expect(String(url)).not.toContain('target_id=')

        await apiService.listUserThemeSongs()
        ;[url] = fetchMock.mock.calls[1] as unknown as [string]
        expect(String(url)).toContain('limit=20')
        expect(String(url)).not.toContain('target_type=')

        vi.unstubAllGlobals()
    })
})

describe('tasks API', () => {
    it('lists and cancels theme-song background tasks', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({ items: [], limit: 20, offset: 0, next_offset: null }),
        }) as unknown as Response)
        vi.stubGlobal('fetch', fetchMock)

        await apiService.listTasks({ state: 'all', operation: 'theme_song', statuses: ['failed', 'canceled'], limit: 10, offset: 5 })
        let [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
        expect(String(url)).toContain('/tasks?')
        expect(String(url)).toContain('state=all')
        expect(String(url)).toContain('operation=theme_song')
        expect(String(url)).toContain('status=failed')
        expect(String(url)).toContain('status=canceled')
        expect(String(url)).toContain('limit=10')
        expect(String(url)).toContain('offset=5')
        expect(init.method).toBe('GET')

        await apiService.cancelTask('theme_song', 'job-1')
        ;[url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
        expect(String(url)).toContain('/tasks/theme_song/job-1')
        expect(init.method).toBe('DELETE')

        vi.unstubAllGlobals()
    })
})
