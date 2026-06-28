/**
 * CSV export for the Credit Tokens console. Serialises the currently-filtered
 * inventory (credit codes or email grants) into a spreadsheet-friendly file,
 * reusing the shared {@link downloadBlob} / {@link safeFilename} helpers.
 */
import type { CreditCodeGrant, CreditGrantKind, EmailCreditGrant } from '@/shared'
import { downloadBlob, safeFilename } from '@/utils/download'
import { viewStatus } from './creditCodeFormat'

const HEADER = [
    'id',
    'type',
    'label_or_email',
    'credits',
    'status',
    'expires_at',
    'claimed_by_user_id',
    'claimed_at',
    'created_at',
    'reason',
] as const

/** Quote a value only when it contains a comma, quote, or newline (RFC 4180). */
function csvCell(value: unknown): string {
    const text = value == null ? '' : String(value)
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildCreditGrantsCsv(
    kind: CreditGrantKind,
    rows: Array<CreditCodeGrant | EmailCreditGrant>,
): string {
    const lines = [HEADER.join(',')]
    for (const row of rows) {
        const id = kind === 'code' ? (row as CreditCodeGrant).code_id : (row as EmailCreditGrant).grant_id
        const labelOrEmail =
            kind === 'code' ? ((row as CreditCodeGrant).label ?? '') : (row as EmailCreditGrant).email
        lines.push(
            [
                csvCell(id),
                csvCell(kind),
                csvCell(labelOrEmail),
                csvCell(row.credits),
                csvCell(viewStatus(row)),
                csvCell(row.expires_at),
                csvCell(row.claimed_by_user_id),
                csvCell(row.claimed_at),
                csvCell(row.created_at),
                csvCell(row.reason),
            ].join(','),
        )
    }
    return lines.join('\r\n')
}

export function downloadCreditGrantsCsv(
    kind: CreditGrantKind,
    rows: Array<CreditCodeGrant | EmailCreditGrant>,
): void {
    const csv = buildCreditGrantsCsv(kind, rows)
    // Prepend a UTF-8 BOM so Excel detects the encoding for non-ASCII labels/emails.
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const stamp = new Date().toISOString().slice(0, 10)
    const base = kind === 'code' ? 'credit-codes' : 'email-credit-grants'
    downloadBlob(blob, `${safeFilename(`${base}-${stamp}`, base)}.csv`)
}
