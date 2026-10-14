/**
 * The one adapter from the `GET /voices/capabilities` wire shape (08 §5.6) to
 * the client view model (09 §1.5), so a wire rename touches this file only.
 *
 * Tolerant by design:
 * - control keys outside {@link VoiceControlKey} (`emotion` today, anything
 *   new tomorrow) are ignored; emotion support is `supports_emotion`;
 * - ranges come from the DTO only, never from constants (D13); a range may be
 *   a `[min, max]` pair or a `{min, max}` object;
 * - the 09 §1.5 client switches, built by the BFF as 03 §5.16 I-32 describes:
 *   `tiers_allowed` (plan rank ∩ healthy models), `narration_tier` (the stored
 *   preference clamped by the server) and `status` (runtime switches, the
 *   spend circuit, and the caller's active restriction or revoked 18+
 *   attestation). Absent or malformed values read as null, empty, or the
 *   fail-open status (the server fails open on a guard read and still refuses
 *   what it must). `narration_tier` is clamped to `tiers_allowed` again when
 *   both are sent;
 * - `provider_route` and `consent_version_required` are pinned to the only
 *   values left after the voice purge (I-68): `elevenlabs` and `voice-v2`;
 * - per tier, `steps` (D18: 0.05) and `user_editable` maps are read; `style`
 *   and `use_speaker_boost` stay non-editable whatever the map says.
 */
import type {
    NarrationTier,
    VoiceCapabilities,
    VoiceCapabilitySafeguards,
    VoiceCapabilityStatus,
    VoiceControlKey,
    VoiceControlSpec,
    VoiceSurface,
    VoiceSurfaceCapabilities,
} from '@/shared/types'

const CONTROL_KEYS: readonly VoiceControlKey[] = ['stability', 'similarity_boost', 'style', 'use_speaker_boost', 'speed']
const SURFACES: readonly VoiceSurface[] = ['narration', 'call', 'preview', 'admin_lab']
const TIERS: readonly NarrationTier[] = ['standard', 'expressive']
/** D13: these two ride along at their defaults and are never offered to users. */
const NOT_USER_EDITABLE: ReadonlySet<VoiceControlKey> = new Set<VoiceControlKey>(['style', 'use_speaker_boost'])

/** Status when the server does not report one: nothing is paused or off. */
export const FAIL_OPEN_VOICE_STATUS: VoiceCapabilityStatus = Object.freeze({
    narration_available: true,
    calls_available: true,
    auto_narration_paused: false,
})

/** EP-11 safeguards when the server does not send them (an older BFF build): all off. */
export const SAFEGUARDS_OFF: VoiceCapabilitySafeguards = Object.freeze({
    retention_guard: false,
    self_harm_pause: false,
    break_nudge_minutes: null,
    paused_until: null,
})

/**
 * The companion safeguards of a capabilities view model, defaulting to
 * {@link SAFEGUARDS_OFF} for a missing read, a missing `safeguards` key or a
 * malformed field. `break_nudge_minutes` null means never nudge.
 */
export function readSafeguards(capabilities: VoiceCapabilities | null | undefined): VoiceCapabilitySafeguards {
    return safeguards(capabilities?.safeguards) ?? { ...SAFEGUARDS_OFF }
}

/** The EP-11 block, normalised; null when the value is not an object (no key). */
function safeguards(value: unknown): VoiceCapabilitySafeguards | null {
    const wire = record(value)
    if (!wire) return null
    const minutes = finite(wire.break_nudge_minutes)
    return {
        retention_guard: wire.retention_guard === true,
        self_harm_pause: wire.self_harm_pause === true,
        break_nudge_minutes: minutes !== undefined && minutes > 0 ? minutes : null,
        paused_until: typeof wire.paused_until === 'string' && wire.paused_until ? wire.paused_until : null,
    }
}

type WireRecord = Record<string, unknown>

function record(value: unknown): WireRecord | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as WireRecord) : null
}

function finite(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function count(value: unknown): number | null {
    const n = finite(value)
    return n !== undefined && n >= 0 ? n : null
}

function isTier(value: unknown): value is NarrationTier {
    return value === 'standard' || value === 'expressive'
}

function isControlKey(value: unknown): value is VoiceControlKey {
    return typeof value === 'string' && (CONTROL_KEYS as readonly string[]).includes(value)
}

function range(value: unknown): { min?: number; max?: number } {
    if (Array.isArray(value)) return { min: finite(value[0]), max: finite(value[1]) }
    const entry = record(value)
    return entry ? { min: finite(entry.min), max: finite(entry.max) } : {}
}

/** One control from the wire lists; null when the DTO gives it no usable default. */
function controlSpec(key: VoiceControlKey, tier: WireRecord): VoiceControlSpec | null {
    // No hard-coded fallback (09 §1.5): a control without a default cannot be rendered.
    const raw = record(tier.defaults)?.[key]
    if (typeof raw !== 'boolean' && finite(raw) === undefined) return null
    const value = raw as number | boolean
    const { min, max } = range(record(tier.ranges)?.[key])
    const step = finite(record(tier.steps)?.[key])
    const editable = record(tier.user_editable)?.[key]
    return {
        key,
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
        ...(step !== undefined ? { step } : {}),
        default: value,
        user_editable: typeof editable === 'boolean' ? editable && !NOT_USER_EDITABLE.has(key) : !NOT_USER_EDITABLE.has(key),
    }
}

function surfaceCapabilities(surface: VoiceSurface, tier: NarrationTier | null, wire: WireRecord): VoiceSurfaceCapabilities {
    const keys = Array.isArray(wire.controls) ? wire.controls.filter(isControlKey) : []
    const controls = [...new Set(keys)]
        .map((key) => controlSpec(key, wire))
        .filter((spec): spec is VoiceControlSpec => spec !== null)
    const speedListed = controls.some((spec) => spec.key === 'speed')
    return {
        surface,
        tier,
        controls,
        supports_emotion: typeof wire.supports_emotion === 'boolean'
            ? wire.supports_emotion
            : Array.isArray(wire.controls) && wire.controls.includes('emotion'),
        supports_speed: typeof wire.supports_speed === 'boolean' ? wire.supports_speed : speedListed,
        max_chars: count(wire.max_chars),
        max_turn_chars: count(wire.max_turn_chars),
        healthy: wire.healthy !== false,
    }
}

/** A surface is either `{tier: caps}` or, for `preview`, an envelope that may nest `tiers`. */
function surfaceEntries(surface: VoiceSurface, wire: WireRecord): VoiceSurfaceCapabilities[] {
    const nested = record(wire.tiers)
    const byTier = nested ?? wire
    // An envelope's own text limit (preview: the fixed-text length, 08 §5.6) wins over the tier's.
    const envelopeMax = nested ? count(wire.max_chars) : null
    const tiers = TIERS.flatMap((tier) => {
        const caps = record(byTier[tier])
        if (!caps) return []
        const entry = surfaceCapabilities(surface, tier, caps)
        return [envelopeMax !== null ? { ...entry, max_chars: envelopeMax } : entry]
    })
    if (tiers.length > 0) return tiers
    // No tiers on the wire (08's preview sketch): one tierless entry with its text limit.
    return 'controls' in wire || 'max_chars' in wire ? [surfaceCapabilities(surface, null, wire)] : []
}

function status(value: unknown): VoiceCapabilityStatus {
    const wire = record(value)
    if (!wire) return { ...FAIL_OPEN_VOICE_STATUS }
    const flag = (key: keyof VoiceCapabilityStatus) =>
        typeof wire[key] === 'boolean' ? (wire[key] as boolean) : FAIL_OPEN_VOICE_STATUS[key]
    return {
        narration_available: flag('narration_available'),
        calls_available: flag('calls_available'),
        auto_narration_paused: flag('auto_narration_paused'),
    }
}

/**
 * Maps a `GET /voices/capabilities` body to the view model. Returns null when
 * the body is not a capabilities object at all (no `surfaces` record), which
 * callers treat as a failed read.
 */
export function toVoiceCapabilities(raw: unknown): VoiceCapabilities | null {
    const body = record(raw)
    const wireSurfaces = record(body?.surfaces)
    if (!body || !wireSurfaces) return null
    const surfaces = SURFACES.flatMap((surface) => {
        const wire = record(wireSurfaces[surface])
        return wire ? surfaceEntries(surface, wire) : []
    })
    const tiersAllowed = Array.isArray(body.tiers_allowed) ? [...new Set(body.tiers_allowed.filter(isTier))] : []
    const storedTier = isTier(body.narration_tier) ? body.narration_tier : null
    // D05: a tier the plan does not allow reads as Standard (or the first allowed tier).
    const narrationTier = storedTier && tiersAllowed.length > 0 && !tiersAllowed.includes(storedTier)
        ? (tiersAllowed.includes('standard') ? 'standard' : tiersAllowed[0])
        : storedTier
    // EP-11 is always sent; an older body without it keeps the key absent (all off on read).
    const companionSafeguards = safeguards(body.safeguards)
    return {
        surfaces,
        provider_route: 'elevenlabs',
        tiers_allowed: tiersAllowed,
        narration_tier: narrationTier,
        consent_version_required: 'voice-v2',
        status: status(body.status),
        ...(companionSafeguards ? { safeguards: companionSafeguards } : {}),
    }
}

/** The capabilities of one surface and tier, if the server listed them. */
export function surfaceCapabilitiesFor(
    capabilities: VoiceCapabilities | null | undefined,
    surface: VoiceSurface,
    tier: NarrationTier | null = null,
): VoiceSurfaceCapabilities | null {
    return capabilities?.surfaces.find((entry) => entry.surface === surface && entry.tier === tier) ?? null
}

/** Client cache lifetime: matches the server-side settings TTL (09 §7, D28). */
export const VOICE_CAPABILITIES_TTL_MS = 60_000

let capabilitiesCache: { key: string; expiresAt: number; value: Promise<VoiceCapabilities> } | null = null

/**
 * One shared capabilities read per account key for {@link VOICE_CAPABILITIES_TTL_MS}.
 * A failed read is dropped from the cache so the next caller retries.
 */
export function cachedVoiceCapabilities(
    key: string,
    load: () => Promise<VoiceCapabilities>,
    options: { fresh?: boolean } = {},
): Promise<VoiceCapabilities> {
    const now = Date.now()
    const current = capabilitiesCache
    if (!options.fresh && current && current.key === key && current.expiresAt > now) return current.value
    const entry = { key, expiresAt: now + VOICE_CAPABILITIES_TTL_MS, value: load() }
    capabilitiesCache = entry
    entry.value.catch(() => {
        if (capabilitiesCache === entry) capabilitiesCache = null
    })
    return entry.value
}

/** Forget the cached capabilities (tests, sign-out). */
export function clearVoiceCapabilitiesCache(): void {
    capabilitiesCache = null
}
