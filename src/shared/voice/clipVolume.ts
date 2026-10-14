/**
 * Player-side loudness (D16): every narration clip and call turn plays at
 *
 *     volume = user × 10^(gain_db / 20) × (kind === 'thought' ? 0.708 : 1)
 *
 * `gain_db` is the voice's measured catalog gain, attenuation only, so it is
 * clamped to [-24, 0]. Only clips that carry it get the -3 dB thought factor:
 * a clip stored without `gain_db` (its thoughts already dimmed by the server)
 * must play exactly as it was recorded (06 §9.2).
 */

/** -3 dB, applied to thought clips that carry a `gain_db`. */
export const THOUGHT_GAIN = 0.708

export const MIN_CLIP_GAIN_DB = -24
export const MAX_CLIP_GAIN_DB = 0

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

/** The clamped gain in dB, or null when the clip has none (missing or not a finite number). */
export function clipGainDb(gainDb: number | null | undefined): number | null {
    if (typeof gainDb !== 'number' || !Number.isFinite(gainDb)) return null
    return clamp(gainDb, MIN_CLIP_GAIN_DB, MAX_CLIP_GAIN_DB)
}

/**
 * Element volume (0..1) for one clip. Pass `userVolume` 0 when muted. A
 * non-finite `userVolume` counts as full volume rather than throwing on
 * `audio.volume`.
 */
export function clipVolume(userVolume: number, gainDb: number | null | undefined, kind?: string | null): number {
    const user = Number.isFinite(userVolume) ? clamp(userVolume, 0, 1) : 1
    const gain = clipGainDb(gainDb)
    if (gain === null) return user
    const thought = kind === 'thought' ? THOUGHT_GAIN : 1
    return clamp(user * 10 ** (gain / 20) * thought, 0, 1)
}
