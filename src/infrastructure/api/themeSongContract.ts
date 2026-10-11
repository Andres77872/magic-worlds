import type { ThemeSongJobPublic, ThemeSongListResponse, UserThemeSongListResponse } from '@/shared'

type RecordValue = Record<string, unknown>
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max = 255): value is string => typeof value === 'string' && value.length > 0
    && value.length <= max && value === value.trim()
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value)
const integer = (value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number =>
    Number.isSafeInteger(value) && !Object.is(value, -0) && (value as number) >= minimum && (value as number) <= maximum
const nullable = (value: unknown, verify: (value: unknown) => boolean): boolean => value === null || value === undefined || verify(value)
const fields = (value: RecordValue, required: string[], optional: string[] = []): boolean =>
    required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key))
const targets = ['character', 'world', 'adventure_template', 'item']
const statuses = ['pending', 'in_progress', 'synthesizing', 'mirroring', 'completed', 'failed', 'canceled']
const errors = ['validation', 'unavailable', 'quota_exceeded', 'prompt_writer', 'provider_submission', 'provider_completion',
    'content_moderation', 'timeout', 'upstream_contract', 'mirroring', 'storage', 'not_found', 'conflict', 'internal']

function target(value: unknown): boolean {
    return record(value) && fields(value, ['type', 'id'], ['display_name'])
        && targets.includes(value.type as string) && id(value.id) && nullable(value.display_name, text)
}

function lyrics(value: unknown, instrumental: boolean): boolean {
    if (!record(value) || !fields(value, ['source'], ['lyrics_sha256', 'lyrics_length_chars'])) return false
    if (value.source === 'instrumental') {
        return instrumental && value.lyrics_sha256 == null && value.lyrics_length_chars == null
    }
    return !instrumental && ['writer', 'user'].includes(value.source as string)
        && typeof value.lyrics_sha256 === 'string' && /^[0-9a-f]{64}$/.test(value.lyrics_sha256)
        && integer(value.lyrics_length_chars, 1)
}

function asset(value: unknown): boolean {
    return record(value) && fields(value, ['asset_id', 'url', 'content_type', 'file_size_bytes', 'output_format'],
        ['duration_ms', 'sample_rate', 'channels', 'bitrate'])
        && id(value.asset_id) && value.url === `/theme-songs/assets/${value.asset_id}.mp3`
        && value.content_type === 'audio/mpeg' && value.output_format === 'mp3' && integer(value.file_size_bytes, 1)
        && nullable(value.duration_ms, (value) => integer(value, 0))
        && nullable(value.sample_rate, (value) => integer(value, 8000, 48000))
        && nullable(value.channels, (value) => integer(value, 1, 2))
        && nullable(value.bitrate, (value) => integer(value, 32000, 320000))
}

function error(value: unknown): boolean {
    return record(value) && fields(value, ['category', 'detail'], ['code'])
        && errors.includes(value.category as string) && text(value.detail, 1000)
        && nullable(value.code, (value) => typeof value === 'string' && /^[A-Za-z0-9_]{1,80}$/.test(value))
}

export function verifyThemeSongJob(value: unknown): value is ThemeSongJobPublic {
    return record(value) && fields(value, ['job_id', 'target', 'operation', 'status', 'model_alias',
        'status_url', 'result_url', 'assets', 'created_at', 'updated_at'], ['instrumental', 'lyrics', 'error'])
        && id(value.job_id) && target(value.target) && value.operation === 'theme_song'
        && statuses.includes(value.status as string) && ['ace_step', 'minimax_music_3'].includes(value.model_alias as string)
        && (value.instrumental === undefined || typeof value.instrumental === 'boolean')
        && value.status_url === `/theme-songs/jobs/${value.job_id}` && value.result_url === `/theme-songs/jobs/${value.job_id}/result`
        && nullable(value.lyrics, (lyricsValue) => lyrics(lyricsValue, value.instrumental === true))
        && Array.isArray(value.assets) && value.assets.length <= 100 && value.assets.every(asset)
        && (value.status === 'failed' ? error(value.error) : value.error == null)
        && text(value.created_at, 80) && text(value.updated_at, 80)
}

function list(value: RecordValue): boolean {
    return Array.isArray(value.items) && value.items.length <= 100 && value.items.every(verifyThemeSongJob)
        && integer(value.limit, 1, 100) && integer(value.offset) && nullable(value.next_offset, integer)
}

export function verifyUserThemeSongList(value: unknown): value is UserThemeSongListResponse {
    return record(value) && fields(value, ['items', 'limit', 'offset'], ['next_offset']) && list(value)
}

export function verifyThemeSongList(value: unknown): value is ThemeSongListResponse {
    return record(value) && fields(value, ['items', 'target', 'limit', 'offset'], ['next_offset']) && target(value.target)
        && list(value) && (value.items as ThemeSongJobPublic[]).every((job) =>
            job.target.type === (value.target as RecordValue).type && job.target.id === (value.target as RecordValue).id)
}
