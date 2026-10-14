import type { AdminVoiceLimits } from '@/shared'
import { BUDGET_THRESHOLDS, LIBRARY_MIN_VOICE_OPS, SLOT_ALERT_RATIO } from '../../constants'

export type BudgetState = 'ok' | 'alert50' | 'alert80' | 'paused95' | 'stopped100'

export function budgetState(spent: number, budget: number | null): BudgetState {
    if (!budget || budget <= 0) return 'ok'
    const ratio = spent / budget
    if (ratio >= BUDGET_THRESHOLDS.stopped100) return 'stopped100'
    if (ratio >= BUDGET_THRESHOLDS.paused95) return 'paused95'
    if (ratio >= BUDGET_THRESHOLDS.alert80) return 'alert80'
    if (ratio >= BUDGET_THRESHOLDS.alert50) return 'alert50'
    return 'ok'
}

export interface LimitsSummary {
    slotsUsed: number | null
    slotLimit: number | null
    slotsAlert: boolean
    opsLeft: number | null
    opsLow: boolean
    spentToday: number
    budget: number | null
    budgetStatus: BudgetState
    syncAlert: boolean
}

/** A count the provider reported; the BFF sends null for one it did not. */
export function knownCount(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function summarizeLimits(limits: AdminVoiceLimits | null): LimitsSummary {
    const subscription = limits?.subscription ?? null
    const slotsUsed = knownCount(subscription?.voice_slots_used)
    const slotLimit = knownCount(subscription?.voice_limit)
    const opsUsed = knownCount(subscription?.voice_add_edit_counter)
    const opsMax = knownCount(subscription?.max_voice_add_edits)
    const opsLeft = opsUsed !== null && opsMax !== null ? Math.max(0, opsMax - opsUsed) : null
    const spentToday = (limits?.spend_today ?? []).reduce((sum, row) => sum + row.chars, 0)
    const budget = limits?.daily_budget_chars ?? null
    return {
        slotsUsed,
        slotLimit,
        slotsAlert: slotsUsed !== null && slotLimit !== null && slotLimit > 0 && slotsUsed / slotLimit >= SLOT_ALERT_RATIO,
        opsLeft,
        opsLow: opsLeft !== null && opsLeft < LIBRARY_MIN_VOICE_OPS,
        spentToday,
        budget,
        budgetStatus: budgetState(spentToday, budget),
        syncAlert: (limits?.sync_runs ?? []).some((run) => run.mass_miss_abort || run.status === 'failed' || run.status === 'aborted'),
    }
}

// ---- Runtime switches (I-12, 08 §3.5) ----

/** `voice_runtime_setting` keys ANDed with an env boot gate: a row can only turn the surface off. */
export const RUNTIME_ENV_GATES: Readonly<Record<string, string>> = {
    tts_engine_enabled: 'TTS_ENGINE_ENABLED',
    voice_mode_enabled: 'VOICE_MODE_ENABLED',
}

export interface RuntimeGateState {
    /** The env boot gate the row is ANDed with. */
    env: string
    /** `false`: the surface is off whatever the env says; `true`: on only if the env is on too. */
    dbOn: boolean
}

/** Effective-switch reading for an env-gated boolean row; null for every other key or value. */
export function runtimeGateState(settingKey: string, value: unknown): RuntimeGateState | null {
    const env = RUNTIME_ENV_GATES[settingKey]
    if (!env || typeof value !== 'boolean') return null
    return { env, dbOn: value }
}
