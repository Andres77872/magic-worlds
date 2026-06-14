import { describe, it, expect, vi } from 'vitest'
import { apiService, isProtectedMediaUrl, isPublicMediaUrl, resolveMediaUrl } from './index'

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

    it('normalizes absolute protected media URLs back through the configured API base', () => {
        const out = resolveMediaUrl('http://127.0.0.1:8010/generated-images/u/j/0.jpeg')
        expect(out).toBeDefined()
        expect(out!.endsWith('/generated-images/u/j/0.jpeg')).toBe(true)
        expect(out).not.toContain('127.0.0.1:8010')
    })
})

describe('isProtectedMediaUrl', () => {
    it('recognizes owned media routes and legacy generated media routes', () => {
        expect(isProtectedMediaUrl('/images/assets/asset-1')).toBe(true)
        expect(isProtectedMediaUrl('/theme-songs/assets/song-1.mp3')).toBe(true)
        expect(isProtectedMediaUrl('/generated-images/2026/06/job/asset.png')).toBe(true)
        expect(isProtectedMediaUrl('/generated-audio/2026/06/job/asset.mp3')).toBe(true)
        expect(isProtectedMediaUrl('/tts/assets/asset-1.mp3')).toBe(true)
        expect(isProtectedMediaUrl('http://127.0.0.1:8010/generated-images/2026/06/job/asset.png')).toBe(true)
    })

    it('does not treat external or browser-local URLs as protected backend media', () => {
        expect(isProtectedMediaUrl('https://cdn.example/image.png')).toBe(false)
        expect(isProtectedMediaUrl('data:image/png;base64,AAA')).toBe(false)
        expect(isProtectedMediaUrl('blob:abc-123')).toBe(false)
    })

    it('treats public/shared card media routes as NON-protected so they load without a token', () => {
        expect(isProtectedMediaUrl('/images/public/asset-1')).toBe(false)
        expect(isProtectedMediaUrl('/theme-songs/public/song-1.mp3')).toBe(false)
        expect(isProtectedMediaUrl('http://127.0.0.1:8010/images/public/asset-1')).toBe(false)
    })
})

describe('isPublicMediaUrl', () => {
    it('recognizes the public/shared card media routes', () => {
        expect(isPublicMediaUrl('/images/public/asset-1')).toBe(true)
        expect(isPublicMediaUrl('/theme-songs/public/song-1.mp3')).toBe(true)
        expect(isPublicMediaUrl('http://127.0.0.1:8010/images/public/asset-1')).toBe(true)
    })

    it('does not treat owner-only or external URLs as public', () => {
        expect(isPublicMediaUrl('/images/assets/asset-1')).toBe(false)
        expect(isPublicMediaUrl('/theme-songs/assets/song-1.mp3')).toBe(false)
        expect(isPublicMediaUrl('https://cdn.example/image.png')).toBe(false)
        expect(isPublicMediaUrl('data:image/png;base64,AAA')).toBe(false)
    })

    it('resolves a public URL to an absolute, token-free src', () => {
        const out = resolveMediaUrl('/images/public/asset-1')
        expect(out).toBeDefined()
        expect(out!.startsWith('http')).toBe(true)
        expect(out!.endsWith('/images/public/asset-1')).toBe(true)
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
                url: '/images/assets/up-1',
                content_type: 'image/png',
                file_size_bytes: 10,
            }),
        }) as unknown as Response)
        vi.stubGlobal('fetch', fetchMock)

        const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'p.png', { type: 'image/png' })
        const res = await apiService.uploadCardImage(file)

        expect(res.url).toBe('/images/assets/up-1')
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
                assets: [{ asset_id: 'a', url: '/images/assets/a', content_type: 'image/jpeg' }],
            })
        const job = await apiService.waitForImageJob('j', { intervalMs: 1 })
        expect(job.status).toBe('completed')
        expect(job.assets?.[0]?.url).toBe('/images/assets/a')
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
