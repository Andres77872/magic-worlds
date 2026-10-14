import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseMinorReportStatus, useMinorReportStatus } from './useMinorReportStatus'

const api = vi.hoisted(() => ({ getMinorReportStatus: vi.fn() }))

vi.mock('@/infrastructure/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/infrastructure/api')>()
    return { ...actual, apiService: api }
})

afterEach(() => {
    vi.clearAllMocks()
})

describe('parseMinorReportStatus', () => {
    it('reads a status body', () => {
        expect(parseMinorReportStatus({ enabled: true, can_report: true, reports_left_today: 2.7, reason: null })).toEqual({
            enabled: true,
            can_report: true,
            reports_left_today: 2,
            reason: null,
        })
        expect(parseMinorReportStatus({ enabled: true, can_report: false, reports_left_today: 0, reason: 'disabled' })?.reason).toBe('disabled')
    })

    it('fails closed', () => {
        expect(parseMinorReportStatus(null)).toBeNull()
        expect(parseMinorReportStatus('yes')).toBeNull()
        expect(parseMinorReportStatus({ enabled: 'true', can_report: true })).toBeNull()
        // A closed gate can never report; junk counts and reasons are dropped.
        expect(parseMinorReportStatus({ enabled: false, can_report: true, reports_left_today: -3, reason: 'other' })).toEqual({
            enabled: false,
            can_report: false,
            reports_left_today: 0,
            reason: null,
        })
    })
})

describe('useMinorReportStatus', () => {
    it('makes no request while signed out', () => {
        const { result } = renderHook(() => useMinorReportStatus(null))
        expect(result.current.status).toBeNull()
        expect(result.current.loading).toBe(false)
        expect(api.getMinorReportStatus).not.toHaveBeenCalled()
    })

    it('loads the status for the account and reloads without dropping it', async () => {
        let resolveSecond: (value: unknown) => void = () => {}
        api.getMinorReportStatus
            .mockResolvedValueOnce({ enabled: true, can_report: true, reports_left_today: 3, reason: null })
            .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))
        const { result } = renderHook(() => useMinorReportStatus('user:1'))

        expect(result.current.loading).toBe(true)
        await waitFor(() => expect(result.current.status?.reports_left_today).toBe(3))
        expect(result.current.loading).toBe(false)

        act(() => result.current.reload())
        expect(result.current.loading).toBe(true)
        // The last status stays while the reload is in flight (no flicker).
        expect(result.current.status?.reports_left_today).toBe(3)

        await act(async () => resolveSecond({ enabled: true, can_report: true, reports_left_today: 2, reason: null }))
        expect(result.current.status?.reports_left_today).toBe(2)
        expect(api.getMinorReportStatus).toHaveBeenCalledTimes(2)
    })

    it('reads a failure as closed', async () => {
        api.getMinorReportStatus.mockRejectedValueOnce(new Error('network'))
        const { result } = renderHook(() => useMinorReportStatus('user:1'))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.status).toBeNull()
    })

    it('never shows one account the status of another, and ignores a late answer', async () => {
        let resolveFirst: (value: unknown) => void = () => {}
        api.getMinorReportStatus
            .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
            .mockResolvedValueOnce({ enabled: false, can_report: false, reports_left_today: 0, reason: null })
        const { result, rerender } = renderHook(({ account }) => useMinorReportStatus(account), { initialProps: { account: 'user:1' as string | null } })

        rerender({ account: 'user:2' })
        await waitFor(() => expect(result.current.status?.enabled).toBe(false))
        await act(async () => resolveFirst({ enabled: true, can_report: true, reports_left_today: 3, reason: null }))
        expect(result.current.status?.enabled).toBe(false)

        rerender({ account: null })
        expect(result.current.status).toBeNull()
    })
})
