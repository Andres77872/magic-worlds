import type { ContextType, ReactElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { AuthContext } from '@/app/providers/AuthProvider'
import { ensureSafetyLocales } from '@/features/safety/test/ensureSafetyLocales'
import { ApiError } from '@/infrastructure/api'
import type { MinorReportStatus } from '@/shared/types/minorReport.types'
import { MINOR_REPORT_LIMITS, minorReportBody, minorReportErrorKey } from './minorReportForm'
import { ReportMinorForm, ReportMinorFormView } from './ReportMinorForm'

const api = vi.hoisted(() => ({
    getMinorReportStatus: vi.fn(),
    submitMinorReport: vi.fn(),
}))

vi.mock('@/infrastructure/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/infrastructure/api')>()
    return { ...actual, apiService: api }
})

type AuthValue = NonNullable<ContextType<typeof AuthContext>>

const OPEN: MinorReportStatus = { enabled: true, can_report: true, reports_left_today: 3, reason: null }
const CLOSED: MinorReportStatus = { enabled: false, can_report: false, reports_left_today: 0, reason: null }

function inEnglish(ui: ReactElement) {
    return <I18nextProvider i18n={i18n.cloneInstance({ lng: 'en' })}>{ui}</I18nextProvider>
}

function renderForm(auth: Partial<AuthValue> | null) {
    const ui = auth === null ? <ReportMinorForm /> : <AuthContext.Provider value={auth as AuthValue}><ReportMinorForm /></AuthContext.Provider>
    return render(inEnglish(ui))
}

function renderView(status: MinorReportStatus = OPEN, onSubmit = vi.fn(async () => {})) {
    render(inEnglish(<ReportMinorFormView status={status} onSubmit={onSubmit} />))
    return onSubmit
}

function chooseReason(name: string) {
    fireEvent.click(screen.getByRole('combobox', { name: 'Reason' }))
    fireEvent.click(screen.getByRole('option', { name }))
}

function fillValid() {
    fireEvent.change(screen.getByRole('textbox', { name: 'Card ID or username' }), { target: { value: '  card-123  ' } })
    chooseReason('They said they are under 18')
}

beforeAll(ensureSafetyLocales)

beforeEach(() => {
    api.getMinorReportStatus.mockResolvedValue(OPEN)
    api.submitMinorReport.mockResolvedValue({ report_id: 'r-1', received: true })
})

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('minorReportBody', () => {
    it('trims, and leaves out empty details', () => {
        expect(minorReportBody('username', '  kid_01 ', 'content', '   ')).toEqual({ subject_kind: 'username', subject_ref: 'kid_01', reason: 'content' })
        expect(minorReportBody('public_card', 'c-1', 'other', ' said 14 ')).toEqual({
            subject_kind: 'public_card',
            subject_ref: 'c-1',
            reason: 'other',
            details: 'said 14',
        })
    })

    it('refuses out-of-range fields (EP-10 limits)', () => {
        expect(minorReportBody('username', '   ', 'content', '')).toBeNull()
        expect(minorReportBody('username', 'x', null, '')).toBeNull()
        expect(minorReportBody('username', 'x'.repeat(MINOR_REPORT_LIMITS.subjectRef + 1), 'content', '')).toBeNull()
        expect(minorReportBody('username', 'x'.repeat(MINOR_REPORT_LIMITS.subjectRef), 'content', '')).not.toBeNull()
        expect(minorReportBody('username', 'x', 'content', 'd'.repeat(MINOR_REPORT_LIMITS.details + 1))).toBeNull()
    })

    it('refuses control characters in the reference, as EP-10 SubjectRef does', () => {
        expect(minorReportBody('username', 'kid\t01', 'content', '')).toBeNull()
        expect(minorReportBody('username', 'kid\u007f', 'content', '')).toBeNull()
        expect(minorReportBody('username', 'kid\u000001', 'content', '')).toBeNull()
        // Surrounding whitespace is trimmed first, as on the server.
        expect(minorReportBody('username', '\tkid_01\n', 'content', '')).toEqual({ subject_kind: 'username', subject_ref: 'kid_01', reason: 'content' })
    })
})

describe('minorReportErrorKey', () => {
    it('maps the EP-10 refusals to copy', () => {
        expect(minorReportErrorKey(new ApiError(429, 'limit', { code: 'minor_report_limit' }))).toBe('minorReports.errors.limit')
        expect(minorReportErrorKey(new ApiError(403, 'off', { code: 'minor_report_disabled' }))).toBe('minorReports.errors.disabled')
        expect(minorReportErrorKey(new ApiError(422, 'bad'))).toBe('minorReports.errors.invalid')
        expect(minorReportErrorKey(new ApiError(500, 'boom'))).toBe('minorReports.errors.generic')
        expect(minorReportErrorKey(new Error('offline'))).toBe('minorReports.errors.generic')
    })
})

describe('ReportMinorFormView', () => {
    it('sends the trimmed body and then shows only the thank-you copy', async () => {
        const onSubmit = renderView()
        fireEvent.click(screen.getByRole('radio', { name: 'A username' }))
        fireEvent.change(screen.getByRole('textbox', { name: 'Card ID or username' }), { target: { value: ' kid_01 ' } })
        chooseReason('Their content suggests they are under 18')
        fireEvent.change(screen.getByRole('textbox', { name: 'Details (optional)' }), { target: { value: ' Said they are 14. ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

        await screen.findByText('Thank you')
        expect(onSubmit).toHaveBeenCalledWith({ subject_kind: 'username', subject_ref: 'kid_01', reason: 'content', details: 'Said they are 14.' })
        expect(screen.getByRole('status')).toHaveTextContent('Thank youWe received your report.')
        // Nothing about the reported account, and the form is gone.
        expect(screen.queryByRole('button', { name: 'Send report' })).toBeNull()
    })

    it('marks missing fields and does not send', () => {
        const onSubmit = renderView()
        fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

        expect(screen.getAllByText('Check the fields and try again.')).toHaveLength(2)
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('marks a reference with a control character before any POST', () => {
        const onSubmit = renderView()
        fireEvent.change(screen.getByRole('textbox', { name: 'Card ID or username' }), { target: { value: 'kid\t01' } })
        chooseReason('Their content suggests they are under 18')
        fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

        expect(screen.getAllByText('Check the fields and try again.')).toHaveLength(1)
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it.each([
        [new ApiError(429, 'limit', { code: 'minor_report_limit' }), 'You’ve reached today’s report limit. Try again tomorrow.'],
        [new ApiError(403, 'off', { code: 'minor_report_disabled' }), 'Reporting is turned off for your account.'],
        [new ApiError(503, 'down'), 'Your report couldn’t be sent. Try again in a moment.'],
    ])('shows the copy for %s and keeps the form', async (error, copy) => {
        const onSubmit = renderView(OPEN, vi.fn(async () => { throw error }))
        fillValid()
        fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

        expect(await screen.findByRole('alert')).toHaveTextContent(copy)
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('Thank you')).toBeNull()
        expect(screen.getByRole('button', { name: 'Send report' })).toBeEnabled()
    })

    it('blocks the form when the account cannot report, with the reason', () => {
        renderView({ enabled: true, can_report: false, reports_left_today: 0, reason: 'limit' })
        expect(screen.getByRole('status')).toHaveTextContent('You’ve reached today’s report limit.')
        expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled()
        cleanup()

        renderView({ enabled: true, can_report: false, reports_left_today: 0, reason: 'disabled' })
        expect(screen.getByRole('status')).toHaveTextContent('Reporting is turned off for your account.')
    })
})

describe('ReportMinorForm', () => {
    it('renders nothing and asks nothing when signed out', () => {
        renderForm(null)
        renderForm({ isAuthenticated: false, accountKey: 'anonymous' })
        expect(screen.queryByRole('heading', { name: 'Report a possible minor' })).toBeNull()
        expect(api.getMinorReportStatus).not.toHaveBeenCalled()
    })

    it('renders nothing while reporting is closed, or when the status cannot be read', async () => {
        api.getMinorReportStatus.mockResolvedValueOnce(CLOSED)
        const { unmount } = renderForm({ isAuthenticated: true, accountKey: 'user:1' })
        await waitFor(() => expect(api.getMinorReportStatus).toHaveBeenCalledTimes(1))
        expect(screen.queryByRole('heading', { name: 'Report a possible minor' })).toBeNull()
        unmount()

        api.getMinorReportStatus.mockRejectedValueOnce(new ApiError(404, 'not found'))
        renderForm({ isAuthenticated: true, accountKey: 'user:1' })
        await waitFor(() => expect(api.getMinorReportStatus).toHaveBeenCalledTimes(2))
        expect(screen.queryByRole('heading', { name: 'Report a possible minor' })).toBeNull()
    })

    it('posts through apiService and refreshes the status afterwards', async () => {
        renderForm({ isAuthenticated: true, accountKey: 'user:1' })
        await screen.findByRole('heading', { name: 'Report a possible minor' })

        fillValid()
        fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

        await screen.findByText('Thank you')
        expect(api.submitMinorReport).toHaveBeenCalledWith({ subject_kind: 'public_card', subject_ref: 'card-123', reason: 'stated_age' })
        await waitFor(() => expect(api.getMinorReportStatus).toHaveBeenCalledTimes(2))
        expect(screen.getByText('Thank you')).toBeTruthy()
    })

    it('hides the form when reporting closes meanwhile (403 then a closed status)', async () => {
        api.submitMinorReport.mockRejectedValueOnce(new ApiError(403, 'off', { code: 'minor_report_disabled' }))
        renderForm({ isAuthenticated: true, accountKey: 'user:1' })
        await screen.findByRole('heading', { name: 'Report a possible minor' })
        api.getMinorReportStatus.mockResolvedValue(CLOSED)

        fillValid()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
        })

        await waitFor(() => expect(screen.queryByRole('heading', { name: 'Report a possible minor' })).toBeNull())
    })
})
