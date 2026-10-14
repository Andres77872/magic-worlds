/** Locale-aware formatting for the voice console (no hard-coded copy). */

const displayNames = new Map<string, Intl.DisplayNames | null>()

function languageNames(locale: string): Intl.DisplayNames | null {
    if (!displayNames.has(locale)) {
        try {
            displayNames.set(locale, new Intl.DisplayNames([locale], { type: 'language' }))
        } catch {
            displayNames.set(locale, null)
        }
    }
    return displayNames.get(locale) ?? null
}

/** "en" → "English" (or "inglés" in Spanish); falls back to the code. */
export function languageName(code: string | null | undefined, locale: string): string {
    if (!code) return ''
    try {
        const name = languageNames(locale)?.of(code)
        if (!name || name === code) return code
        return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
    } catch {
        return code
    }
}

export function formatNumber(value: number | null | undefined, locale: string, maximumFractionDigits = 0): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—'
    return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)
}

/** Signed decibels with one decimal, e.g. "−2.5". */
export function formatDb(value: number, locale: string): string {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value)
}

export function formatDate(iso: string | null | undefined, locale: string): string {
    if (!iso) return '—'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

export function formatDateTime(iso: string | null | undefined, locale: string): string {
    if (!iso) return '—'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function percent(part: number, whole: number): number {
    if (!whole || whole <= 0) return 0
    return Math.round((part / whole) * 100)
}

/** A 0–1 share as a percentage with up to two decimals, e.g. 0.073171 → "7.32%". */
export function formatShare(value: number | null | undefined, locale: string): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—'
    return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(value)
}

/** A 0–100 percentage, e.g. 85 → "85%". */
export function formatPercentValue(value: number | null | undefined, locale: string): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—'
    return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value / 100)
}

/** Milliseconds, e.g. 2000 → "2,000 ms". */
export function formatMs(value: number | null | undefined, locale: string): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—'
    return `${formatNumber(value, locale)} ms`
}

/** Estimated cost in USD micros as a currency amount, e.g. 34,000,000 → "$34.00". */
export function formatUsdMicros(micros: number | null | undefined, locale: string): string {
    if (micros === null || micros === undefined || !Number.isFinite(micros)) return '—'
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(micros / 1_000_000)
}
