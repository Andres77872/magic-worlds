import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { LAB_MODELS } from '../../constants'
import { mergeLabModels, R0_LAB_MODELS, useLabModels } from './useLabModels'

const api = vi.hoisted(() => ({ listAdminLabModels: vi.fn() }))
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))

const row = (overrides: Record<string, unknown> = {}) => ({
    model_alias: 'el_v4',
    label: 'Eleven v4',
    tier: 'expressive',
    available: true,
    unavailable_reason: null,
    max_chars: 3000,
    output_formats: ['mp3_44100_128', 'pcm_24000', 'opus_48000_64'],
    text_normalization: ['auto', 'on', 'off'],
    supports_language_code: true,
    supports_seed: false,
    audio_tags: true,
    breaks: false,
    inline_ipa: true,
    settings: ['stability', 'similarity_boost', 'style', 'unknown_setting'],
    ...overrides,
})

describe('R0_LAB_MODELS', () => {
    it('is exactly the R0 lab: LAB_MODELS, two MP3 formats, auto normalization, no A4 limit', () => {
        expect(R0_LAB_MODELS.map((model) => model.alias)).toEqual(LAB_MODELS.map((profile) => profile.alias))
        for (const [index, model] of R0_LAB_MODELS.entries()) {
            expect(model).toMatchObject(LAB_MODELS[index])
            expect(model).toMatchObject({
                label: null,
                available: true,
                maxChars: null,
                outputFormats: ['mp3_44100_128', 'mp3_44100_64'],
                textNormalization: ['auto'],
                supportsSeed: true,
            })
        }
    })
})

describe('mergeLabModels (A4)', () => {
    it('takes the server row over the R0 profile, keeping only playable formats and known settings', () => {
        const [model] = mergeLabModels({ models: [row()] })!
        expect(model).toEqual({
            alias: 'el_v4',
            label: 'Eleven v4',
            tier: 'expressive',
            available: true,
            unavailableReason: null,
            maxChars: 3000,
            outputFormats: ['mp3_44100_128', 'pcm_24000'],
            textNormalization: ['auto', 'on', 'off'],
            sendsLanguageCode: true,
            supportsSeed: false,
            audioTags: true,
            breaks: false,
            inlineIpa: true,
            settings: ['stability', 'similarity_boost', 'style'],
        })
    })

    it('keeps the R0 value for a field the server omits or sends malformed', () => {
        const [model] = mergeLabModels({ models: [{ model_alias: 'el_v4', output_formats: ['flac'], text_normalization: 'auto', max_chars: -1 }] })!
        expect(model).toMatchObject({
            ...LAB_MODELS[0],
            label: null,
            maxChars: null,
            outputFormats: ['mp3_44100_128', 'mp3_44100_64'],
            textNormalization: ['auto'],
            supportsSeed: true,
            available: true,
        })
    })

    it('lists a server-only alias and marks an unavailable model', () => {
        const models = mergeLabModels({ models: [row({ model_alias: 'el_v5_preview', available: false, unavailable_reason: 'not_on_account' }), row()] })!
        expect(models.map((model) => model.alias)).toEqual(['el_v5_preview', 'el_v4'])
        expect(models[0]).toMatchObject({ available: false, unavailableReason: 'not_on_account' })
    })

    it('answers null for a body without usable rows (the caller keeps R0)', () => {
        expect(mergeLabModels({ models: [] })).toBeNull()
        expect(mergeLabModels({ models: [{ label: 'no alias' }] })).toBeNull()
        expect(mergeLabModels({ items: [row()] })).toBeNull()
        expect(mergeLabModels(null)).toBeNull()
    })
})

describe('useLabModels', () => {
    beforeEach(() => {
        api.listAdminLabModels.mockReset()
    })

    it.each([404, 501])('keeps exactly the R0 lab when the route answers %s', async (status) => {
        api.listAdminLabModels.mockRejectedValue(new ApiError(status, 'Not available'))
        const { result } = renderHook(() => useLabModels())
        expect(result.current).toMatchObject({ source: 'r0', loading: true })
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.source).toBe('r0')
        expect(result.current.models).toEqual(R0_LAB_MODELS)
    })

    it('uses the A4 list once it answers', async () => {
        api.listAdminLabModels.mockResolvedValue({ models: [row()] })
        const { result } = renderHook(() => useLabModels())
        await waitFor(() => expect(result.current.source).toBe('a4'))
        expect(result.current.models.map((model) => model.alias)).toEqual(['el_v4'])
        expect(api.listAdminLabModels).toHaveBeenCalledWith(expect.any(AbortSignal))
    })

    it('keeps R0 for an empty A4 answer', async () => {
        api.listAdminLabModels.mockResolvedValue({ models: [] })
        const { result } = renderHook(() => useLabModels())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.source).toBe('r0')
    })
})
