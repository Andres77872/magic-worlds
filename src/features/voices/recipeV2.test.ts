import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { i18n } from '@/app/i18n'
import { surfaceCapabilitiesFor } from '@/shared/voice'
import { CAPABILITIES_EL_PLUS } from './fixtures'
import { formatControlValue, normalizeSettingsForWrite, outOfRangeSettings, quantizeSetting, settingsChips, WRITE_STEP, writtenSetting } from './recipeV2'

const t = i18n.getFixedT('en') as TFunction
const standard = surfaceCapabilitiesFor(CAPABILITIES_EL_PLUS, 'preview', 'standard')

describe('recipeV2 (R1-FE-02, EP-3)', () => {
    it('quantizes to the step, half to even, and clamps to the range', () => {
        expect(quantizeSetting(0.512, { min: 0, max: 1, step: 0.05 })).toBe(0.5)
        expect(quantizeSetting(0.537, { min: 0, max: 1, step: 0.05 })).toBe(0.55)
        // 0.125 sits halfway between 0.10 and 0.15: the even unit (0.10) wins.
        expect(quantizeSetting(0.125, { min: 0, max: 1, step: 0.05 })).toBe(0.1)
        expect(quantizeSetting(1.4, { min: 0.7, max: 1.2, step: 0.05 })).toBe(1.2)
        expect(quantizeSetting(0.2, { min: 0.7, max: 1.2, step: 0.05 })).toBe(0.7)
        // A missing step falls back to the write grid.
        expect(quantizeSetting(0.33, { min: 0, max: 1, step: null as unknown as number })).toBe(0.35)
        expect(WRITE_STEP).toBe(0.05)
    })

    it('writes stability, similarity and speed only, on the 0.05 grid', () => {
        const controls = standard?.controls ?? []
        expect(controls.length).toBeGreaterThan(0)
        expect(normalizeSettingsForWrite(
            { stability: 0.512, similarity_boost: 0.778, speed: 1.31, style: 0.4, use_speaker_boost: true },
            controls,
        )).toEqual({ stability: 0.5, similarity_boost: 0.8, speed: 1.2 })
    })

    it('gives the value a save writes for one key: on the grid, clamped by the first matching control (05 §5.1)', () => {
        const controls = standard?.controls ?? []
        const settings = { stability: 0.43, similarity_boost: 0.778, speed: 1.31 }
        const written = normalizeSettingsForWrite(settings, controls) as Record<string, number>
        for (const [key, value] of Object.entries(settings)) expect(writtenSetting(key, value, controls)).toBe(written[key])
        expect(writtenSetting('stability', 0.43, controls)).toBe(0.45)
        // Without a control nothing is clamped, but the value still snaps to the grid.
        expect(writtenSetting('speed', 1.92)).toBe(1.9)
    })

    it('keeps null as null and turns an empty result into null', () => {
        expect(normalizeSettingsForWrite(null)).toBeNull()
        expect(normalizeSettingsForWrite(undefined)).toBeNull()
        expect(normalizeSettingsForWrite({ style: 0.3, use_speaker_boost: false })).toBeNull()
        expect(normalizeSettingsForWrite({ stability: null, speed: Number.NaN })).toBeNull()
    })

    it('never takes ranges from anywhere but the controls', () => {
        // Without controls nothing is clamped (the server owns the ranges).
        expect(normalizeSettingsForWrite({ speed: 1.9 })).toEqual({ speed: 1.9 })
    })

    it('lists exactly the values a save clamps, with what it writes instead (AC-E2)', () => {
        const controls = standard?.controls ?? []
        const settings = { stability: 1.3, similarity_boost: 0.8, speed: 0.55, style: 4 }
        const flags = outOfRangeSettings(settings, controls)
        expect(flags).toEqual([
            { key: 'stability', stored: 1.3, adjusted: 1 },
            { key: 'speed', stored: 0.55, adjusted: 0.7 },
        ])
        // The flag's value is the written one, key for key.
        const written = normalizeSettingsForWrite(settings, controls) as Record<string, number>
        for (const flag of flags) expect(written[flag.key]).toBe(flag.adjusted)
        // In range, at an end, float noise, no spec or no settings: nothing to flag.
        expect(outOfRangeSettings({ stability: 0, similarity_boost: 1, speed: 1.2 + 1e-12 }, controls)).toEqual([])
        expect(outOfRangeSettings({ speed: 1.9 })).toEqual([])
        expect(outOfRangeSettings({ speed: 1.9 }, [{ key: 'speed', default: 1, user_editable: true }])).toEqual([])
        expect(outOfRangeSettings(null, controls)).toEqual([])
        // The first spec with the key wins, as on the write.
        expect(outOfRangeSettings({ speed: 1.3 }, [{ key: 'speed', min: 0.5, max: 2, default: 1, user_editable: true }, ...controls])).toEqual([])
    })

    it('reads speed as a multiple and the others as plain values (05 §5.1)', () => {
        expect(formatControlValue('speed', 1.05)).toBe('1.05×')
        expect(formatControlValue('speed', 1)).toBe('1.00×')
        expect(formatControlValue('stability', 0.4)).toBe('0.40')
        expect(formatControlValue('similarity_boost', 0.75)).toBe('0.75')
    })

    it('summarises a recipe as chips, "Voice defaults" when empty', () => {
        expect(settingsChips(null, t)).toEqual(['Voice defaults'])
        expect(settingsChips({ stability: null }, t)).toEqual(['Voice defaults'])
        expect(settingsChips({ stability: 0.4, similarity_boost: 0.75, speed: 1.1 }, t)).toEqual(['Stability 0.4', 'Similarity 0.75', 'Speed 1.1×'])
    })
})
