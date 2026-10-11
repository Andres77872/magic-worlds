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

    it('keeps the stable code of profile and execution errors that carry no message', () => {
        expect(normalizeApiErrorBody({ detail: { code: 'BYOK_CREDENTIAL_REQUIRED', role: 'primary' } }, { requestId: 'header-id' })).toMatchObject({
            message: 'BYOK_CREDENTIAL_REQUIRED', code: 'BYOK_CREDENTIAL_REQUIRED', requestId: 'header-id',
            details: { code: 'BYOK_CREDENTIAL_REQUIRED', role: 'primary' },
        })
        expect(normalizeApiErrorBody({ detail: { role: 'primary' } })).toBeNull()
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
