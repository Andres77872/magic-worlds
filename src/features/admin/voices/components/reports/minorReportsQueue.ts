/** Queue rules of the root "Report a minor" review module (R2-BE-02, EP-10). */
import type { MinorReportAdminList, MinorReportState } from '@/shared/types/minorReport.types'

/** One page of the queue (EP-10 default). */
export const MINOR_REPORTS_PAGE_SIZE = 50

/** The status filter, in display order. */
export const MINOR_REPORT_STATUSES: readonly MinorReportState[] = ['open', 'lifted', 'escalated', 'expired']

/** Appends a page, keeping the first copy of any report already listed. */
export function appendMinorReportPage(previous: MinorReportAdminList | null, page: MinorReportAdminList): MinorReportAdminList {
    if (!previous) return page
    const seen = new Set(previous.items.map((item) => item.report_id))
    return { items: [...previous.items, ...page.items.filter((item) => !seen.has(item.report_id))], next_before: page.next_before }
}
