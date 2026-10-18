/**
 * The synth lab's model list (R1-FE-06, 05 §8.2 A4, R-33). `GET
 * /admin/voices/test/models` is feature-detected: while it loads, and whenever
 * it fails (404 or 501 while the route does not exist, or any other error), the
 * lab is exactly the R0 lab: `LAB_MODELS`, the two MP3 formats, `auto`
 * normalization and the R0 text limits (`labLimits`).
 *
 * When A4 answers, its rows are the list (the server's allow-list), each merged
 * over the `LAB_MODELS` profile of the same alias: a field A4 omits or sends
 * malformed keeps the R0 value. Formats are kept only when the console can play
 * them (`LAB_OUTPUT_FORMATS_R1`).
 */
import { useEffect, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import type { LabModelAlias, LabTextNormalization, NarrationTier } from '@/shared'
import {
    LAB_MODELS,
    LAB_OUTPUT_FORMATS,
    LAB_OUTPUT_FORMATS_R1,
    LAB_TEXT_NORMALIZATIONS,
    type LabModelProfile,
    type LabSettingKey,
} from '../../constants'

/** A lab model: the R0 profile plus what A4 adds. */
export interface LabModelOption extends LabModelProfile {
    /** A4 `label`; null means the console's own label for the alias. */
    label: string | null
    available: boolean
    unavailableReason: string | null
    /** A4 `max_chars`; null without A4 (the R0 limit sources apply, `labLimits`). */
    maxChars: number | null
    outputFormats: string[]
    textNormalization: LabTextNormalization[]
    supportsSeed: boolean
}

export interface LabModels {
    models: LabModelOption[]
    /** `a4` once the route answered with a usable list; `r0` otherwise. */
    source: 'a4' | 'r0'
    loading: boolean
}

const SETTING_KEYS: readonly LabSettingKey[] = ['stability', 'similarity_boost', 'style', 'use_speaker_boost', 'speed']
const PLAYABLE_FORMATS: ReadonlySet<string> = new Set(LAB_OUTPUT_FORMATS_R1)
const NORMALIZATIONS: ReadonlySet<string> = new Set(LAB_TEXT_NORMALIZATIONS)

function r0Option(profile: LabModelProfile): LabModelOption {
    return {
        ...profile,
        settings: [...profile.settings],
        label: null,
        available: true,
        unavailableReason: null,
        maxChars: null,
        outputFormats: [...LAB_OUTPUT_FORMATS],
        textNormalization: ['auto'],
        supportsSeed: true,
    }
}

/** The R0 lab: every `LAB_MODELS` profile, two MP3 formats, `auto` normalization, no A4 limit. */
export const R0_LAB_MODELS: readonly LabModelOption[] = Object.freeze(LAB_MODELS.map(r0Option))

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)
const strings = (value: unknown): string[] | null => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null)

function tierOf(value: unknown, fallback: NarrationTier | null): NarrationTier | null {
    if (value === 'standard' || value === 'expressive') return value
    if (value === null) return null
    return fallback
}

function mergeRow(row: unknown): LabModelOption | null {
    if (!isRecord(row) || typeof row.model_alias !== 'string' || !row.model_alias.trim()) return null
    const alias = row.model_alias.trim() as LabModelAlias
    const base = LAB_MODELS.find((profile) => profile.alias === alias)
    const settings = strings(row.settings)
    const formats = strings(row.output_formats)?.filter((format) => PLAYABLE_FORMATS.has(format)) ?? []
    const normalization = (strings(row.text_normalization)?.filter((mode) => NORMALIZATIONS.has(mode)) ?? []) as LabTextNormalization[]
    const maxChars = typeof row.max_chars === 'number' && Number.isFinite(row.max_chars) && row.max_chars > 0 ? Math.floor(row.max_chars) : null
    return {
        alias,
        settings: settings ? SETTING_KEYS.filter((key) => settings.includes(key)) : [...(base?.settings ?? [])],
        sendsLanguageCode: flag(row.supports_language_code, base?.sendsLanguageCode ?? false),
        tier: tierOf(row.tier, base?.tier ?? null),
        audioTags: flag(row.audio_tags, base?.audioTags ?? false),
        breaks: flag(row.breaks, base?.breaks ?? false),
        inlineIpa: flag(row.inline_ipa, base?.inlineIpa ?? false),
        label: typeof row.label === 'string' && row.label.trim() ? row.label.trim() : null,
        available: ['fish_drama_3', 'fish_s2_1_pro'].includes(alias) ? row.available === true : row.available !== false,
        unavailableReason: typeof row.unavailable_reason === 'string' && row.unavailable_reason ? row.unavailable_reason : null,
        maxChars,
        outputFormats: formats.length > 0 ? [...new Set(formats)] : [...LAB_OUTPUT_FORMATS],
        textNormalization: normalization.length > 0 ? [...new Set(normalization)] : ['auto'],
        supportsSeed: flag(row.supports_seed, true),
    }
}

/**
 * Merge an A4 answer over `LAB_MODELS`. Null when the answer has no usable row,
 * so the caller keeps the R0 lab.
 */
export function mergeLabModels(body: unknown): LabModelOption[] | null {
    const rows = isRecord(body) && Array.isArray(body.models) ? body.models : null
    if (!rows) return null
    const seen = new Set<string>()
    const models: LabModelOption[] = []
    for (const row of rows) {
        const model = mergeRow(row)
        if (!model || seen.has(model.alias)) continue
        seen.add(model.alias)
        models.push(model)
    }
    return models.length > 0 ? models : null
}

/** The lab model list: A4 merged over `LAB_MODELS`, or exactly the R0 lab. */
export function useLabModels(): LabModels {
    const [state, setState] = useState<{ models: LabModelOption[] | null; settled: boolean }>({ models: null, settled: false })

    useEffect(() => {
        const controller = new AbortController()
        void Promise.resolve()
            .then(() => apiService.listAdminLabModels(controller.signal))
            .then(
                (body) => {
                    if (!controller.signal.aborted) setState({ models: mergeLabModels(body), settled: true })
                },
                () => {
                    // 404/501 (no A4 yet) or any failure: the R0 lab.
                    if (!controller.signal.aborted) setState({ models: null, settled: true })
                },
            )
        return () => controller.abort()
    }, [])

    return state.models
        ? { models: state.models, source: 'a4', loading: false }
        : { models: R0_LAB_MODELS as LabModelOption[], source: 'r0', loading: !state.settled }
}
