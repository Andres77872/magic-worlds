/**
 * Synth lab text limit (05 §8.11). The server is the authority: the BFF lab cap
 * (`LAB_TEXT_MAX`), the `max_chars` that `GET /voices/capabilities` lists for the
 * model's tier, and a `max_chars` the BFF answered with a 422
 * `text_over_model_limit` for that model. The lowest known value wins; nothing
 * here is a per-model literal. When the A4 lab model list answers, its
 * `max_chars` stands in for the cap and the capabilities (R1-FE-06).
 *
 * The R0 capabilities DTO has no `admin_lab` surface (narration, call, preview
 * only). The BFF serves a tiered lab model from the same alias and `tts_http`
 * row as narration on that tier (`_SURFACE_MAP`), so the narration entry's
 * `max_chars` is the lab's limit too; an `admin_lab` entry, when one is listed,
 * wins.
 */
import type { VoiceCapabilities } from '@/shared'
import { surfaceCapabilitiesFor } from '@/shared/voice'
import { LAB_TEXT_MAX, type LabModelProfile } from '../../constants'

const positive = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

/**
 * The limit the capabilities list for this model: an `admin_lab` entry for its
 * tier, else a tierless `admin_lab` entry, else (tiered models only) the
 * narration entry of its tier, which is the same model row on the BFF.
 */
export function listedLabLimit(model: LabModelProfile, capabilities: VoiceCapabilities | null | undefined): number | null {
    const lab = (model.tier ? surfaceCapabilitiesFor(capabilities, 'admin_lab', model.tier) : null) ?? surfaceCapabilitiesFor(capabilities, 'admin_lab', null)
    if (positive(lab?.max_chars)) return lab.max_chars
    const narration = model.tier ? surfaceCapabilitiesFor(capabilities, 'narration', model.tier) : null
    return positive(narration?.max_chars) ? narration.max_chars : null
}

/**
 * The lowest known limit. With the A4 model list (R1-FE-06) the model's own
 * `max_chars` replaces the R0 sources: min(A4 `max_chars`, the learned 422).
 */
export function labTextLimit(
    model: LabModelProfile & { maxChars?: number | null },
    capabilities: VoiceCapabilities | null | undefined,
    learned?: number | null,
): number {
    if (positive(model.maxChars)) return Math.min(...[model.maxChars, learned].filter(positive))
    return Math.min(...[LAB_TEXT_MAX, listedLabLimit(model, capabilities), learned].filter(positive))
}
