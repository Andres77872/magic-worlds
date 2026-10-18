/**
 * ElevenLabs recipe helpers (R1-FE-02, D13, D18). Ranges, steps and defaults
 * always come from the capabilities controls (`VoiceControlSpec`); nothing here
 * hard-codes a range. Writes keep stability and similarity only, on the
 * 0.05 grid the BFF quantizes to (EP-3); `style` and `use_speaker_boost` are
 * never written (the BFF answers 422 for them).
 */
import type { TFunction } from 'i18next'
import type { VoiceControlKey, VoiceControlSpec, VoiceSettingsV2 } from '@/shared'

/** EP-3: the write grid. */
export const WRITE_STEP = 0.05

/** The user-editable V2 keys, in display order. */
export const EDITABLE_KEYS: readonly VoiceControlKey[] = ['stability', 'similarity_boost']

const WRITE_KEYS: ReadonlySet<string> = new Set(EDITABLE_KEYS)

/** Rounds half to even on the step grid (the BFF's quantizer), without float drift. */
function roundToStep(value: number, step: number): number {
    const scaled = value / step
    const floor = Math.floor(scaled)
    const diff = scaled - floor
    const epsilon = 1e-9
    let units: number
    if (Math.abs(diff - 0.5) < epsilon) units = floor % 2 === 0 ? floor : floor + 1
    else units = Math.round(scaled)
    return Number((units * step).toFixed(6))
}

/** Rounds to the spec's step (0.05 when it has none) and clamps to its range. */
export function quantizeSetting(value: number, spec: Pick<VoiceControlSpec, 'min' | 'max' | 'step'>): number {
    const step = spec.step && spec.step > 0 ? spec.step : WRITE_STEP
    let next = roundToStep(value, step)
    if (typeof spec.min === 'number') next = Math.max(spec.min, next)
    if (typeof spec.max === 'number') next = Math.min(spec.max, next)
    return Number(next.toFixed(6))
}

/**
 * What a save writes for one value (05 §5.1, AC-E2): on the 0.05 grid and
 * clamped to the range of the first control with that key, when there is one.
 * The sliders show this, so the displayed value is exactly the one written.
 */
export function writtenSetting(key: string, value: number, controls: readonly VoiceControlSpec[] = []): number {
    const spec = controls.find((control) => control.key === key)
    return quantizeSetting(value, { min: spec?.min, max: spec?.max, step: WRITE_STEP })
}

/**
 * The settings a V2 preset write sends: stability and similarity_boost
 * on the 0.05 grid, clamped to the controls' ranges when given; null stays null
 * and an empty result is null ("voice defaults").
 */
export function normalizeSettingsForWrite(
    settings: VoiceSettingsV2 | null | undefined,
    controls: readonly VoiceControlSpec[] = [],
): VoiceSettingsV2 | null {
    if (!settings) return null
    const out: VoiceSettingsV2 = {}
    for (const [key, value] of Object.entries(settings)) {
        if (!WRITE_KEYS.has(key) || typeof value !== 'number' || !Number.isFinite(value)) continue
        ;(out as Record<string, number>)[key] = writtenSetting(key, value, controls)
    }
    return Object.keys(out).length > 0 ? out : null
}

/** A stored value outside its control's range (AC-E2), and what a save writes instead. */
export interface OutOfRangeSetting {
    key: VoiceControlKey
    stored: number
    /** Exactly what {@link normalizeSettingsForWrite} writes for it: clamped, on the 0.05 grid. */
    adjusted: number
}

/** Float noise at a range end is not a value outside it. */
const RANGE_EPSILON = 1e-9

/**
 * The stored values a save would clamp (AC-E2): an editable key whose number
 * lies outside the range of its control in `controls`, matched the way
 * {@link normalizeSettingsForWrite} matches it (first spec with that key). A
 * key without a spec, or a spec without bounds, is never flagged, because the
 * save never clamps it.
 */
export function outOfRangeSettings(
    settings: VoiceSettingsV2 | null | undefined,
    controls: readonly VoiceControlSpec[] = [],
): OutOfRangeSetting[] {
    if (!settings) return []
    const out: OutOfRangeSetting[] = []
    for (const key of EDITABLE_KEYS) {
        const stored = (settings as Record<string, unknown>)[key]
        if (typeof stored !== 'number' || !Number.isFinite(stored)) continue
        const spec = controls.find((control) => control.key === key)
        if (!spec) continue
        const below = typeof spec.min === 'number' && stored < spec.min - RANGE_EPSILON
        const above = typeof spec.max === 'number' && stored > spec.max + RANGE_EPSILON
        if (!below && !above) continue
        out.push({ key, stored, adjusted: writtenSetting(key, stored, controls) })
    }
    return out
}

/** A slider readout: two decimals, and speed as a multiple ("1.05×", 05 §5.1). */
export function formatControlValue(key: VoiceControlKey, value: number): string {
    const fixed = value.toFixed(2)
    return key === 'speed' ? `${fixed}×` : fixed
}

function format(value: number): string {
    return value.toFixed(2).replace(/0$/, '')
}

/** Short recipe chips for a preset card; "Voice defaults" when no settings are stored. */
export function settingsChips(settings: VoiceSettingsV2 | null | undefined, t: TFunction): string[] {
    if (!settings || Object.values(settings).every((value) => value === null || value === undefined)) {
        return [t('voices.recipe.voiceDefaults')]
    }
    const chips: string[] = []
    if (typeof settings.stability === 'number') chips.push(`${t('voices.recipe.stability')} ${format(settings.stability)}`)
    if (typeof settings.similarity_boost === 'number') chips.push(`${t('voices.recipe.similarity')} ${format(settings.similarity_boost)}`)
    return chips.length > 0 ? chips : [t('voices.recipe.voiceDefaults')]
}
