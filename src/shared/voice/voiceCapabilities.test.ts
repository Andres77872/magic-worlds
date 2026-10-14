import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    FAIL_OPEN_VOICE_STATUS,
    SAFEGUARDS_OFF,
    VOICE_CAPABILITIES_TTL_MS,
    cachedVoiceCapabilities,
    clearVoiceCapabilitiesCache,
    readSafeguards,
    surfaceCapabilitiesFor,
    toVoiceCapabilities,
} from './voiceCapabilities'
import { BFF_EL_PLUS_BODY, BFF_R0_BODY } from './voiceCapabilities.fixtures'

function tier(overrides: Record<string, unknown> = {}) {
    return {
        controls: ['stability', 'similarity_boost', 'speed', 'emotion'],
        ranges: { stability: [0, 1], similarity_boost: [0, 1], speed: [0.7, 1.2] },
        defaults: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
        supports_emotion: true,
        supports_speed: true,
        max_chars: 40000,
        max_turn_chars: 2500,
        healthy: true,
        ...overrides,
    }
}

/** An older BFF body (`src/models/voice_capabilities.py` before 09 §1.5): surfaces only, no client switches. */
const BFF_BODY = {
    surfaces: {
        narration: {
            standard: tier(),
            expressive: tier({
                controls: ['stability', 'similarity_boost', 'emotion'],
                ranges: { stability: [0, 1], similarity_boost: [0, 1] },
                defaults: { stability: 0.5, similarity_boost: 0.75 },
                supports_speed: false,
                max_chars: 5000,
                healthy: false,
            }),
        },
        call: { standard: tier({ max_turn_chars: null }) },
        preview: { text_ids_per_language: 3, max_chars: 150, tiers: { standard: tier({ max_turn_chars: null }) } },
    },
}

describe('toVoiceCapabilities', () => {
    it('maps the BFF body to the view model and ignores the emotion control key', () => {
        const capabilities = toVoiceCapabilities(BFF_BODY)!
        const standard = surfaceCapabilitiesFor(capabilities, 'narration', 'standard')!

        expect(standard.controls.map((control) => control.key)).toEqual(['stability', 'similarity_boost', 'speed'])
        expect(standard.controls.find((control) => control.key === 'speed')).toEqual({ key: 'speed', min: 0.7, max: 1.2, default: 1, user_editable: true })
        expect(standard).toMatchObject({ surface: 'narration', tier: 'standard', supports_emotion: true, supports_speed: true, max_chars: 40000, max_turn_chars: 2500, healthy: true })

        const expressive = surfaceCapabilitiesFor(capabilities, 'narration', 'expressive')!
        expect(expressive.controls.map((control) => control.key)).toEqual(['stability', 'similarity_boost'])
        expect(expressive).toMatchObject({ supports_speed: false, healthy: false })

        expect(surfaceCapabilitiesFor(capabilities, 'call', 'standard')?.max_turn_chars).toBeNull()
        // The preview envelope's fixed-text limit wins over the tier's.
        expect(surfaceCapabilitiesFor(capabilities, 'preview', 'standard')?.max_chars).toBe(150)
    })

    it('parses the exact response of the purged BFF (09 §1.5 switches, steps, user_editable, safeguards)', () => {
        const capabilities = toVoiceCapabilities(BFF_R0_BODY)!
        expect(capabilities.provider_route).toBe('elevenlabs')
        expect(capabilities.tiers_allowed).toEqual(['standard'])
        expect(capabilities.narration_tier).toBe('standard')
        expect(capabilities.consent_version_required).toBe('voice-v2')
        expect(capabilities.status).toEqual({ narration_available: true, calls_available: true, auto_narration_paused: false })
        expect(capabilities.safeguards).toEqual(SAFEGUARDS_OFF)
        expect(capabilities.surfaces.map((entry) => `${entry.surface}:${entry.tier}`)).toEqual([
            'narration:standard',
            'narration:expressive',
            'call:standard',
            'preview:standard',
            'preview:expressive',
        ])

        const standard = surfaceCapabilitiesFor(capabilities, 'narration', 'standard')!
        expect(standard.controls).toEqual([
            { key: 'stability', min: 0, max: 1, step: 0.05, default: 0.5, user_editable: true },
            { key: 'similarity_boost', min: 0, max: 1, step: 0.05, default: 0.75, user_editable: true },
            { key: 'speed', min: 0.7, max: 1.2, step: 0.05, default: 1, user_editable: true },
        ])
        expect(standard).toMatchObject({ supports_emotion: true, supports_speed: true, max_chars: 1200, max_turn_chars: 2500, healthy: true })
        expect(surfaceCapabilitiesFor(capabilities, 'narration', 'expressive')!.controls.map((control) => [control.key, control.step])).toEqual([
            ['stability', 0.05],
            ['similarity_boost', 0.05],
        ])
        expect(surfaceCapabilitiesFor(capabilities, 'call', 'standard')).toMatchObject({ max_chars: 1200, max_turn_chars: null })
        expect(surfaceCapabilitiesFor(capabilities, 'preview', 'expressive')?.max_chars).toBe(150)
        // No `admin_lab` surface is listed: the synth lab reads the narration tier's limit (same model row).
        expect(surfaceCapabilitiesFor(capabilities, 'admin_lab', 'standard')).toBeNull()
    })

    it('reads a switched-off status and never lets user_editable re-open style or speaker boost', () => {
        const capabilities = toVoiceCapabilities({
            ...BFF_R0_BODY,
            status: { narration_available: false, calls_available: false, auto_narration_paused: true },
            surfaces: {
                ...BFF_R0_BODY.surfaces,
                narration: {
                    standard: {
                        ...BFF_R0_BODY.surfaces.narration.standard,
                        controls: ['stability', 'style', 'use_speaker_boost'],
                        defaults: { stability: 0.5, style: 0, use_speaker_boost: true },
                        user_editable: { stability: false, style: true, use_speaker_boost: true },
                    },
                },
            },
        })!
        expect(capabilities.status).toEqual({ narration_available: false, calls_available: false, auto_narration_paused: true })
        expect(surfaceCapabilitiesFor(capabilities, 'narration', 'standard')!.controls.map((control) => [control.key, control.user_editable])).toEqual([
            ['stability', false],
            ['style', false],
            ['use_speaker_boost', false],
        ])
    })

    it('clamps narration_tier to tiers_allowed (D05)', () => {
        expect(toVoiceCapabilities({ ...BFF_R0_BODY, narration_tier: 'expressive' })!.narration_tier).toBe('standard')
        expect(toVoiceCapabilities({ ...BFF_R0_BODY, tiers_allowed: ['standard', 'expressive'], narration_tier: 'expressive' })!.narration_tier).toBe('expressive')
        // No tiers reported: the stored tier is kept as sent.
        expect(toVoiceCapabilities({ surfaces: {}, narration_tier: 'expressive' })!.narration_tier).toBe('expressive')
    })

    it('reads the Plus body: both tiers, Expressive chosen (tiers by plan, no route term)', () => {
        const capabilities = toVoiceCapabilities(BFF_EL_PLUS_BODY)!
        expect(capabilities.tiers_allowed).toEqual(['standard', 'expressive'])
        expect(capabilities.narration_tier).toBe('expressive')
        expect(capabilities.provider_route).toBe('elevenlabs')
        expect(capabilities.consent_version_required).toBe('voice-v2')
    })

    it('tolerates the absence of the 09 §1.5 client switches, pinning the route and consent version', () => {
        const capabilities = toVoiceCapabilities(BFF_BODY)!
        expect(capabilities.provider_route).toBe('elevenlabs')
        expect(capabilities.tiers_allowed).toEqual([])
        expect(capabilities.narration_tier).toBeNull()
        expect(capabilities.consent_version_required).toBe('voice-v2')
        expect(capabilities.status).toEqual(FAIL_OPEN_VOICE_STATUS)
        expect(capabilities).not.toHaveProperty('safeguards')
    })

    it('reads the client switches when the server sends them, dropping unknown values', () => {
        const capabilities = toVoiceCapabilities({
            ...BFF_BODY,
            provider_route: 'someday',
            tiers_allowed: ['standard', 'turbo', 'expressive', 'standard'],
            narration_tier: 'expressive',
            consent_version_required: 'voice-v9',
            status: { narration_available: false, auto_narration_paused: true, calls_available: 'no' },
        })!
        // No code branches on the route or the version: both are pinned to the only values left (I-68).
        expect(capabilities.provider_route).toBe('elevenlabs')
        expect(capabilities.tiers_allowed).toEqual(['standard', 'expressive'])
        expect(capabilities.narration_tier).toBe('expressive')
        expect(capabilities.consent_version_required).toBe('voice-v2')
        expect(capabilities.status).toEqual({ narration_available: false, calls_available: true, auto_narration_paused: true })
    })

    it('ignores unknown control keys, controls without a default, unknown surfaces and tiers', () => {
        const capabilities = toVoiceCapabilities({
            surfaces: {
                narration: {
                    standard: tier({
                        controls: ['stability', 'pitch', 'style', 'use_speaker_boost', 'speed'],
                        defaults: { stability: 0.4, style: 0, use_speaker_boost: true },
                        ranges: { stability: { min: 0.1, max: 0.9 } },
                    }),
                    turbo: tier(),
                },
                karaoke: { standard: tier() },
            },
        })!
        const controls = surfaceCapabilitiesFor(capabilities, 'narration', 'standard')!.controls
        // `pitch` is unknown; `speed` has no default, so it cannot be rendered without a hard-coded fallback.
        expect(controls).toEqual([
            { key: 'stability', min: 0.1, max: 0.9, default: 0.4, user_editable: true },
            { key: 'style', default: 0, user_editable: false },
            { key: 'use_speaker_boost', default: true, user_editable: false },
        ])
        expect(capabilities.surfaces.map((entry) => `${entry.surface}:${entry.tier}`)).toEqual(['narration:standard'])
    })

    it('rejects a body that is not a capabilities object', () => {
        expect(toVoiceCapabilities(null)).toBeNull()
        expect(toVoiceCapabilities('<html>')).toBeNull()
        expect(toVoiceCapabilities({ detail: 'Not Found' })).toBeNull()
        expect(toVoiceCapabilities({ surfaces: {} })?.surfaces).toEqual([])
    })
})

describe('readSafeguards (EP-11)', () => {
    it('reads all-off when the server sends no safeguards (an older BFF build)', () => {
        const withoutSafeguards: Record<string, unknown> = { ...BFF_R0_BODY }
        delete withoutSafeguards.safeguards
        const capabilities = toVoiceCapabilities(withoutSafeguards)!
        expect(capabilities).not.toHaveProperty('safeguards')
        expect(readSafeguards(capabilities)).toEqual(SAFEGUARDS_OFF)
        expect(readSafeguards(null)).toEqual({ retention_guard: false, self_harm_pause: false, break_nudge_minutes: null, paused_until: null })
        expect(readSafeguards(undefined)).toEqual(SAFEGUARDS_OFF)
    })

    it('passes the companion block through, normalised', () => {
        const capabilities = toVoiceCapabilities({
            ...BFF_R0_BODY,
            safeguards: { retention_guard: true, self_harm_pause: true, break_nudge_minutes: 45, paused_until: '2026-10-13T12:30:00Z', extra: 'x' },
        })!
        expect(capabilities.safeguards).toEqual({ retention_guard: true, self_harm_pause: true, break_nudge_minutes: 45, paused_until: '2026-10-13T12:30:00Z' })
        expect(readSafeguards(capabilities)).toEqual(capabilities.safeguards)
    })

    it('reads a malformed block as off, field by field', () => {
        const capabilities = toVoiceCapabilities({
            ...BFF_R0_BODY,
            safeguards: { retention_guard: 'yes', self_harm_pause: 1, break_nudge_minutes: -5, paused_until: 42 },
        })!
        expect(readSafeguards(capabilities)).toEqual(SAFEGUARDS_OFF)
        expect(readSafeguards(toVoiceCapabilities({ ...BFF_R0_BODY, safeguards: { break_nudge_minutes: Number.POSITIVE_INFINITY } }))).toEqual(SAFEGUARDS_OFF)
        // Not an object: no key in the view model at all.
        expect(toVoiceCapabilities({ ...BFF_R0_BODY, safeguards: ['on'] })).not.toHaveProperty('safeguards')
        expect(toVoiceCapabilities({ ...BFF_R0_BODY, safeguards: null })).not.toHaveProperty('safeguards')
    })
})

describe('cachedVoiceCapabilities', () => {
    afterEach(() => {
        vi.useRealTimers()
        clearVoiceCapabilitiesCache()
    })

    it('shares one read per account for the TTL and retries after a failure', async () => {
        vi.useFakeTimers()
        const value = toVoiceCapabilities(BFF_BODY)!
        const load = vi.fn(async () => value)

        await cachedVoiceCapabilities('token-a', load)
        await cachedVoiceCapabilities('token-a', load)
        expect(load).toHaveBeenCalledTimes(1)

        await cachedVoiceCapabilities('token-b', load)
        expect(load).toHaveBeenCalledTimes(2)

        vi.advanceTimersByTime(VOICE_CAPABILITIES_TTL_MS + 1)
        await cachedVoiceCapabilities('token-b', load)
        expect(load).toHaveBeenCalledTimes(3)

        await cachedVoiceCapabilities('token-b', load, { fresh: true })
        expect(load).toHaveBeenCalledTimes(4)

        const failing = vi.fn(async () => { throw new Error('503') })
        await expect(cachedVoiceCapabilities('token-c', failing)).rejects.toThrow('503')
        await expect(cachedVoiceCapabilities('token-c', failing)).rejects.toThrow('503')
        expect(failing).toHaveBeenCalledTimes(2)
    })
})
