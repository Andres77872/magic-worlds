import type { AttestationKind, AttestationRecord, AttestationRequirement, AttestationStatus } from '@/shared/types/attestation.types'
import { termsDocumentFor } from '../documents/termsDocuments'

/** Display order of the attestation checkboxes (13 §3.2: two separate, unticked boxes). */
export const ATTESTATION_KINDS: readonly AttestationKind[] = ['age_18_plus', 'terms_of_service']

function isKind(value: unknown): value is AttestationKind {
    return value === 'age_18_plus' || value === 'terms_of_service'
}

function isRequirement(value: unknown): value is AttestationRequirement {
    if (typeof value !== 'object' || value === null) return false
    const entry = value as Record<string, unknown>
    return isKind(entry.kind) && typeof entry.version === 'string' && entry.version.length > 0
}

/**
 * Validates a `GET /user/attestations` body. Returns null for anything else
 * (an empty body after a terminal auth expiry, a proxy page), which callers
 * treat like a route that is not deployed: never a reason to block the user.
 */
export function parseAttestationStatus(value: unknown): AttestationStatus | null {
    if (typeof value !== 'object' || value === null) return null
    const body = value as Record<string, unknown>
    if (!Array.isArray(body.required) || !Array.isArray(body.accepted)) return null
    const required = body.required.filter(isRequirement).map(({ kind, version }) => ({ kind, version }))
    const accepted: AttestationRecord[] = body.accepted.filter(isRequirement).map((entry) => {
        const acceptedAt = (entry as unknown as Record<string, unknown>).accepted_at
        return { kind: entry.kind, version: entry.version, accepted_at: typeof acceptedAt === 'string' ? acceptedAt : '' }
    })
    return { required, accepted }
}

/** The current versions the account has not accepted yet (09 §1.8: the SPA derives "missing"). */
export function missingAttestations(status: AttestationStatus): AttestationRequirement[] {
    return status.required.filter((requirement) =>
        !status.accepted.some((record) => record.kind === requirement.kind && record.version === requirement.version))
}

/**
 * Whether this SPA can record the requirement (R2-FE-01): always for the age
 * box; for the Terms only when the SPA ships that version's document. A Terms
 * version required before its SPA release (a deploy-order slip) keeps voice
 * refused, but never blocks the rest of the app.
 */
export function canAcceptHere(requirement: AttestationRequirement): boolean {
    return requirement.kind !== 'terms_of_service' || termsDocumentFor(requirement.version) !== null
}

/** The missing requirements this SPA can record (`canAcceptHere`). */
export function acceptableAttestations(missing: readonly AttestationRequirement[]): AttestationRequirement[] {
    return missing.filter(canAcceptHere)
}

/**
 * The kinds to ask for: the missing ones when the status is known, both
 * otherwise. `acceptableOnly` (the blocking sign-in prompt) leaves out a Terms
 * version the SPA does not ship.
 */
export function promptKinds(status: AttestationStatus | null, options: { acceptableOnly?: boolean } = {}): AttestationKind[] {
    const requirements = status ? missingAttestations(status) : []
    const missing = (options.acceptableOnly ? acceptableAttestations(requirements) : requirements).map((requirement) => requirement.kind)
    const kinds = missing.length > 0 ? missing : [...ATTESTATION_KINDS]
    return ATTESTATION_KINDS.filter((kind) => kinds.includes(kind))
}

/** Which boxes are ticked, per kind. */
export type AttestationChecked = Partial<Record<AttestationKind, boolean>>

/** True when every shown box is ticked. */
export function allAttestationsChecked(kinds: readonly AttestationKind[], checked: AttestationChecked): boolean {
    return kinds.every((kind) => checked[kind] === true)
}

/**
 * The Terms of Service version to show (R0-LEG-03): the version the server
 * currently requires, else the latest one the account accepted. Null when the
 * status is unknown; the Terms page then shows the newest document the SPA
 * ships, named by its own version (R2-FE-01).
 */
export function termsVersion(status: AttestationStatus | null | undefined): string | null {
    if (!status) return null
    const required = status.required.find((requirement) => requirement.kind === 'terms_of_service')
    if (required) return required.version
    const accepted = status.accepted
        .filter((record) => record.kind === 'terms_of_service')
        .sort((a, b) => a.accepted_at.localeCompare(b.accepted_at))
    return accepted[accepted.length - 1]?.version ?? null
}

/**
 * The Terms of Service version the server requires now (the one an account
 * accepts), or null when the status is unknown or does not list terms.
 */
export function requiredTermsVersion(status: AttestationStatus | null | undefined): string | null {
    return status?.required.find((requirement) => requirement.kind === 'terms_of_service')?.version ?? null
}
