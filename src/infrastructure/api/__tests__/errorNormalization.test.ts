import { describe, expect, it } from 'vitest'
import { normalizeApiErrorBody } from '../index'

describe('API error normalization', () => {
    it('normalizes nested provider and detail envelopes', () => {
        expect(normalizeApiErrorBody({
            detail: {
                message: 'Asset remains referenced.',
                category: 'conflict',
                code: 'asset_in_use',
            },
        }, { requestId: 'header-id' })).toEqual({
            message: 'Asset remains referenced.',
            category: 'conflict',
            code: 'asset_in_use',
            requestId: 'header-id',
            retryable: undefined,
            retryAfterSeconds: undefined,
            action: undefined,
            details: {
                message: 'Asset remains referenced.',
                category: 'conflict',
                code: 'asset_in_use',
            },
        })

        expect(normalizeApiErrorBody({
            error: {
                detail: { message: 'Provider unavailable', category: 'provider', code: 'upstream_down' },
            },
        })?.message).toBe('Provider unavailable')
    })

    it('turns FastAPI validation arrays into a concise field message and preserves details', () => {
        const detail = [{
            type: 'string_too_long',
            loc: ['body', 'reason'],
            msg: 'String should have at most 255 characters',
            input: 'x'.repeat(256),
        }]
        expect(normalizeApiErrorBody({ detail })).toEqual({
            message: 'reason: String should have at most 255 characters',
            requestId: undefined,
            retryAfterSeconds: undefined,
            details: { validation: detail },
        })
    })
})
