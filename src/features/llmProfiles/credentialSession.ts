import { authSession } from '@/infrastructure/api/authSession'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { assertLlmCredentialTransport } from '@/infrastructure/api/llmCredentialTransport'
import type { EffectiveLlmProfile } from '@/shared/types/llmProfile.types'
import type { LlmRequest } from '@/shared/types/llm.types'
import type { LlmFeature } from '@/shared/types/llm.types'

const credentials = new Map<string, { key: string; generation: number }>()
let credentialGeneration = 0
const activeTargets = new Map<LlmFeature, { owner: string; target: string; revision: string }>()
let projectContext: { account: string; project: string } | null = null
const listeners = new Set<() => void>()
let version = 0
function changed(): void { version++; for (const listener of listeners) listener() }
function clearCredentials(): void {
    const hadKeys = credentials.size > 0
    credentials.clear(); activeTargets.clear()
    if (hadKeys) changed()
}

function ownerScope(): string {
    const owner = authSession.getSnapshot()
    if (owner.sessionPhase !== 'authenticated' || !owner.userHash || !owner.token) {
        throw new Error('LLM_SESSION_UNAVAILABLE')
    }
    if (!projectContext || projectContext.account !== owner.accountKey) {
        throw new Error('LLM_SESSION_SCOPE_UNAVAILABLE')
    }
    return JSON.stringify([owner.accountKey, owner.userHash, API_BASE_URL, projectContext.project])
}

function slot(profile: EffectiveLlmProfile): string {
    if (profile.credential_mode !== 'user_byok' || profile.profile_scope !== 'user' || profile.platform_connection_key !== null) {
        throw new Error('LLM_PERSONAL_CREDENTIAL_FORBIDDEN')
    }
    if (profile.project_hash !== projectContext?.project) throw new Error('LLM_SESSION_CHANGED')
    return JSON.stringify([ownerScope(), profile.provider_target_key, profile.catalog_revision])
}

let rememberedOwner: string | null = null
function synchronize(): void {
    let owner: string | null = null
    try { owner = ownerScope() } catch { /* Signed out or no project claim. */ }
    if (owner !== rememberedOwner) clearCredentials()
    rememberedOwner = owner
}
authSession.subscribe(synchronize)
if (typeof window !== 'undefined') {
    window.addEventListener('storage', event => {
        if (event.key === null || event.key === 'magic_worlds:token' || event.key === 'magic_worlds:user') clearCredentials()
    })
}

export const credentialSession = {
    subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener) } },
    getVersion(): number { return version },
    ownerScope,
    setProject(project: string, expectedAccount: string): void {
        const owner = authSession.getSnapshot()
        if (owner.sessionPhase !== 'authenticated' || owner.accountKey !== expectedAccount) throw new Error('LLM_SESSION_CHANGED')
        if (!/^[A-Za-z0-9_.:@/-]{1,128}$/.test(project)) throw new Error('LLM_SESSION_SCOPE_UNAVAILABLE')
        if (!projectContext || projectContext.account !== expectedAccount || projectContext.project !== project) clearCredentials()
        projectContext = { account: expectedAccount, project }
        synchronize()
    },
    clear: clearCredentials,
    select(feature: LlmFeature, profile: EffectiveLlmProfile): void {
        synchronize()
        const previous = activeTargets.get(feature)
        if (previous && (profile.credential_mode !== 'user_byok' || previous.target !== profile.provider_target_key || previous.revision !== profile.catalog_revision)) {
            if (credentials.delete(JSON.stringify([previous.owner, previous.target, previous.revision]))) changed()
            activeTargets.delete(feature)
        }
        if (profile.credential_mode === 'user_byok') activeTargets.set(feature, { owner: ownerScope(), target: profile.provider_target_key, revision: profile.catalog_revision })
    },
    forget(profile: EffectiveLlmProfile): void { synchronize(); if (credentials.delete(slot(profile))) changed() },
    rejectionHandler(feature: LlmFeature): () => void {
        synchronize()
        const target = activeTargets.get(feature)
        const key = target ? JSON.stringify([target.owner, target.target, target.revision]) : undefined
        const generation = key ? credentials.get(key)?.generation : undefined
        // A late rejection must not erase a replacement key or another owner.
        // This callback retains only a slot and generation, never the secret.
        return () => {
            if (key && generation !== undefined && credentials.get(key)?.generation === generation) {
                credentials.delete(key)
                changed()
            }
        }
    },
    has(profile: EffectiveLlmProfile): boolean { synchronize(); try { return credentials.has(slot(profile)) } catch { return false } },
    remember(profile: EffectiveLlmProfile, key: string, expectedOwner: string): void {
        if (profile.credential_mode !== 'user_byok' || profile.profile_scope !== 'user' || profile.platform_connection_key !== null) throw new Error('LLM_PERSONAL_CREDENTIAL_FORBIDDEN')
        synchronize()
        let owner: string
        try { owner = ownerScope() } catch { throw new Error('LLM_SESSION_CHANGED') }
        if (owner !== expectedOwner) throw new Error('LLM_SESSION_CHANGED')
        assertLlmCredentialTransport()
        if (!key || key.length > 4096 || key !== key.trim() || /[\x00-\x1f\x7f]/.test(key)) throw new Error('LLM_CREDENTIAL_INVALID')
        credentials.set(slot(profile), { key, generation: ++credentialGeneration })
        changed()
    },
    materialize(profile: EffectiveLlmProfile): LlmRequest {
        synchronize()
        const selection = { mode: 'profile' as const, profile_id: profile.profile_id }
        if (profile.credential_mode === 'platform') return { selection, expected_revision_id: profile.revision_id }
        assertLlmCredentialTransport()
        const key = credentials.get(slot(profile))?.key
        if (!key) throw new Error('BYOK_CREDENTIAL_REQUIRED')
        return { selection, expected_revision_id: profile.revision_id, credentials: { api_key: key } }
    },
}
