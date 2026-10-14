/**
 * Job B mass-removal override (D19 item 7, 03 §5.16 I-29/I-34; BFF
 * `request_sync` / `_confirm_removals`).
 *
 * When more voices are missing than the guard allows, Job B aborts with the
 * reason `mass_removal` and removes nothing. The limits report it as the B run
 * with `status: 'aborted'` and `detail: 'mass_removal'`. Root may then send
 * `POST /admin/voices/sync {job: 'B', voice_keys, confirm_removal: true}`
 * (1–100 keys): each voice is re-read on its own and only a confirmed provider
 * 404 removes it. The answer is `completed` with
 * `"removed=<n> present=<n> errors=<n> skipped=<n> replacement_orphans=<n>"`,
 * or `running` with `lease_held`. The BFF keeps Job B's last result until the
 * next run, so the override stays offered until then.
 */
import type { AdminCatalogVoice, AdminVoiceLimits, VoiceSyncRun } from '@/shared'

export const MASS_REMOVAL_REASON = 'mass_removal'
/** `AdminVoiceSyncRequest.voice_keys` holds 1–100 keys. */
export const MAX_CONFIRM_REMOVAL_KEYS = 100
export const SYNC_LEASE_HELD = 'lease_held'

/** The Job B run that aborted on mass removal, if the limits report one. */
export function massRemovalAbort(limits: AdminVoiceLimits | null | undefined): VoiceSyncRun | null {
    const runs = Array.isArray(limits?.sync_runs) ? limits.sync_runs : []
    return runs.find((run) => run.job === 'B' && run.status === 'aborted' && run.detail === MASS_REMOVAL_REASON) ?? null
}

export interface ConfirmRemovalCounts {
    removed: number
    present: number
    errors: number
    skipped: number
    replacement_orphans: number
}

const COUNT_NAMES: readonly (keyof ConfirmRemovalCounts)[] = ['removed', 'present', 'errors', 'skipped', 'replacement_orphans']

/**
 * The counts of a `confirm_removal` answer's `detail`; null when the detail is
 * not that summary (for example `lease_held`). Missing counts read as 0.
 */
export function confirmRemovalCounts(detail: string | null | undefined): ConfirmRemovalCounts | null {
    if (typeof detail !== 'string') return null
    const counts: ConfirmRemovalCounts = { removed: 0, present: 0, errors: 0, skipped: 0, replacement_orphans: 0 }
    let seen = false
    for (const token of detail.trim().split(/\s+/)) {
        const match = /^([a-z_]+)=(\d+)$/.exec(token)
        if (!match) continue
        const name = match[1] as keyof ConfirmRemovalCounts
        if (!COUNT_NAMES.includes(name)) continue
        counts[name] = Number.parseInt(match[2], 10)
        seen = true
    }
    return seen ? counts : null
}

/**
 * The voices root may confirm: every catalog voice not already `removed`,
 * the oldest sync first (a voice the aborted run could not confirm keeps its
 * older sync time), then by name.
 */
export function removalCandidates(voices: readonly AdminCatalogVoice[]): AdminCatalogVoice[] {
    const time = (voice: AdminCatalogVoice) => {
        const value = voice.last_synced_at ? Date.parse(voice.last_synced_at) : Number.NaN
        return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value
    }
    return voices
        .filter((voice) => voice.status !== 'removed')
        .sort((a, b) => time(a) - time(b) || a.display_name.localeCompare(b.display_name) || a.voice_key.localeCompare(b.voice_key))
}

/**
 * The voices that use one of `selected` as their replacement and are not
 * selected themselves: a confirmed removal would leave them without one (I-34).
 */
export function selectionDependents(voices: readonly AdminCatalogVoice[], selected: ReadonlySet<string>): AdminCatalogVoice[] {
    return voices.filter(
        (voice) => voice.status !== 'removed' && voice.replacement_voice_key !== null && selected.has(voice.replacement_voice_key) && !selected.has(voice.voice_key),
    )
}
