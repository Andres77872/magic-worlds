import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService, ATTESTATION_REQUIRED_EVENT, AttestationRequiredError, isAttestationRequiredError } from '../index'

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        clone() {
            return jsonResponse(body, status)
        },
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as unknown as Response
}

function requestOf(fetchMock: ReturnType<typeof vi.fn>, index = 0): { url: string; init: RequestInit } {
    const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
    return { url, init }
}

describe('attestation API (D26)', () => {
    beforeEach(() => {
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'token-1')
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
        localStorage.clear()
    })

    it('reads the status from GET /user/attestations', async () => {
        const status = { required: [{ kind: 'age_18_plus', version: '2026-10-01' }], accepted: [] }
        const fetchMock = vi.fn(async () => jsonResponse(status))
        vi.stubGlobal('fetch', fetchMock)

        await expect(apiService.getAttestationStatus()).resolves.toEqual(status)
        const { url, init } = requestOf(fetchMock)
        expect(url).toMatch(/\/user\/attestations$/)
        expect(init.method).toBe('GET')
    })

    it('posts one {kind, version, method} body per attestation', async () => {
        const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
            const body = JSON.parse(String(init.body)) as { kind: string; version: string }
            return jsonResponse({ kind: body.kind, version: body.version, accepted_at: '2026-10-12T00:00:00Z' }, 201)
        })
        vi.stubGlobal('fetch', fetchMock)

        const records = await apiService.submitAttestations(
            [{ kind: 'age_18_plus', version: '2026-10-01' }, { kind: 'terms_of_service', version: '2026-10-01' }],
            'signup_password',
        )

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(JSON.parse(String(requestOf(fetchMock, 0).init.body))).toEqual({ kind: 'age_18_plus', version: '2026-10-01', method: 'signup_password' })
        expect(JSON.parse(String(requestOf(fetchMock, 1).init.body))).toEqual({ kind: 'terms_of_service', version: '2026-10-01', method: 'signup_password' })
        expect(requestOf(fetchMock).init.method).toBe('POST')
        expect(requestOf(fetchMock).url).toMatch(/\/user\/attestations$/)
        expect(records.map((record) => record.kind)).toEqual(['age_18_plus', 'terms_of_service'])
    })

    it('turns a 428 into AttestationRequiredError and announces it', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
            detail: { code: 'attestation_required', message: 'Confirm your age and the terms first.' },
        }, 428)))
        const listener = vi.fn()
        window.addEventListener(ATTESTATION_REQUIRED_EVENT, listener)

        const failure = await apiService.saveVoiceConsent(7).catch((error: unknown) => error)

        window.removeEventListener(ATTESTATION_REQUIRED_EVENT, listener)
        expect(failure).toBeInstanceOf(AttestationRequiredError)
        expect(isAttestationRequiredError(failure)).toBe(true)
        expect(failure).toMatchObject({ status: 428, code: 'attestation_required', action: 'attest' })
        expect(listener).toHaveBeenCalledTimes(1)
    })
})
