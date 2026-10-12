/**
 * The image profile a portrait generation runs on: the caller's effective
 * default until they pick another one. A personal (BYOK) profile needs the
 * user's provider key; when none is held for this tab, `request` asks for it
 * first and runs once the key is entered.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import type { ImageProfile, ImageProfileList, ImageProvider } from '@/shared/types/imageProfile.types'
import { imageCredentialSession } from './imageCredentialSession'
import { pickableProfiles } from './imageProfileModel'
import { useHeldImageKeys } from './useHeldImageKeys'

export interface ImageGenerationSelection {
    image_profile_id?: string
    credentials?: { api_key: string }
}

/** `byokProvider` is set when the request carries the user's own key. */
type GenerationRun = (selection: ImageGenerationSelection, byokProvider?: ImageProvider) => void

interface PendingKey {
    provider: ImageProvider
    run: GenerationRun
    profileId: string
}

function defaultProfile(list: ImageProfileList): ImageProfile | undefined {
    return pickableProfiles(list.items).find(profile => profile.profile_id === list.effective_default_profile_id)
}

export function useImageGenerationProfile(enabled: boolean) {
    const [list, setList] = useState<ImageProfileList | null>(null)
    const [failed, setFailed] = useState(false)
    const [chosen, setChosen] = useState<string | null>(null)
    const [pending, setPending] = useState<PendingKey | null>(null)
    // A generation waiting for the list to load before it runs.
    const [preparing, setPreparing] = useState(false)
    const heldKeys = useHeldImageKeys()
    // Bumped when the hook is disabled or unmounted, so a late answer is dropped.
    const generation = useRef(0)
    const inflight = useRef<Promise<ImageProfileList | null> | null>(null)

    /** Loads the list (joining a load already under way); resolves null when it fails. */
    const load = useCallback((): Promise<ImageProfileList | null> => {
        if (inflight.current) return inflight.current
        const current = generation.current
        const loading = apiService.getImageProfiles().then(
            next => {
                if (current !== generation.current) return null
                setList(next)
                setFailed(false)
                return next
            },
            () => {
                if (current === generation.current) setFailed(true)
                return null
            },
        ).finally(() => { if (inflight.current === loading) inflight.current = null })
        inflight.current = loading
        return loading
    }, [])

    useEffect(() => {
        if (!enabled) return
        void load()
        return () => { generation.current += 1; inflight.current = null }
    }, [enabled, load])

    const profiles = pickableProfiles(list?.items ?? [])
    const defaultId = list?.effective_default_profile_id ?? null
    const selectedId = chosen && profiles.some(profile => profile.profile_id === chosen) ? chosen : defaultId
    const selected: ImageProfile | undefined = profiles.find(profile => profile.profile_id === selectedId)

    /** Runs on `profile`, asking for the user's key first for a personal one; without one the server resolves the default. */
    const runOn = useCallback((profile: ImageProfile | undefined, run: GenerationRun) => {
        if (!profile) { run({}); return }
        if (profile.credential_mode !== 'user_byok') { run({ image_profile_id: profile.profile_id }); return }
        const credentials = imageCredentialSession.credentials(profile.provider)
        if (credentials) run({ image_profile_id: profile.profile_id, credentials }, profile.provider)
        else setPending({ provider: profile.provider, run, profileId: profile.profile_id })
    }, [])

    /** Runs `run` with the request fields for the selected profile, asking for a key first when needed. */
    const request = useCallback((run: GenerationRun) => {
        if (list) { runOn(selected, run); return }
        // Still loading or failed: load first, so a personal default asks for its key.
        const current = generation.current
        setPreparing(true)
        void load().then(next => {
            setPreparing(false)
            // Dropped when the hook was disabled or unmounted meanwhile.
            if (current === generation.current) runOn(next ? defaultProfile(next) : undefined, run)
        })
    }, [list, selected, load, runOn])

    /**
     * Recovers from a generation error about the profile itself. An archived or
     * deleted profile reloads the list and falls back to the default; a missing
     * key (the server ran a personal default the list did not know about)
     * reloads and asks for that profile's key.
     */
    const recover = useCallback((code: string | null | undefined, run: GenerationRun) => {
        const upper = code?.toUpperCase()
        if (upper === 'IMAGE_PROFILE_UNAVAILABLE' || upper === 'IMAGE_PROFILE_NOT_FOUND') {
            setChosen(null)
            void load()
        } else if (upper === 'PROVIDER_CREDENTIALS_MISSING') {
            void load().then(next => {
                const profile = next ? defaultProfile(next) : undefined
                if (profile?.credential_mode === 'user_byok') runOn(profile, run)
            })
        }
    }, [load, runOn])

    /** Stores the entered key and continues the waiting generation. Throws the session error codes. */
    const submitKey = useCallback((key: string) => {
        if (!pending) return
        imageCredentialSession.remember(pending.provider, key)
        const credentials = imageCredentialSession.credentials(pending.provider)
        setPending(null)
        pending.run({ image_profile_id: pending.profileId, credentials }, pending.provider)
    }, [pending])

    return {
        profiles,
        selected,
        defaultId,
        loaded: list !== null,
        failed,
        preparing,
        keyHeld: selected ? heldKeys.includes(selected.provider) : false,
        keyPrompt: pending?.provider ?? null,
        select: setChosen,
        request,
        recover,
        reload: () => { void load() },
        submitKey,
        cancelKey: () => setPending(null),
        forgetKey: (provider: ImageProvider) => imageCredentialSession.forget(provider),
        forgetSelectedKey: () => { if (selected) imageCredentialSession.forget(selected.provider) },
    }
}
