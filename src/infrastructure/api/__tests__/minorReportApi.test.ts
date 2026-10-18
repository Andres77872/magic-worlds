import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiService } from '../index'

/** "Report a minor" (R2-BE-02, EP-10): the reporter routes and the root review queue. */

const WS_A = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function call(index = 0): { url: URL; init: RequestInit; headers: Record<string, string> } {
    const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
    return { url: new URL(String(url), 'http://localhost'), init, headers: init.headers as Record<string, string> }
}

const ITEM = {
    report_id: 'r-1',
    reporter_user_id: 3,
    reported_user_id: 9,
    subject_kind: 'username',
    subject_ref: 'kid_01',
    reason: 'stated_age',
    details: null,
    reporter_eligible: true,
    hold: { restriction_id: 'h-1', ends_at: '2026-10-14T12:00:00Z', lifted_at: null },
    status: 'open',
    review_outcome: null,
    reviewed_at: null,
    created_at: '2026-10-13T12:00:00Z',
}

describe('minor report API (EP-10)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'token-1')
        vi.stubGlobal('fetch', fetchMock)
        setTestFeatureFlags({ voices: true })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        localStorage.clear()
    })

    it('reads the status from GET /reports/minor/status, account-scoped (no workspace header)', async () => {
        const status = { enabled: true, can_report: true, reports_left_today: 3, reason: null }
        fetchMock.mockResolvedValueOnce(jsonResponse(status))

        await expect(apiService.withWorkspace(WS_A).getMinorReportStatus()).resolves.toEqual(status)
        const { url, init, headers } = call()
        expect(url.pathname).toMatch(/\/reports\/minor\/status$/)
        expect(url.search).toBe('')
        expect(init.method).toBe('GET')
        expect(headers.Authorization).toBe('Bearer token-1')
        expect(headers).not.toHaveProperty('X-Workspace-Id')
    })

    it('posts the report body as is to POST /reports/minor', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ report_id: 'r-1', received: true }, 202))
        const body = { subject_kind: 'public_card' as const, subject_ref: 'card-123', reason: 'content' as const, details: 'Says 14.' }

        await expect(apiService.withWorkspace(WS_A).submitMinorReport(body)).resolves.toEqual({ report_id: 'r-1', received: true })
        const { url, init, headers } = call()
        expect(url.pathname).toMatch(/\/reports\/minor$/)
        expect(init.method).toBe('POST')
        expect(JSON.parse(String(init.body))).toEqual(body)
        expect(headers).not.toHaveProperty('X-Workspace-Id')
    })

    it.each([
        [429, 'minor_report_limit'],
        [403, 'minor_report_disabled'],
        [404, 'not_found'],
    ])('surfaces a %i as an ApiError with its code', async (status, code) => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ detail: { code, message: 'refused' } }, status))
        const failure = await apiService.submitMinorReport({ subject_kind: 'username', subject_ref: 'x', reason: 'other' }).catch((error: unknown) => error)

        expect(failure).toBeInstanceOf(ApiError)
        expect(failure).toMatchObject({ status, code })
    })

    it('lists the review queue with status, limit and the before cursor', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ items: [ITEM], next_before: 'cursor-2' }))

        const page = await apiService.adminListMinorReports({ status: 'open', limit: 50, before: 'cursor-1' })

        expect(page).toEqual({ items: [ITEM], next_before: 'cursor-2' })
        const { url, init, headers } = call()
        expect(url.pathname).toMatch(/\/admin\/voices\/minor-reports$/)
        expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'open', limit: '50', before: 'cursor-1' })
        expect(init.method).toBe('GET')
        expect(headers).not.toHaveProperty('X-Workspace-Id')
    })

    it('leaves out empty filters', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ items: [], next_before: null }))
        await apiService.adminListMinorReports()
        expect(call().url.search).toBe('')
    })

    it('posts one review outcome per report, escaping the id', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ ...ITEM, status: 'lifted', review_outcome: 'unfounded' }))

        const updated = await apiService.adminReviewMinorReport('r/1', 'unfounded')

        expect(updated.review_outcome).toBe('unfounded')
        const { url, init } = call()
        expect(url.pathname).toMatch(/\/admin\/voices\/minor-reports\/r%2F1\/review$/)
        expect(init.method).toBe('POST')
        expect(JSON.parse(String(init.body))).toEqual({ outcome: 'unfounded' })
    })

    it('surfaces a second review as 409 minor_report_reviewed', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ detail: { code: 'minor_report_reviewed', message: 'Already reviewed.' } }, 409))
        await expect(apiService.adminReviewMinorReport('r-1', 'escalated')).rejects.toMatchObject({ status: 409, code: 'minor_report_reviewed' })
    })

    it('sends nothing while voices are disabled', async () => {
        setTestFeatureFlags({ voices: false })
        await expect(apiService.getMinorReportStatus()).rejects.toThrow('Voices are disabled.')
        await expect(apiService.submitMinorReport({ subject_kind: 'username', subject_ref: 'x', reason: 'other' })).rejects.toThrow('Voices are disabled.')
        await expect(apiService.adminListMinorReports()).rejects.toThrow('Voices are disabled.')
        await expect(apiService.adminReviewMinorReport('r-1', 'unfounded')).rejects.toThrow('Voices are disabled.')
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
