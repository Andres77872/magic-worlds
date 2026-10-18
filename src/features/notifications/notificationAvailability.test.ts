import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags, setAllTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UserNotification } from '@/shared/types'
import { notificationActionAvailable } from './notificationAvailability'

const notice = (action_url: string | null, metadata: UserNotification['metadata'] = null): UserNotification => ({
    notification_id: 1, type: 'job.completed', category: 'generation', severity: 'success', title: 'Done', body: 'Ready',
    action_url, action_label: 'Open', metadata, read_at: null, created_at: '2026-10-15T00:00:00Z', expires_at: null,
})
afterEach(() => vi.unstubAllEnvs())

describe('notification destinations', () => {
    it('checks same-origin links and disabled gallery modes without mutating history', () => {
        setTestFeatureFlags({ voices: false })
        setTestFeatureFlags({ communityCards: false })
        setTestFeatureFlags({ groupChats: false })
        const item = notice(`${window.location.origin}/#/voices`)
        const original = structuredClone(item)
        expect(notificationActionAvailable(item)).toBe(false)
        expect(item).toEqual(original)
        expect(notificationActionAvailable(notice('#/gallery/characters?view=public'))).toBe(false)
        expect(notificationActionAvailable(notice('#/gallery/characters?mode=group-chat'))).toBe(false)
        expect(notificationActionAvailable(notice('#/gallery/characters?card=c1'))).toBe(true)
    })
    it.each(['#/calls', '#/voices', '#/gallery/resources', '#/lorebook', '#/story', '#/interaction', '#/assistant'])(
        'offers no action into disabled %s', (hash) => {
            setAllTestFeatureFlags(false)
            expect(notificationActionAvailable(notice(hash))).toBe(false)
        },
    )
    it('respects the voices parent for a calls destination and a narration job', () => {
        setTestFeatureFlags({ voices: false })
        setTestFeatureFlags({ calls: true })
        expect(notificationActionAvailable(notice('#/calls'))).toBe(false)
        expect(notificationActionAvailable(notice(null, { job_kind: 'text_to_speech' }))).toBe(false)
    })
    it('keeps ungated account and character actions available', () => {
        setAllTestFeatureFlags(false)
        expect(notificationActionAvailable(notice('#/profile'))).toBe(true)
        expect(notificationActionAvailable(notice('#/library'))).toBe(true)
        expect(notificationActionAvailable(notice('#/character?card=c1'))).toBe(true)
    })
    it.each(['tts', 'tts_job', 'text_to_speech', 'tts_generation'])('hides a sparse %s notification without operation metadata', (job_kind) => {
        setTestFeatureFlags({ voices: false })
        expect(notificationActionAvailable(notice('/tts/jobs/clip', { job_kind, job_id: 'clip' }))).toBe(false)
    })
})
