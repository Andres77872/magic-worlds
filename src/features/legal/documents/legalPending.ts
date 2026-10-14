/**
 * The legal-document registry primitives (R2-FE-01): a versioned document
 * carries its status, and copy that counsel has not written yet carries the
 * {@link LEGAL_PENDING} marker. The ship gate (`legalDocuments.gate.test.ts`)
 * keeps the marker out of anything wired or final; {@link shippable} is the
 * runtime second line of defence.
 */

/** Marks copy counsel still has to write. Never rendered to users. */
export const LEGAL_PENDING = '[[LEGAL_PENDING]]'

export type LegalDocStatus = 'draft' | 'final'

/** The locales a legal document ships in (en and es ship together, 13 §5.8). */
export type LegalLanguage = 'en' | 'es'

/** The document language for an i18n language tag: Spanish for `es*`, English otherwise. */
export function legalLanguage(language: string | null | undefined): LegalLanguage {
    return language?.trim().toLowerCase().startsWith('es') ? 'es' : 'en'
}

/** One versioned legal document or copy block, in both shipped locales. */
export interface LegalDraft<T> {
    id: string
    status: LegalDocStatus
    en: T
    es: T
}

/** Deep scan: true when any string reachable from `value` contains {@link LEGAL_PENDING}. */
export function containsLegalPending(value: unknown, seen: WeakSet<object> = new WeakSet()): boolean {
    if (typeof value === 'string') return value.includes(LEGAL_PENDING)
    if (typeof value !== 'object' || value === null) return false
    if (seen.has(value)) return false
    seen.add(value)
    const children = Array.isArray(value) ? value : Object.values(value)
    return children.some((child) => containsLegalPending(child, seen))
}

/** True when `doc` may be shown as published copy: final and free of the marker. */
export function isShippable<T>(doc: LegalDraft<T>): boolean {
    return doc.status === 'final' && !containsLegalPending(doc)
}

/**
 * `doc` when it is final and free of the marker; otherwise `fallback`. A
 * production build logs the refusal with `console.error` (the document id
 * only), so a mis-wired draft is loud but never shown.
 */
export function shippable<T>(doc: LegalDraft<T>, fallback: LegalDraft<T>): LegalDraft<T> {
    if (isShippable(doc)) return doc
    if (import.meta.env.PROD) {
        console.error(`[legal] document "${doc.id}" is not shippable (status ${doc.status}); using "${fallback.id}"`)
    }
    return fallback
}
