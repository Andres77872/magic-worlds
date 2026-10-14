import { describe, expect, it } from 'vitest'
import type { AdminCatalogVoice, AdminVoiceLimits } from '@/shared'
import { auditLimits, draftVoice, readyVoice, replacementVoice } from './fixtures'
import { confirmRemovalCounts, massRemovalAbort, removalCandidates, selectionDependents } from './massRemoval'

const withRuns = (runs: AdminVoiceLimits['sync_runs']): AdminVoiceLimits => ({ ...auditLimits, sync_runs: runs })

describe('massRemovalAbort', () => {
    it('finds only a Job B run aborted on mass removal', () => {
        const run = { job: 'B' as const, status: 'aborted' as const, started_at: null, finished_at: '2026-10-12T06:05:40Z', mass_miss_abort: true, detail: 'mass_removal' }
        expect(massRemovalAbort(withRuns([run]))).toEqual(run)
        expect(massRemovalAbort(withRuns([{ ...run, detail: 'mass_voice_denial' }]))).toBeNull()
        expect(massRemovalAbort(withRuns([{ ...run, job: 'A', detail: 'mass_removal' }]))).toBeNull()
        expect(massRemovalAbort(withRuns([{ ...run, status: 'ok' }]))).toBeNull()
        // The audit fixture's B abort carries no reason: not a mass removal the override may confirm.
        expect(massRemovalAbort(auditLimits)).toBeNull()
        expect(massRemovalAbort(null)).toBeNull()
    })
})

describe('confirmRemovalCounts', () => {
    it('parses the override summary', () => {
        expect(confirmRemovalCounts('removed=2 present=1 errors=0 skipped=3 replacement_orphans=4')).toEqual({
            removed: 2,
            present: 1,
            errors: 0,
            skipped: 3,
            replacement_orphans: 4,
        })
        expect(confirmRemovalCounts('removed=1')).toEqual({ removed: 1, present: 0, errors: 0, skipped: 0, replacement_orphans: 0 })
    })

    it('is null for any other detail', () => {
        expect(confirmRemovalCounts('lease_held')).toBeNull()
        expect(confirmRemovalCounts(null)).toBeNull()
        expect(confirmRemovalCounts(undefined)).toBeNull()
    })
})

describe('removal candidates and dependents', () => {
    const removed: AdminCatalogVoice = { ...draftVoice, voice_key: 'vk_gone', display_name: 'Gone', status: 'removed' }
    const stale: AdminCatalogVoice = { ...draftVoice, voice_key: 'vk_stale', display_name: 'Stale', last_synced_at: '2026-09-01T00:00:00Z' }
    const never: AdminCatalogVoice = { ...draftVoice, voice_key: 'vk_never', display_name: 'Never', last_synced_at: null }

    it('leaves removed voices out and lists the oldest sync first', () => {
        const keys = removalCandidates([readyVoice, removed, stale, never]).map((voice) => voice.voice_key)
        expect(keys.slice(0, 2)).toEqual(['vk_never', 'vk_stale'])
        expect(keys).not.toContain('vk_gone')
        expect(keys).toContain(readyVoice.voice_key)
    })

    it('names the unselected voices that use a selected voice as their replacement', () => {
        // Ysolde's replacement is Maren in the fixtures.
        expect(selectionDependents([readyVoice, replacementVoice], new Set([readyVoice.voice_key])).map((voice) => voice.voice_key)).toEqual([replacementVoice.voice_key])
        expect(selectionDependents([readyVoice, replacementVoice], new Set([readyVoice.voice_key, replacementVoice.voice_key]))).toEqual([])
    })
})
