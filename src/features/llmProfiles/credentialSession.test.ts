import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authSession } from '@/infrastructure/api/authSession'
import { credentialSession } from './credentialSession'
import type { EffectiveLlmProfile } from '@/shared/types/llmProfile.types'

vi.mock('@/infrastructure/api/baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))
const KEY = 'FAKE_SESSION_CANARY'
function token(project = 'project-one'): string {
    return `header.${btoa(JSON.stringify({ project_hash: project }))}.signature`
}
const profile = { project_hash: 'project-one', profile_id: '11111111-1111-4111-8111-111111111111', revision_id: '22222222-2222-4222-8222-222222222222',
    profile_scope: 'user', credential_mode: 'user_byok', provider_target_key: 'approved-target', platform_connection_key: null,
    resolution_source: 'explicit', catalog_revision: 'catalog-one', policy_revision: 'policy-one', roles: {} } as EffectiveLlmProfile

describe('volatile provider credential session', () => {
    beforeEach(() => { credentialSession.clear(); authSession.continueSignedOut(); authSession.authenticate('alice', token()); credentialSession.setProject('project-one', authSession.getSnapshot().accountKey) })
    afterEach(() => { credentialSession.clear(); authSession.continueSignedOut() })
    function remember(): void { credentialSession.remember(profile, KEY, credentialSession.ownerScope()) }
    it('materializes only a matching approved target and never writes the key to browser storage', () => {
        remember()
        expect(credentialSession.materialize(profile)).toEqual({ selection: { mode: 'profile', profile_id: profile.profile_id }, expected_revision_id: profile.revision_id, credentials: { api_key: KEY } })
        expect(credentialSession.has({ ...profile, provider_target_key: 'other-target' })).toBe(false)
        expect(credentialSession.materialize.bind(null, { ...profile, provider_target_key: 'other-target' })).toThrow('BYOK_CREDENTIAL_REQUIRED')
        expect(JSON.stringify(localStorage)).not.toContain(KEY)
        expect(JSON.stringify(sessionStorage)).not.toContain(KEY)
        expect(JSON.stringify(credentialSession)).not.toContain(KEY)
    })
    it('keeps an authorized key during token rotation for the same project', () => {
        remember(); authSession.rotateToken(token(), 'alice')
        expect(credentialSession.has(profile)).toBe(true)
    })
    it('forgets the old slot when a feature changes its approved target', () => {
        remember(); credentialSession.select('novel', profile)
        credentialSession.select('novel', { ...profile, provider_target_key: 'replacement-target' })
        expect(credentialSession.has(profile)).toBe(false)
    })
    it.each(['expiry', 'logout', 'account', 'project'] as const)('clears the slot on %s', change => {
        remember()
        if (change === 'expiry') { authSession.expire(); authSession.authenticate('alice', token()) }
        else if (change === 'logout') { authSession.beginLogout(); authSession.authenticate('alice', token()) }
        else if (change === 'account') authSession.authenticate('bob', token())
        else { authSession.rotateToken(token('project-two'), 'alice'); credentialSession.setProject('project-two', authSession.getSnapshot().accountKey) }
        expect(credentialSession.has(profile)).toBe(false)
    })
    it('invalidates a slot after another tab changes authentication storage', () => {
        remember(); window.dispatchEvent(new StorageEvent('storage', { key: 'magic_worlds:token', newValue: 'other-session' }))
        expect(credentialSession.has(profile)).toBe(false)
    })
    it('rejects stale owner confirmation and platform credential attachment', () => {
        const owner = credentialSession.ownerScope(); authSession.authenticate('bob', token())
        expect(() => credentialSession.remember(profile, KEY, owner)).toThrow('LLM_SESSION_CHANGED')
        credentialSession.setProject('project-one', authSession.getSnapshot().accountKey)
        expect(() => credentialSession.remember({ ...profile, profile_scope: 'system', credential_mode: 'platform', platform_connection_key: 'connection' }, KEY, credentialSession.ownerScope())).toThrow('LLM_PERSONAL_CREDENTIAL_FORBIDDEN')
    })
    it('clears a rejected key while preserving a replacement from a later request', () => {
        remember(); credentialSession.select('novel', profile)
        const rejectOld = credentialSession.rejectionHandler('novel')
        credentialSession.remember(profile, 'FAKE_REPLACEMENT_KEY', credentialSession.ownerScope())
        rejectOld()
        expect(credentialSession.materialize(profile).credentials?.api_key).toBe('FAKE_REPLACEMENT_KEY')
        credentialSession.rejectionHandler('novel')()
        expect(() => credentialSession.materialize(profile)).toThrow('BYOK_CREDENTIAL_REQUIRED')
    })
    it('requires re-entry when the same provider target changes its catalog revision', () => {
        remember(); credentialSession.select('novel', profile)
        const changed = { ...profile, catalog_revision: 'catalog-two' }
        credentialSession.select('novel', changed)
        expect(credentialSession.has(profile)).toBe(false)
        expect(() => credentialSession.materialize(changed)).toThrow('BYOK_CREDENTIAL_REQUIRED')
    })

})
