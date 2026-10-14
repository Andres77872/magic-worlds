/**
 * The admin DTO proposals are frozen for the BFF (R0-BE-35/36, 03 §5.16): every
 * FE-invented shape must keep a doc comment the backend can adopt as written.
 */
import { describe, expect, it } from 'vitest'

const source = Object.values(
    import.meta.glob<string>('/src/shared/types/adminVoiceCatalog.types.ts', { query: '?raw', import: 'default', eager: true }),
)[0]

/** The JSDoc block right above `export interface|type <name>`, or null. */
function docOf(name: string): string | null {
    const match = new RegExp(String.raw`/\*\*((?:(?!\*/)[\s\S])*)\*/\s*export (?:interface|type) ${name}\b`).exec(source)
    return match ? match[1] : null
}

/** The JSDoc block right above the `<field>:` member line inside `<owner>`. */
function fieldDocOf(owner: string, field: string): string | null {
    const body = new RegExp(String.raw`export interface ${owner} \{([\s\S]*?)\n\}`).exec(source)?.[1] ?? ''
    const match = new RegExp(String.raw`/\*\*((?:(?!\*/)[\s\S])*)\*/\s*${field}\??:`).exec(body)
    return match ? match[1] : null
}

const FROZEN = 'Proposal (FE, frozen'

/** Each proposal says what the console does without it, or that the console requires it. */
const MISSING_CLAUSE = /\b(Missing|absent|Required by the console)\b/

describe('admin voice DTO proposals (frozen for R0-BE-35/36)', () => {
    it('reads the module source', () => {
        expect(source).toContain('export interface AdminCatalogVoice')
    })

    it.each([
        'AdminCatalogSummary',
        'AdminVoiceSyncResponse',
        'AdminCatalogDeleteChallenge',
        'AdminCatalogDeleteResult',
        'AcceptanceRender',
        'AcceptanceRenderResponse',
        'AcceptanceVerdictResponse',
        'VoiceDefaultsUpdateResponse',
        'LegacyMappingCoverage',
        'AdminVoiceLimits',
    ])('%s carries a frozen-proposal doc with its missing-field behaviour', (name) => {
        expect(docOf(name)).toContain(FROZEN)
        expect(docOf(name)).toMatch(MISSING_CLAUSE)
    })

    it.each([
        ['AdminCatalogPage', 'summary'],
        ['VoiceDefaultsResponse', 'last_resort_voice_key'],
        ['LegacyMappingRow', 'reference_count'],
    ])('%s.%s carries a proposal doc with its missing-field behaviour', (owner, field) => {
        expect(fieldDocOf(owner, field)).toMatch(/Proposal/)
        expect(fieldDocOf(owner, field)).toMatch(MISSING_CLAUSE)
    })

    it('keeps only the legacy-mapping curation DTOs: no reverse mapping, inventory or audition (I-68)', () => {
        const legacyExports = [...source.matchAll(/export (?:interface|type) (Legacy\w+)/g)].map((match) => match[1]).sort()
        expect(legacyExports).toEqual([
            'LegacyCoverageCount',
            'LegacyMappingCoverage',
            'LegacyMappingListResponse',
            'LegacyMappingRow',
            'LegacyMappingStatus',
            'LegacyMappingUpdate',
            'LegacyTargetMetric',
        ])
        expect(source).not.toMatch(/offered_by_picker|picker_offered|legacy_provider/)
    })

    it('documents the contract details the BFF must match', () => {
        expect(docOf('AdminCatalogDeleteChallenge')).toContain('?confirm_token=')
        expect(docOf('AcceptanceVerdictRequest')).toContain('gain_out_of_range')
        expect(docOf('AcceptanceVerdictRequest')).toContain('min(0, −18 − integrated_lufs)')
        expect(docOf('AcceptanceVerdictRequest')).toContain('unrounded gain')
        expect(fieldDocOf('AcceptanceRender', 'audio_url')).toMatch(/authed/)
        expect(fieldDocOf('AdminLabSynthesisResult', 'request_id')).toContain('X-Voice-Request-Id')
        expect(fieldDocOf('AdminLabSynthesisResult', 'character_cost')).toContain('X-Voice-Character-Cost')
        expect(docOf('VoiceRuntimeSetting')).toContain('only turn a surface off')
    })
})
