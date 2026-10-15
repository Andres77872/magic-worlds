import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UserNotification } from '@/shared/types'
import { FRONTEND_FEATURE_ENV } from '@/shared/featureFlags'
import { notificationActionAvailable } from './notificationAvailability'

const notice = (action_url: string | null, metadata: UserNotification['metadata'] = null): UserNotification => ({
    notification_id: 1, type: 'job.completed', category: 'generation', severity: 'success', title: 'Done', body: 'Ready',
    action_url, action_label: 'Open', metadata, read_at: null, created_at: '2026-10-15T00:00:00Z', expires_at: null,
})
afterEach(() => vi.unstubAllEnvs())

describe('notification destinations', () => {
    it('checks same-origin links and disabled gallery modes without mutating history', () => {
        vi.stubEnv(FRONTEND_FEATURE_ENV.voices, 'false')
        vi.stubEnv(FRONTEND_FEATURE_ENV.communityCards, 'false')
        vi.stubEnv(FRONTEND_FEATURE_ENV.groupChats, 'false')
        const item = notice(`${window.location.origin}/#/voices`)
        const original = structuredClone(item)
        expect(notificationActionAvailable(item)).toBe(false)
        expect(item).toEqual(original)
        expect(notificationActionAvailable(notice('#/gallery/characters?view=public'))).toBe(false)
        expect(notificationActionAvailable(notice('#/gallery/characters?mode=group-chat'))).toBe(false)
        expect(notificationActionAvailable(notice('#/gallery/characters?card=c1'))).toBe(true)
    })
    it.each(['#/calls', '#/voices', '#/gallery/resources', '#/lorebook', '#/story', '#/interaction', '#/assistant', '#/library'])(
        'offers no action into disabled %s', (hash) => {
            for (const env of Object.values(FRONTEND_FEATURE_ENV)) vi.stubEnv(env, 'false')
            expect(notificationActionAvailable(notice(hash))).toBe(false)
        },
    )
    it('respects the voices parent for a calls destination and a narration job', () => {
        vi.stubEnv(FRONTEND_FEATURE_ENV.voices, 'false')
        vi.stubEnv(FRONTEND_FEATURE_ENV.calls, 'true')
        expect(notificationActionAvailable(notice('#/calls'))).toBe(false)
        expect(notificationActionAvailable(notice(null, { job_kind: 'text_to_speech' }))).toBe(false)
    })
    it('keeps ungated account and character actions available', () => {
        for (const env of Object.values(FRONTEND_FEATURE_ENV)) vi.stubEnv(env, 'false')
        expect(notificationActionAvailable(notice('#/profile'))).toBe(true)
        expect(notificationActionAvailable(notice('#/character?card=c1'))).toBe(true)
    })
    it.each(['tts', 'tts_job', 'text_to_speech', 'tts_generation'])('hides a sparse %s notification without operation metadata', (job_kind) => {
        vi.stubEnv(FRONTEND_FEATURE_ENV.voices, 'false')
        expect(notificationActionAvailable(notice('/tts/jobs/clip', { job_kind, job_id: 'clip' }))).toBe(false)
    })
})
