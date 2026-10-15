import { describe, expect, it } from 'vitest'
import { acceptedLanguages, catalogBadges, catalogSampleUrl, speaksLanguage } from './catalogBadges'
import { CATALOG_ELDRIN, CATALOG_IDRIS_ES_UNACCEPTED, CATALOG_MAREN_HOUSE, CATALOG_ORRIN_UNTESTED, CATALOG_SELA_LEAVING, CATALOG_TOBIAS_LOCKED, catalogVoice } from './fixtures'

describe('catalogBadges (R1-FE-01)', () => {
    it('derives house, locked and language badges from the catalog fields', () => {
        expect(catalogBadges(CATALOG_ELDRIN, { language: 'en' })).toEqual([])
        expect(catalogBadges(CATALOG_MAREN_HOUSE, { language: 'en' })).toEqual(['house_voice'])
        expect(catalogBadges(CATALOG_TOBIAS_LOCKED, { language: 'en' })).toEqual(['locked'])
        expect(catalogBadges(CATALOG_ORRIN_UNTESTED, { language: 'es' })).toEqual(['not_tested_language'])
        // Regional codes compare on their base language; no language skips the check.
        expect(catalogBadges(CATALOG_ELDRIN, { language: 'es-MX' })).toEqual([])
        expect(catalogBadges(CATALOG_ORRIN_UNTESTED)).toEqual([])
    })

    it('counts only rows that passed acceptance as tested languages (05 §5.5)', () => {
        // The BFF lists a language with models but no acceptance pass as `accepted_models: []`.
        expect(CATALOG_IDRIS_ES_UNACCEPTED.languages.map((entry) => entry.language)).toEqual(['en', 'es'])
        expect(speaksLanguage(CATALOG_IDRIS_ES_UNACCEPTED, 'es')).toBe(false)
        expect(speaksLanguage(CATALOG_IDRIS_ES_UNACCEPTED, 'en')).toBe(true)
        expect(catalogBadges(CATALOG_IDRIS_ES_UNACCEPTED, { language: 'es-MX' })).toEqual(['not_tested_language'])
        expect(acceptedLanguages(CATALOG_IDRIS_ES_UNACCEPTED)).toEqual(['en'])
        expect(acceptedLanguages(CATALOG_ELDRIN)).toEqual(['en', 'es'])
    })

    it('shows leaving only on the voice currently in use', () => {
        expect(catalogBadges(CATALOG_SELA_LEAVING, { language: 'en' })).toEqual([])
        expect(catalogBadges(CATALOG_SELA_LEAVING, { language: 'en', isCurrent: true })).toEqual(['leaving'])
        expect(catalogBadges(catalogVoice({ disable_at: '2027-01-01T00:00:00Z' }), { isCurrent: true })).toEqual(['leaving'])
    })

    it('picks the sample in the wanted language, else the primary one', () => {
        expect(catalogSampleUrl(CATALOG_ELDRIN, 'es')).toContain('language=es')
        expect(catalogSampleUrl(CATALOG_ELDRIN, 'fr')).toContain('language=en')
        expect(catalogSampleUrl(catalogVoice({ languages: [] }), 'en')).toBeNull()
    })

    it('skips missing samples before falling back to the primary language or another sample', () => {
        const [english, spanish] = CATALOG_ELDRIN.languages
        const noSpanishSample = catalogVoice({ languages: [english, { ...spanish, sample_url: '' }] })
        expect(catalogSampleUrl(noSpanishSample, 'es-MX')).toBe(english.sample_url)

        const noPrimarySample = catalogVoice({ languages: [{ ...english, sample_url: '' }, spanish] })
        expect(catalogSampleUrl(noPrimarySample, 'en')).toBe(spanish.sample_url)
        expect(catalogSampleUrl(noPrimarySample, 'fr')).toBe(spanish.sample_url)
    })
})
