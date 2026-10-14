/**
 * Account attestations (D26 item 3): the 18+ statement and the Terms of
 * Service acceptance, recorded by the BFF in `user_attestation`. Each kind has
 * its own current version on the server; a version bump asks again.
 *
 * Routes (08 §5.1): `POST /user/attestations` records one kind per request;
 * `GET /user/attestations` (a proposal of 08) returns the current required
 * versions and what the account accepted. The SPA derives what is missing.
 */

export type AttestationKind = 'age_18_plus' | 'terms_of_service'

/** How the attestation was captured (08 §4.5). */
export type AttestationMethod = 'signup_password' | 'signup_oauth' | 'reprompt'

/** One current version the server requires for a kind. */
export interface AttestationRequirement {
    kind: AttestationKind
    version: string
}

/** An accepted attestation, as `POST /user/attestations` returns it (201). */
export interface AttestationRecord {
    kind: AttestationKind
    version: string
    accepted_at: string
}

/** `GET /user/attestations`. */
export interface AttestationStatus {
    required: AttestationRequirement[]
    accepted: AttestationRecord[]
}

/** Body of `POST /user/attestations`. */
export interface AttestationSubmission extends AttestationRequirement {
    method: AttestationMethod
}
