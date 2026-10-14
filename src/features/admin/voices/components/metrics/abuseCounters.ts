/**
 * The abuse counter rows as the moderation area shows them (11 §8.3): events
 * and characters are kept in separate columns, so a `drained_call_chars`
 * total is never read as a number of events (D26 6a: one event per 20,000
 * drained call characters).
 */
import type { AbuseCounterRow } from '@/shared'

/** The counter kind whose rows carry characters (BFF `speech/abuse.py` `DRAINED_KIND`). */
export const DRAINED_CALL_CHARS_KIND = 'drained_call_chars'

export interface AbuseCounterValues {
    /** Null when the row's events are unknown (shown as a dash). */
    events: number | null
    /** Null on a kind that counts no characters. */
    chars: number | null
}

/**
 * What one row shows. A row with `chars` shows both as sent. A
 * `drained_call_chars` row without it comes from a BFF that sums characters
 * into `events`, so that number is shown as characters and its events as
 * unknown, never as events.
 */
export function abuseCounterValues(row: AbuseCounterRow): AbuseCounterValues {
    const chars = typeof row.chars === 'number' && Number.isFinite(row.chars) ? row.chars : null
    if (row.kind === DRAINED_CALL_CHARS_KIND && chars === null) return { events: null, chars: row.events }
    return { events: row.events, chars }
}

/** True when any row counts characters: the characters column and its hint are shown. */
export function hasCharacterCounters(rows: readonly AbuseCounterRow[]): boolean {
    return rows.some((row) => abuseCounterValues(row).chars !== null)
}
