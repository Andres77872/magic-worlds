import { describe, expect, it } from 'vitest'
import {
    acceptableAttestations,
    allAttestationsChecked,
    canAcceptHere,
    missingAttestations,
    parseAttestationStatus,
    promptKinds,
    requiredTermsVersion,
    termsVersion,
} from './attestationStatus'

const required = [
    { kind: 'age_18_plus', version: 'v2' },
    { kind: 'terms_of_service', version: 'v3' },
]

describe('attestationStatus', () => {
    it('rejects bodies that are not a status, so callers never block on them', () => {
        expect(parseAttestationStatus(null)).toBeNull()
        expect(parseAttestationStatus('<html>')).toBeNull()
        expect(parseAttestationStatus({ required: [] })).toBeNull()
    })

    it('keeps known kinds only and drops malformed entries', () => {
        expect(parseAttestationStatus({
            required: [...required, { kind: 'something_new', version: 'v1' }, { kind: 'age_18_plus' }],
            accepted: [{ kind: 'age_18_plus', version: 'v2', accepted_at: '2026-10-01T00:00:00Z' }],
        })).toEqual({
            required,
            accepted: [{ kind: 'age_18_plus', version: 'v2', accepted_at: '2026-10-01T00:00:00Z' }],
        })
    })

    it('derives the missing kinds by version', () => {
        const status = parseAttestationStatus({
            required,
            accepted: [
                { kind: 'age_18_plus', version: 'v2', accepted_at: 'x' },
                { kind: 'terms_of_service', version: 'v2', accepted_at: 'x' },
            ],
        })!
        expect(missingAttestations(status)).toEqual([{ kind: 'terms_of_service', version: 'v3' }])
        expect(promptKinds(status)).toEqual(['terms_of_service'])
        expect(promptKinds(null)).toEqual(['age_18_plus', 'terms_of_service'])
    })

    it('needs every shown box ticked', () => {
        expect(allAttestationsChecked(['age_18_plus', 'terms_of_service'], { age_18_plus: true })).toBe(false)
        expect(allAttestationsChecked(['terms_of_service'], { terms_of_service: true })).toBe(true)
    })
})

describe('termsVersion (R0-LEG-03)', () => {
    it('prefers the required version, then the latest accepted one, else null', () => {
        expect(termsVersion(null)).toBeNull()
        expect(termsVersion({ required: [...required] as never, accepted: [] })).toBe('v3')
        expect(termsVersion({
            required: [{ kind: 'age_18_plus', version: 'v2' }],
            accepted: [
                { kind: 'terms_of_service', version: 'v2', accepted_at: '2026-10-02T00:00:00Z' },
                { kind: 'terms_of_service', version: 'v1', accepted_at: '2026-01-02T00:00:00Z' },
                { kind: 'age_18_plus', version: 'v9', accepted_at: '2026-12-01T00:00:00Z' },
            ],
        })).toBe('v2')
        expect(termsVersion({ required: [], accepted: [] })).toBeNull()
    })
})

describe('requiredTermsVersion (R2-FE-01)', () => {
    it('reads only the version the server requires now, never an accepted one', () => {
        expect(requiredTermsVersion(null)).toBeNull()
        expect(requiredTermsVersion(undefined)).toBeNull()
        expect(requiredTermsVersion({ required: [...required] as never, accepted: [] })).toBe('v3')
        expect(requiredTermsVersion({
            required: [{ kind: 'age_18_plus', version: 'v2' }],
            accepted: [{ kind: 'terms_of_service', version: 'v2', accepted_at: '2026-10-02T00:00:00Z' }],
        })).toBeNull()
    })
})

describe('acceptable attestations (R2-FE-01)', () => {
    const unshipped = { kind: 'terms_of_service', version: 'tos-v9' } as const
    const shipped = { kind: 'terms_of_service', version: 'tos-v1' } as const
    const age = { kind: 'age_18_plus', version: 'v2' } as const

    it('records the age box always, and Terms only for a version the SPA ships', () => {
        expect(canAcceptHere(age)).toBe(true)
        expect(canAcceptHere(shipped)).toBe(true)
        expect(canAcceptHere(unshipped)).toBe(false)
        expect(acceptableAttestations([age, unshipped])).toEqual([age])
    })

    it('leaves an unshipped Terms version out of the blocking prompt only', () => {
        const status = { required: [age, unshipped], accepted: [] }
        expect(promptKinds(status)).toEqual(['age_18_plus', 'terms_of_service'])
        expect(promptKinds(status, { acceptableOnly: true })).toEqual(['age_18_plus'])
        expect(promptKinds({ required: [age, shipped], accepted: [] }, { acceptableOnly: true })).toEqual(['age_18_plus', 'terms_of_service'])
    })
})
