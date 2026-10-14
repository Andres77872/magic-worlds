/**
 * The one-time confirmation before the first paid recipe preview (AC-P5,
 * 05 §6.3: "The first credit render per session asks for one-time
 * confirmation"). Confirming once covers the rest of the browser session for
 * that account (`sessionStorage` under a key carrying the user hash, with an
 * in-memory fallback when storage is blocked), so another account signing in
 * in the same tab is asked again. Without a user nothing is remembered.
 * Cancelling runs nothing and asks again next time; a pending confirmation
 * opened for one account never runs for another.
 */
import { useCallback, useRef, useState } from 'react'

export const PREVIEW_CREDIT_KEY_PREFIX = 'magic_worlds:voice_preview_credit_confirmed:'

export function previewCreditKey(userHash: string): string {
    return `${PREVIEW_CREDIT_KEY_PREFIX}${userHash}`
}

/** User hashes confirmed in this page session (storage blocked or not). */
const confirmedInMemory = new Set<string>()

function scopeOf(userHash: string | null | undefined): string | null {
    return typeof userHash === 'string' && userHash.trim() ? userHash.trim() : null
}

/** True once this account confirmed a paid preview in this browser session. */
export function previewCreditConfirmed(userHash: string | null | undefined): boolean {
    const scope = scopeOf(userHash)
    if (!scope) return false
    if (confirmedInMemory.has(scope)) return true
    try {
        return window.sessionStorage.getItem(previewCreditKey(scope)) === '1'
    } catch {
        return false
    }
}

function rememberPreviewCreditConfirmed(scope: string): void {
    confirmedInMemory.add(scope)
    try {
        window.sessionStorage.setItem(previewCreditKey(scope), '1')
    } catch {
        // Storage blocked: the in-memory set covers this page session.
    }
}

/** Forget every account's confirmation (tests). */
export function resetPreviewCreditConfirmation(): void {
    confirmedInMemory.clear()
    try {
        for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
            const key = window.sessionStorage.key(index)
            if (key?.startsWith(PREVIEW_CREDIT_KEY_PREFIX)) window.sessionStorage.removeItem(key)
        }
    } catch {
        // Nothing stored.
    }
}

export interface PreviewCreditConfirm {
    /** The confirmation dialog is open (for the current account). */
    open: boolean
    /** Run `action` now, or once the user confirms when it costs a credit and this account confirmed nothing yet. */
    guard: (costsCredit: boolean, action: () => void) => void
    confirm: () => void
    cancel: () => void
}

interface Pending {
    /** The account the dialog was opened for ('' without one). */
    scope: string
    action: () => void
}

export function usePreviewCreditConfirm(userHash: string | null | undefined): PreviewCreditConfirm {
    const scope = scopeOf(userHash)
    const token = scope ?? ''
    const [openFor, setOpenFor] = useState<string | null>(null)
    const pending = useRef<Pending | null>(null)

    const guard = useCallback((costsCredit: boolean, action: () => void) => {
        if (!costsCredit || previewCreditConfirmed(scope)) {
            action()
            return
        }
        pending.current = { scope: token, action }
        setOpenFor(token)
    }, [scope, token])

    const confirm = useCallback(() => {
        const next = pending.current
        pending.current = null
        setOpenFor(null)
        // A dialog opened for another account (sign-out, then sign-in) runs nothing.
        if (!next || next.scope !== token) return
        if (scope) rememberPreviewCreditConfirmed(scope)
        next.action()
    }, [scope, token])

    const cancel = useCallback(() => {
        pending.current = null
        setOpenFor(null)
    }, [])

    return { open: openFor !== null && openFor === token, guard, confirm, cancel }
}
