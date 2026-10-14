import { describe, expect, it } from 'vitest'
import { LEGAL_PENDING, containsLegalPending, type LegalDraft } from '@/features/legal/documents'
import { CRISIS_RESOURCES, shippableCrisisResources, type CrisisResource } from './crisisResources'

const SIGNED: CrisisResource[] = [{ id: 'intl', country: null, name: 'Signed line', contact: '000' }]

describe('crisisResources', () => {
    it('keeps the draft entries as marked placeholders, in both languages', () => {
        expect(CRISIS_RESOURCES.status).toBe('draft')
        expect(containsLegalPending(CRISIS_RESOURCES.en)).toBe(true)
        expect(containsLegalPending(CRISIS_RESOURCES.es)).toBe(true)
        expect(CRISIS_RESOURCES.en.map((entry) => entry.id)).toEqual(CRISIS_RESOURCES.es.map((entry) => entry.id))
    })

    it('ships nothing while the document is a draft', () => {
        expect(shippableCrisisResources('en')).toEqual([])
        expect(shippableCrisisResources('es')).toEqual([])
    })

    it('ships nothing from a final document that still carries the marker', () => {
        const unsigned: LegalDraft<CrisisResource[]> = { ...CRISIS_RESOURCES, status: 'final' }
        expect(shippableCrisisResources('en', unsigned)).toEqual([])
        const oneLeft: LegalDraft<CrisisResource[]> = {
            id: 'x',
            status: 'final',
            en: SIGNED,
            es: [{ ...SIGNED[0], contact: LEGAL_PENDING }],
        }
        expect(shippableCrisisResources('en', oneLeft)).toEqual([])
    })

    it('ships the signed entries of a final document', () => {
        const signed: LegalDraft<CrisisResource[]> = { id: 'x', status: 'final', en: SIGNED, es: SIGNED }
        expect(shippableCrisisResources('es', signed)).toBe(SIGNED)
    })
})
