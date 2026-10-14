import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '@/infrastructure/api'
import { ensureSafetyLocales } from '@/features/safety/test/ensureSafetyLocales'
import type { MinorReportAdminItem, MinorReportAdminList } from '@/shared/types/minorReport.types'
import { chooseOption, consoleApiMock, renderInConsole, type ConsoleApiMock } from '../../testUtils'
import { MinorReportsModule } from './MinorReportsModule'
import { MINOR_REPORTS_PAGE_SIZE, appendMinorReportPage } from './minorReportsQueue'

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))

type Api = ConsoleApiMock & {
    adminListMinorReports: ReturnType<typeof vi.fn>
    adminReviewMinorReport: ReturnType<typeof vi.fn>
}
const mock = () => api as unknown as Api

function report(id: string, overrides: Partial<MinorReportAdminItem> = {}): MinorReportAdminItem {
    return {
        report_id: id,
        reporter_user_id: 3,
        reported_user_id: 9,
        subject_kind: 'username',
        subject_ref: `user-${id}`,
        reason: 'stated_age',
        details: null,
        reporter_eligible: true,
        hold: { restriction_id: `h-${id}`, ends_at: '2026-10-14T12:00:00Z', lifted_at: null },
        status: 'open',
        review_outcome: null,
        reviewed_at: null,
        created_at: '2026-10-13T12:00:00Z',
        ...overrides,
    }
}

function page(items: MinorReportAdminItem[], next_before: string | null = null): MinorReportAdminList {
    return { items, next_before }
}

function row(id: string) {
    return screen.getByTestId(`minor-report-${id}`)
}

beforeAll(ensureSafetyLocales)

beforeEach(() => {
    for (const key of Object.keys(api)) delete api[key]
    Object.assign(api, consoleApiMock(), {
        adminListMinorReports: vi.fn().mockResolvedValue(page([report('a')])),
        adminReviewMinorReport: vi.fn(),
    })
})

describe('appendMinorReportPage', () => {
    it('appends a page, keeping the first copy of a report and the new cursor', () => {
        const first = page([report('a'), report('b')], 'c1')
        const merged = appendMinorReportPage(first, page([report('b', { status: 'lifted' }), report('c')], null))
        expect(merged.items.map((item) => item.report_id)).toEqual(['a', 'b', 'c'])
        expect(merged.items[1].status).toBe('open')
        expect(merged.next_before).toBeNull()
        expect(appendMinorReportPage(null, first)).toBe(first)
    })
})

describe('MinorReportsModule (R2-BE-02)', () => {
    it('lists open reports with their subject, hold and eligibility', async () => {
        mock().adminListMinorReports.mockResolvedValue(page([
            report('a', { details: 'Said they are 14.' }),
            report('b', { reported_user_id: null, reporter_eligible: false, hold: null, subject_kind: 'public_card', subject_ref: 'card-7' }),
        ]))
        renderInConsole(<MinorReportsModule />, 'reports')

        const first = await screen.findByTestId('minor-report-a')
        expect(mock().adminListMinorReports).toHaveBeenCalledWith({ status: 'open', limit: MINOR_REPORTS_PAGE_SIZE })
        expect(screen.getByRole('table', { name: 'Minor reports for review' })).toBeInTheDocument()
        expect(first).toHaveTextContent('A username')
        expect(first).toHaveTextContent('user-a')
        expect(first).toHaveTextContent('#9')
        expect(first).toHaveTextContent('They said they are under 18')
        expect(first).toHaveTextContent(/Until /)
        expect(within(first).getByText('Details')).toBeInTheDocument()
        expect(within(first).getByRole('group', { name: 'Review' })).toBeInTheDocument()

        const second = row('b')
        expect(second).toHaveTextContent('A public card')
        expect(second).toHaveTextContent('Not matched to an account')
        expect(second).toHaveTextContent('No hold')
        expect(within(second).getByText('No')).toBeInTheDocument()
    })

    it('says when there is nothing to review', async () => {
        mock().adminListMinorReports.mockResolvedValue(page([]))
        renderInConsole(<MinorReportsModule />, 'reports')
        expect(await screen.findByText('No reports to review.')).toBeInTheDocument()
    })

    it('filters by status', async () => {
        renderInConsole(<MinorReportsModule />, 'reports')
        await screen.findByTestId('minor-report-a')
        mock().adminListMinorReports.mockResolvedValue(page([report('e', { status: 'escalated', review_outcome: 'escalated' })]))

        chooseOption('Status', 'Escalated')

        await screen.findByTestId('minor-report-e')
        expect(mock().adminListMinorReports).toHaveBeenLastCalledWith({ status: 'escalated', limit: MINOR_REPORTS_PAGE_SIZE })
        // A reviewed report takes no second review.
        expect(within(row('e')).queryByRole('group', { name: 'Review' })).toBeNull()
    })

    it('loads more with the before cursor and appends the page', async () => {
        mock().adminListMinorReports
            .mockResolvedValueOnce(page([report('a')], 'cursor-1'))
            .mockResolvedValueOnce(page([report('b')], null))
        renderInConsole(<MinorReportsModule />, 'reports')
        await screen.findByTestId('minor-report-a')

        fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

        await screen.findByTestId('minor-report-b')
        expect(mock().adminListMinorReports).toHaveBeenLastCalledWith({ status: 'open', limit: MINOR_REPORTS_PAGE_SIZE, before: 'cursor-1' })
        expect(screen.getByTestId('minor-report-a')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
    })

    it('records an unfounded review at once and updates the row', async () => {
        mock().adminReviewMinorReport.mockResolvedValue(report('a', {
            status: 'lifted',
            review_outcome: 'unfounded',
            hold: { restriction_id: 'h-a', ends_at: '2026-10-14T12:00:00Z', lifted_at: '2026-10-13T13:00:00Z' },
        }))
        renderInConsole(<MinorReportsModule />, 'reports')
        await screen.findByTestId('minor-report-a')

        fireEvent.click(within(row('a')).getByRole('button', { name: 'Unfounded' }))

        await waitFor(() => expect(row('a')).toHaveTextContent('Reviewed: Unfounded'))
        expect(mock().adminReviewMinorReport).toHaveBeenCalledWith('a', 'unfounded')
        expect(row('a')).toHaveTextContent('Lifted')
        expect(within(row('a')).queryByRole('group', { name: 'Review' })).toBeNull()
        expect(await screen.findByText('Review saved.')).toBeInTheDocument()
    })

    it('asks before escalating, and sends nothing on cancel', async () => {
        mock().adminReviewMinorReport.mockResolvedValue(report('a', { status: 'escalated', review_outcome: 'escalated' }))
        renderInConsole(<MinorReportsModule />, 'reports')
        await screen.findByTestId('minor-report-a')

        fireEvent.click(within(row('a')).getByRole('button', { name: 'Escalate' }))
        const dialog = await screen.findByRole('dialog', { name: 'Escalate this report?' })
        expect(dialog).toHaveTextContent('turns voice off for the reported account')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(mock().adminReviewMinorReport).not.toHaveBeenCalled()

        fireEvent.click(within(row('a')).getByRole('button', { name: 'Escalate' }))
        fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Escalate' }))

        await waitFor(() => expect(mock().adminReviewMinorReport).toHaveBeenCalledWith('a', 'escalated'))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(within(row('a')).getByText('Escalated')).toBeInTheDocument()
    })

    it('reloads the list when another root already reviewed the report (409)', async () => {
        mock().adminReviewMinorReport.mockRejectedValue(new ApiError(409, 'reviewed', { code: 'minor_report_reviewed' }))
        renderInConsole(<MinorReportsModule />, 'reports')
        await screen.findByTestId('minor-report-a')
        mock().adminListMinorReports.mockResolvedValue(page([]))

        fireEvent.click(within(row('a')).getByRole('button', { name: 'Inconclusive' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('This report was already reviewed.')
        await screen.findByText('No reports to review.')
        expect(mock().adminListMinorReports).toHaveBeenCalledTimes(2)
    })

    it('reports a failed review without changing the row', async () => {
        mock().adminReviewMinorReport.mockRejectedValue(new Error('offline'))
        renderInConsole(<MinorReportsModule />, 'reports')
        await screen.findByTestId('minor-report-a')

        fireEvent.click(within(row('a')).getByRole('button', { name: 'Unfounded' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('The review couldn’t be saved.')
        expect(within(row('a')).getByRole('group', { name: 'Review' })).toBeInTheDocument()
    })

    it('shows a load failure', async () => {
        mock().adminListMinorReports.mockRejectedValue(new ApiError(500, 'boom'))
        renderInConsole(<MinorReportsModule />, 'reports')
        expect(await screen.findByRole('alert')).toHaveTextContent('Reports couldn’t be loaded.')
    })
})
