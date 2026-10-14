/**
 * Account attestation gate (D26 item 3; 09 §4.7; 13 §3.2).
 *
 * - On every sign-in it asks `GET /user/attestations` what is missing. When
 *   something is, the blocking prompt opens (method `reprompt`, or
 *   `signup_oauth` for an account that just came back from Google with no
 *   attestation at all). A failed or missing status route (404 before the
 *   backend ships) never blocks anyone: the gate becomes `unavailable`.
 * - A password sign-up ticks both boxes before registering; the sign-in that
 *   follows records them with `signup_password` instead of prompting.
 * - Any HTTP 428 `attestation_required` (the API layer dispatches
 *   `attestation:required`) and any voice surface that asks (`requestAttestation`)
 *   open the same prompt. `withAttestation` retries a refused request once.
 * - Legal pages stay readable: the login prompt waits while one is open, so the
 *   Terms link (a new tab) is never covered by the prompt it came from.
 * - Click-wrap (R2-FE-01): the prompt names the Terms version it asks for and
 *   only records that exact version. A version the SPA does not ship is never
 *   recorded: it keeps voice refused (a voice prompt says the terms are being
 *   published) but never blocks the app at sign-in, which asks only for what
 *   can be recorded. A version that changed since the prompt opened, or a 409
 *   `attestation_stale`, refreshes the status and asks again.
 *
 * State is keyed by the account, so a sign-out or a different sign-in never
 * inherits the previous account's gate or prompt.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/hooks/useAuth'
import { NavigationContext } from '@/app/providers/NavigationProvider'
import { ApiError, apiService, ATTESTATION_REQUIRED_EVENT, isAttestationRequiredError } from '@/infrastructure/api'
import type { AttestationKind, AttestationMethod, AttestationStatus, PageType } from '@/shared/types'
import { LATEST_TERMS_VERSION } from '../documents/termsDocuments'
import { AttestationContext, type AttestationContextValue, type AttestationGate } from './attestationContext'
import { AttestationPrompt } from './AttestationPrompt'
import {
    acceptableAttestations,
    canAcceptHere,
    missingAttestations,
    parseAttestationStatus,
    promptKinds,
    requiredTermsVersion,
    termsVersion,
} from './attestationStatus'

const LEGAL_PAGES: ReadonlySet<PageType> = new Set<PageType>(['about', 'contact', 'privacy', 'disclaimer', 'terms'])
const LEGAL_HASH = /^#\/(about|contact|privacy|disclaimer|terms)(?:[?/]|$)/

/** BFF detail code for a POST naming a version that is no longer current (`route_attestations.py`). */
const ATTESTATION_STALE_CODE = 'attestation_stale'

/**
 * The Terms version a prompt shows: the one the server requires, else (status
 * unknown) the newest shipped document, which is what the Terms link opens.
 */
function promptTermsVersion(status: AttestationStatus | null): string {
    return requiredTermsVersion(status) ?? LATEST_TERMS_VERSION
}

interface AccountAttestation {
    accountKey: string
    gate: Exclude<AttestationGate, 'idle' | 'checking'>
    status: AttestationStatus | null
    /** Set while the account must attest before using the app (the blocking prompt). */
    loginMethod: AttestationMethod | null
}

/** Status, or null when the route is missing or failed: callers never block on null. */
async function loadAttestationStatus(): Promise<AttestationStatus | null> {
    try {
        return parseAttestationStatus(await apiService.getAttestationStatus())
    } catch {
        return null
    }
}

function viewingGoogleReturn(): boolean {
    return typeof window !== 'undefined' && window.location.hash.startsWith('#/google-callback')
}

export function AttestationProvider({ children }: { children: ReactNode }) {
    const { t } = useTranslation()
    const { isAuthenticated, accountKey, logout } = useAuth()
    const navigation = useContext(NavigationContext)
    const [account, setAccount] = useState<AccountAttestation | null>(null)
    /** The account whose voice action is waiting on the prompt. */
    const [voiceRequestKey, setVoiceRequestKey] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    /** Set when the prompt asks again because the Terms version changed. */
    const [notice, setNotice] = useState<string | null>(null)

    const sessionRef = useRef({ isAuthenticated, accountKey })
    const signupRef = useRef(false)
    const pendingRef = useRef<{ promise: Promise<boolean>; resolve: (attested: boolean) => void } | null>(null)

    const current = isAuthenticated && account?.accountKey === accountKey ? account : null
    const gate: AttestationGate = !isAuthenticated ? 'idle' : current?.gate ?? 'checking'
    const loginMethod = current?.loginMethod ?? null

    const settle = useCallback((attested: boolean) => {
        const pending = pendingRef.current
        pendingRef.current = null
        pending?.resolve(attested)
    }, [])

    // Check on every sign-in (a new account key). Signing out drops any waiting request.
    useEffect(() => {
        sessionRef.current = { isAuthenticated, accountKey }
        if (!isAuthenticated) {
            signupRef.current = false
            settle(false)
            return
        }
        let cancelled = false
        const key = accountKey
        const oauthReturn = viewingGoogleReturn()
        const record = (next: Omit<AccountAttestation, 'accountKey'>) => {
            if (!cancelled) setAccount({ accountKey: key, ...next })
        }
        void (async () => {
            const status = await loadAttestationStatus()
            if (cancelled) return
            const signingUp = signupRef.current
            signupRef.current = false
            if (!status) {
                record({ gate: 'unavailable', status: null, loginMethod: null })
                return
            }
            const missing = missingAttestations(status)
            if (missing.length === 0) {
                record({ gate: 'satisfied', status, loginMethod: null })
                return
            }
            // A Terms version the SPA does not ship (the BFF was bumped before this
            // release) cannot be recorded here: voice stays refused, the app does not.
            const askable = acceptableAttestations(missing)
            if (askable.length === 0) {
                record({ gate: 'required', status, loginMethod: null })
                return
            }
            // The sign-up form's Terms link opens the newest shipped document, so
            // only that version may be recorded from it; any other asks again.
            const signupTerms = askable.find((requirement) => requirement.kind === 'terms_of_service')
            if (signingUp && signupTerms && signupTerms.version !== LATEST_TERMS_VERSION) {
                record({ gate: 'required', status, loginMethod: 'signup_password' })
                return
            }
            if (signingUp) {
                // Both boxes were ticked on the sign-up form a moment ago.
                try {
                    const records = await apiService.submitAttestations(askable, 'signup_password')
                    const gate = askable.length === missing.length ? 'satisfied' : 'required'
                    record({ gate, status: { required: status.required, accepted: [...status.accepted, ...records] }, loginMethod: null })
                } catch {
                    record({ gate: 'required', status, loginMethod: 'signup_password' })
                }
                return
            }
            record({ gate: 'required', status, loginMethod: oauthReturn && status.accepted.length === 0 ? 'signup_oauth' : 'reprompt' })
        })()
        return () => {
            cancelled = true
        }
    }, [accountKey, isAuthenticated, settle])

    const requestAttestation = useCallback((): Promise<boolean> => {
        const session = sessionRef.current
        if (!session.isAuthenticated) return Promise.resolve(false)
        if (pendingRef.current) return pendingRef.current.promise
        let resolve: (attested: boolean) => void = () => {}
        const promise = new Promise<boolean>((done) => {
            resolve = done
        })
        pendingRef.current = { promise, resolve }
        setError(null)
        setNotice(null)
        setVoiceRequestKey(session.accountKey)
        return promise
    }, [])

    const withAttestation = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
        try {
            return await operation()
        } catch (failure) {
            if (!isAttestationRequiredError(failure)) throw failure
            if (!(await requestAttestation())) throw failure
            return operation()
        }
    }, [requestAttestation])

    const expectSignupAttestation = useCallback(() => {
        signupRef.current = true
    }, [])

    const cancelSignupAttestation = useCallback(() => {
        signupRef.current = false
    }, [])

    // Any 428 from the API layer opens the prompt, wherever the request came from.
    useEffect(() => {
        const onRequired = () => {
            void requestAttestation()
        }
        window.addEventListener(ATTESTATION_REQUIRED_EVENT, onRequired)
        return () => window.removeEventListener(ATTESTATION_REQUIRED_EVENT, onRequired)
    }, [requestAttestation])

    const currentGate = current?.gate ?? 'required'
    const shownTermsVersion = promptTermsVersion(current?.status ?? null)
    const confirm = async (accepted: AttestationKind[]) => {
        const key = accountKey
        const displayedTerms = shownTermsVersion
        const blocking = loginMethod !== null
        const askAgain = (status: AttestationStatus) => {
            // Only what this SPA can record keeps the sign-in prompt open.
            const method = blocking && acceptableAttestations(missingAttestations(status)).length > 0 ? loginMethod : null
            setAccount({ accountKey: key, gate: blocking ? 'required' : currentGate, status, loginMethod: method })
        }
        setSubmitting(true)
        setError(null)
        setNotice(null)
        try {
            // Fresh versions: the cached status may predate a version bump.
            const fresh = parseAttestationStatus(await apiService.getAttestationStatus())
            if (!fresh) throw new Error('Attestation status is unavailable.')
            const missing = missingAttestations(fresh)
            const askable = acceptableAttestations(missing)
            // The sign-in prompt asks for what can be recorded here; a voice prompt for all voice needs.
            const asked = blocking ? askable : missing
            if (asked.some((requirement) => !accepted.includes(requirement.kind))) {
                // Another kind became required meanwhile: show its box too.
                askAgain(fresh)
                return
            }
            const terms = asked.find((requirement) => requirement.kind === 'terms_of_service')
            if (terms && terms.version !== displayedTerms) {
                // Never record a version the prompt did not show: show the current one
                // (or say it is being published, when the SPA does not ship it) and ask again.
                askAgain(fresh)
                setNotice(t('attestation.termsChanged'))
                return
            }
            // Never an unshipped Terms version (`askable`).
            const records = askable.length > 0
                ? await apiService.submitAttestations(askable, loginMethod ?? 'reprompt')
                : []
            const done = askable.length === missing.length
            setAccount({ accountKey: key, gate: done ? 'satisfied' : 'required', status: { required: fresh.required, accepted: [...fresh.accepted, ...records] }, loginMethod: null })
            if (done) {
                setVoiceRequestKey(null)
                settle(true)
            }
            // Otherwise a waiting voice request keeps its prompt, which now says the terms are being published.
        } catch (failure) {
            if (failure instanceof ApiError && failure.status === 409 && failure.code === ATTESTATION_STALE_CODE) {
                // A version moved between the status read and the POST: refresh and ask again.
                const latest = await loadAttestationStatus()
                if (!latest) {
                    setError(t('attestation.saveFailed'))
                    return
                }
                askAgain(latest)
                const latestTerms = missingAttestations(latest).find((requirement) => requirement.kind === 'terms_of_service')
                if (latestTerms && latestTerms.version !== displayedTerms) {
                    // A new Terms version: the prompt remounts on it with unticked boxes.
                    if (!blocking || canAcceptHere(latestTerms)) setNotice(t('attestation.termsChanged'))
                } else {
                    // Same Terms (e.g. the age version moved): confirming again posts the current versions.
                    setError(t('attestation.saveFailed'))
                }
                return
            }
            setError(t('attestation.saveFailed'))
        } finally {
            setSubmitting(false)
        }
    }

    const decline = useCallback(() => {
        setError(null)
        setNotice(null)
        setVoiceRequestKey(null)
        settle(false)
        if (loginMethod !== null) void logout()
    }, [loginMethod, logout, settle])

    const onLegalPage = navigation
        ? LEGAL_PAGES.has(navigation.currentPage)
        : typeof window !== 'undefined' && LEGAL_HASH.test(window.location.hash)
    const voiceRequested = isAuthenticated && voiceRequestKey === accountKey
    const promptOpen = isAuthenticated && (voiceRequested || (loginMethod !== null && !onLegalPage))

    const status = current?.status ?? null
    const pageTermsVersion = termsVersion(status)
    const value = useMemo<AttestationContextValue>(() => ({
        gate,
        status,
        termsVersion: pageTermsVersion,
        requestAttestation,
        withAttestation,
        expectSignupAttestation,
        cancelSignupAttestation,
    }), [cancelSignupAttestation, expectSignupAttestation, gate, pageTermsVersion, requestAttestation, status, withAttestation])

    return (
        <AttestationContext.Provider value={value}>
            {children}
            {promptOpen && (
                <AttestationPrompt
                    // A new version remounts the prompt, so its boxes start unticked again.
                    key={shownTermsVersion}
                    mode={loginMethod !== null ? 'login' : 'voice'}
                    kinds={promptKinds(current?.status ?? null, { acceptableOnly: loginMethod !== null })}
                    termsVersion={shownTermsVersion}
                    notice={notice}
                    submitting={submitting}
                    error={error}
                    onConfirm={(accepted) => void confirm(accepted)}
                    onDecline={decline}
                />
            )}
        </AttestationContext.Provider>
    )
}
