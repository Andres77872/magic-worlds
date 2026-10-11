import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService, ApiError } from '../index'

const canary = 'FAKE_THEME_JSON_SECRET_SENTINEL'
const fetchMock = vi.fn()
const job = {
    job_id: 'song-1', target: { type: 'character', id: 'card-1', display_name: 'Sailor' },
    operation: 'theme_song', status: 'completed', model_alias: 'minimax_music_3', instrumental: false,
    status_url: '/theme-songs/jobs/song-1', result_url: '/theme-songs/jobs/song-1/result',
    lyrics: { source: 'writer', lyrics_sha256: 'a'.repeat(64), lyrics_length_chars: 80 },
    assets: [{ asset_id: 'audio-1', url: '/theme-songs/assets/audio-1.mp3', content_type: 'audio/mpeg',
        output_format: 'mp3', file_size_bytes: 1024, duration_ms: 60000, sample_rate: 44100, channels: 2, bitrate: 192000 }],
    error: null, created_at: '2026-10-09T00:00:00', updated_at: '2026-10-09T00:01:00',
}
type Job = typeof job
const command = { target_type: 'character' as const, target_id: 'card-1', description: 'A nautical theme.' }
const endpoints = [
    { name: 'submit', call: () => apiService.generateThemeSong(command), list: false, target: false },
    { name: 'job', call: () => apiService.getThemeSongJob('song-1'), list: false, target: false },
    { name: 'result', call: () => apiService.getThemeSongResult('song-1'), list: false, target: false },
    { name: 'card list', call: () => apiService.listThemeSongs('character', 'card-1'), list: true, target: true },
    { name: 'user list', call: () => apiService.listUserThemeSongs(), list: true, target: false },
]

beforeEach(() => {
    localStorage.setItem('magic_worlds:token', 'fixture-token')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
})

function respond(body: unknown) {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
}

function envelope(value: Job, endpoint: typeof endpoints[number]): unknown {
    return endpoint.list ? { items: [value], limit: 20, offset: 0, next_offset: null,
        ...(endpoint.target ? { target: value.target } : {}) } : value
}

describe.each(endpoints)('$name accepts only current theme song responses', (endpoint) => {
    it('returns the current job or bounded list from a single response', async () => {
        const body = envelope(job, endpoint)
        respond(body)
        expect(await endpoint.call()).toEqual(body)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['removed model', (value: Job) => { value.model_alias = 'music_3_0' }],
        ['other removed model', (value: Job) => { value.model_alias = 'music_2_6' }],
        ['unknown model', (value: Job) => { value.model_alias = canary }],
        ['removed source', (value: Job) => { value.lyrics.source = 'optimizer' }],
        ['unknown source', (value: Job) => { value.lyrics.source = canary }],
        ['missing digest', (value: Job) => { value.lyrics.lyrics_sha256 = '' }],
        ['boolean length', (value: Job) => { Object.assign(value.lyrics, { lyrics_length_chars: true }) }],
        ['contradictory instrumental', (value: Job) => { value.instrumental = true }],
        ['provider url', (value: Job) => { value.assets[0].url = `https://provider.invalid/${canary}` }],
        ['removed audio url', (value: Job) => { value.assets[0].url = `/generated-audio/${canary}.mp3` }],
        ['wrong asset identity', (value: Job) => { value.assets[0].asset_id = 'other-asset' }],
        ['extra private field', (value: Job) => { Object.assign(value, { api_key: canary }) }],
        ['private asset field', (value: Job) => { Object.assign(value.assets[0], { storage_path: canary }) }],
        ['leaked lyric text', (value: Job) => { Object.assign(value.lyrics, { text: canary }) }],
        ['failed without error', (value: Job) => { value.status = 'failed' }],
        ['completed with error', (value: Job) => { Object.assign(value, { error: { category: 'timeout', detail: canary } }) }],
        ['wrong result url', (value: Job) => { value.result_url = `/theme-songs/jobs/${canary}/result` }],
        ['malformed target', (value: Job) => { Object.assign(value.target, { id: 7 }) }],
    ])('rejects %s without returning input or retrying', async (_label, mutate) => {
        const value = structuredClone(job)
        mutate(value)
        respond(envelope(value, endpoint))
        const error = await endpoint.call().catch((error: unknown) => error)
        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ status: 502, code: 'workflow_execution_contract', retryable: false })
        expect(String(error)).not.toContain(canary)
        expect(JSON.stringify(error)).not.toContain(canary)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})

it.each(['job', 'result'])('rejects a different job identity from the %s endpoint', async (name) => {
    const value = structuredClone(job)
    value.job_id = 'other-job'
    value.status_url = '/theme-songs/jobs/other-job'
    value.result_url = '/theme-songs/jobs/other-job/result'
    respond(value)
    await expect(endpoints.find((endpoint) => endpoint.name === name)!.call()).rejects.toMatchObject({ status: 502 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('rejects a submitted job belonging to a different target', async () => {
    respond({ ...job, target: { ...job.target, id: 'other-card' } })
    await expect(apiService.generateThemeSong(command)).rejects.toMatchObject({ status: 502 })
})

it('rejects an unexpected target on a card list', async () => {
    respond({ items: [job], target: { ...job.target, id: 'other-card' }, limit: 20, offset: 0 })
    await expect(apiService.listThemeSongs('character', 'card-1')).rejects.toMatchObject({ status: 502 })
})

it('rejects extra list fields and coerced pagination', async () => {
    for (const body of [
        { items: [job], limit: 20, offset: 0, provider_key: canary },
        { items: [job], limit: '20', offset: 0 },
    ]) {
        respond(body)
        await expect(apiService.listUserThemeSongs()).rejects.toMatchObject({ status: 502 })
    }
})
