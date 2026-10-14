import type { Membership, MembershipVoiceUsage } from '@/shared/types/auth.types'

/** A daily cap with today's use; `remaining` never goes below 0. */
export interface VoiceUsageMeter {
    used: number
    limit: number
    remaining: number
}

/**
 * Today's voice usage against the plan caps (D24, D18), or null when the
 * server sends none of the fields (servers before the R0 usage DTO).
 * `narration` is in Standard-equivalent characters, `call` in seconds.
 */
export interface VoiceUsageView {
    narration: VoiceUsageMeter | null
    call: VoiceUsageMeter | null
    previewsLeft: number | null
}

type VoiceUsageSource = Pick<Membership, 'voice_usage'> & MembershipVoiceUsage

function count(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/** A meter needs both halves of the pair; a lone field is not enough to show a cap. */
function meter(used: number | null, limit: number | null): VoiceUsageMeter | null {
    if (used === null || limit === null) return null
    return { used, limit, remaining: Math.max(0, limit - used) }
}

/**
 * Reads the D24 usage fields from a membership. They are flat on the
 * membership (08 §1.10, decided by 03 §5.16 I-1); the nested `voice_usage`
 * block of the dropped 09 §1.8 proposal is read only as a per-field fallback.
 */
export function readVoiceUsage(membership: VoiceUsageSource | null | undefined): VoiceUsageView | null {
    if (!membership) return null
    const nested = membership.voice_usage ?? null
    const field = (key: keyof MembershipVoiceUsage): number | null => count(membership[key]) ?? count(nested?.[key])
    const narration = meter(field('narration_chars_used'), field('narration_chars_limit'))
    const call = meter(field('call_seconds_used'), field('call_seconds_limit'))
    const previewsLeft = field('previews_left')
    if (!narration && !call && previewsLeft === null) return null
    return { narration, call, previewsLeft }
}
