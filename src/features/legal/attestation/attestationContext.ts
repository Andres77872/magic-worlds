import { createContext, useContext } from 'react'
import type { AttestationStatus } from '@/shared/types/attestation.types'

/**
 * Where the account stands on the D26 attestation:
 * - `idle`: signed out, or not checked yet;
 * - `checking`: the status request is in flight;
 * - `satisfied`: every current version is accepted;
 * - `required`: something is missing, so the blocking prompt shows (except
 *   when the only gap is a Terms version this SPA does not ship: the app stays
 *   usable and voice stays refused until the release that ships it);
 * - `unavailable`: the status route failed or is not deployed. Nobody is
 *   blocked; a voice surface that answers 428 still opens the prompt.
 */
export type AttestationGate = 'idle' | 'checking' | 'satisfied' | 'required' | 'unavailable'

export interface AttestationContextValue {
    gate: AttestationGate
    /**
     * The signed-in account's `GET /user/attestations` answer, once known: the
     * server-owned versions (08 §4.5) the Terms page shows. Null while signed
     * out, checking, or when the route is not deployed.
     */
    status?: AttestationStatus | null
    /**
     * The Terms of Service version for the Terms page (R2-FE-01): the version
     * the server requires, else the latest one the account accepted; null when
     * unknown. The page shows that version's document when the SPA ships it.
     */
    termsVersion?: string | null
    /** Opens the prompt (or joins the open one). Resolves true once the user attested, false if they declined. */
    requestAttestation: () => Promise<boolean>
    /** Runs `operation`; on an `AttestationRequiredError` it opens the prompt and retries once after the user attests. */
    withAttestation: <T>(operation: () => Promise<T>) => Promise<T>
    /** Sign-up ticked both boxes: the next sign-in records them (`signup_password`) instead of prompting. */
    expectSignupAttestation: () => void
    /** Registration failed: forget the ticked boxes. */
    cancelSignupAttestation: () => void
}

export const AttestationContext = createContext<AttestationContextValue | null>(null)

/** The attestation API, or null outside `AttestationProvider` (isolated renders and tests). */
export function useAttestation(): AttestationContextValue | null {
    return useContext(AttestationContext)
}
