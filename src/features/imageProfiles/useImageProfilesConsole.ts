/**
 * State and API calls behind both image profile pages: the user's "Image
 * models" (pick a default, keep personal BYOK profiles) and root's "Image
 * profiles" (system profiles, prices, the global default).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/hooks'
import { ApiError, apiService } from '@/infrastructure/api'
import type {
    ImageCatalog,
    ImageCatalogModel,
    ImageProfile,
    ImageProfileList,
    ImageProfileMutation,
    ImageProvider,
} from '@/shared/types/imageProfile.types'
import { imageProfilesEn } from '@/app/i18n/locales/imageProfiles'
import { formatProviderOptions } from '@/features/llmProfiles/llmProfileModel'
import { imageCredentialSession } from './imageCredentialSession'
import { draftFrom, emptyDraft, imageOptionsParser, trimmedDraft, withModel } from './imageProfileModel'
import { useHeldImageKeys } from './useHeldImageKeys'

const KNOWN_ERRORS = new Set(Object.keys(imageProfilesEn.errors))

export interface ImageProfileEditorState {
    mode: 'create' | 'edit'
    profile: ImageProfile | null
    draft: ImageProfileMutation
    /** Remounts the custom-field editor when another profile is loaded. */
    propsKey: number
    propsValid: boolean
}

export interface ImageProfilesConsole {
    systemAdmin: boolean
    loading: boolean
    busy: boolean
    error: string | null
    notice: string | null
    catalog: ImageCatalog | null
    list: ImageProfileList | null
    editor: ImageProfileEditorState | null
    confirm: ImageProfile | null
    /** Providers with a key entered in this tab. */
    heldKeys: ImageProvider[]
    actions: {
        refresh: () => void
        openCreate: () => void
        openEdit: (profile: ImageProfile) => void
        closeEditor: () => void
        updateDraft: (patch: Partial<ImageProfileMutation>) => void
        chooseModel: (model: ImageCatalogModel) => void
        setPropsValid: (valid: boolean) => void
        save: () => void
        requestArchive: (profile: ImageProfile) => void
        cancelArchive: () => void
        confirmArchive: () => void
        setUserDefault: (profileId: string | null) => void
        setGlobalDefault: (profileId: string) => void
        seedStarter: () => void
        forgetKeys: () => void
        clearNotice: () => void
    }
}

export function useImageProfilesConsole(systemAdmin: boolean): ImageProfilesConsole & { authorized: boolean } {
    const { t } = useTranslation()
    const { isAuthenticated, user } = useAuth()
    const authorized = isAuthenticated && (!systemAdmin || user?.user_type === 'root')
    const [loading, setLoading] = useState(authorized)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [catalog, setCatalog] = useState<ImageCatalog | null>(null)
    const [list, setList] = useState<ImageProfileList | null>(null)
    const [editor, setEditor] = useState<ImageProfileEditorState | null>(null)
    const [confirm, setConfirm] = useState<ImageProfile | null>(null)
    const propsKey = useRef(0)
    const heldKeys = useHeldImageKeys()

    const errorText = useCallback((failure: unknown) => {
        if (!(failure instanceof ApiError) || !failure.code) return t('imageProfiles.failed')
        if (!KNOWN_ERRORS.has(failure.code)) return `${t('imageProfiles.failed')} (${failure.code})`
        const text = t(`imageProfiles.errors.${failure.code}`)
        // The server names the offending setting; its message is safe to show.
        return failure.code === 'IMAGE_PROFILE_SETTINGS_INVALID' && failure.message !== failure.code ? `${text} ${failure.message}` : text
    }, [t])

    const load = useCallback((isLive: () => boolean = () => true) => Promise.all([
        apiService.getImageCatalog(),
        systemAdmin ? apiService.getSystemImageProfiles() : apiService.getImageProfiles(),
    ]).then(
        ([nextCatalog, nextList]) => { if (isLive()) { setCatalog(nextCatalog); setList(nextList); setError(null) } },
        failure => { if (isLive()) setError(errorText(failure)) },
    ).finally(() => { if (isLive()) setLoading(false) }), [systemAdmin, errorText])

    useEffect(() => {
        if (!authorized) return
        let live = true
        void load(() => live)
        return () => { live = false }
    }, [authorized, load])

    const run = useCallback(async (work: () => Promise<void>, success?: string) => {
        setBusy(true)
        setError(null)
        try {
            await work()
            if (success) setNotice(success)
        } catch (failure) {
            setError(errorText(failure))
        } finally {
            setBusy(false)
        }
    }, [errorText])

    const openCreate = useCallback(() => {
        propsKey.current += 1
        setError(null)
        setEditor({ mode: 'create', profile: null, draft: emptyDraft(catalog, systemAdmin), propsKey: propsKey.current, propsValid: true })
    }, [catalog, systemAdmin])

    const openEdit = useCallback((profile: ImageProfile) => {
        propsKey.current += 1
        setError(null)
        setEditor({ mode: 'edit', profile, draft: draftFrom(profile, systemAdmin), propsKey: propsKey.current, propsValid: true })
    }, [systemAdmin])

    const save = useCallback(() => {
        if (!editor || !editor.propsValid) return
        const system = systemAdmin
        const draft = trimmedDraft(editor.draft)
        void run(async () => {
            const saved = editor.mode === 'create' || !editor.profile
                ? await apiService.createImageProfile(draft, system)
                : await apiService.updateImageProfile(editor.profile.profile_id, draft, editor.profile.row_version, system)
            setEditor(null)
            setList(current => current && {
                ...current,
                items: current.items.some(item => item.profile_id === saved.profile_id)
                    ? current.items.map(item => item.profile_id === saved.profile_id ? saved : item)
                    : [...current.items, saved],
            })
        }, t('imageProfiles.saved'))
    }, [editor, systemAdmin, run, t])

    const confirmArchive = useCallback(() => {
        const profile = confirm
        if (!profile) return
        void run(async () => {
            await apiService.archiveImageProfile(profile.profile_id, profile.row_version, profile.scope === 'system')
            setConfirm(null)
            setEditor(null)
            // Archiving drops a personal default that pointed at it; reload the defaults.
            setList(systemAdmin ? await apiService.getSystemImageProfiles() : await apiService.getImageProfiles())
        }, t('imageProfiles.archivedNotice'))
    }, [confirm, run, systemAdmin, t])

    return {
        authorized, systemAdmin, loading, busy, error, notice, catalog, list, editor, confirm, heldKeys,
        actions: {
            refresh: () => { setLoading(true); setError(null); void load() },
            openCreate,
            openEdit,
            closeEditor: () => { setEditor(null); setError(null) },
            updateDraft: patch => setEditor(current => current && { ...current, draft: { ...current.draft, ...patch } }),
            chooseModel: model => setEditor(current => {
                if (!current) return current
                const previous = catalog?.models.find(item => item.provider === current.draft.provider && item.model_id === current.draft.model_id)
                propsKey.current += 1
                const draft = withModel(current.draft, model, previous?.display_name)
                // Custom fields carry over; one may now shadow a setting of the new model.
                const propsValid = imageOptionsParser(model)(formatProviderOptions(draft.provider_options)).ok
                return { ...current, draft, propsKey: propsKey.current, propsValid }
            }),
            setPropsValid: valid => setEditor(current => current && { ...current, propsValid: valid }),
            save,
            requestArchive: profile => setConfirm(profile),
            cancelArchive: () => setConfirm(null),
            confirmArchive,
            setUserDefault: profileId => void run(async () => { setList(await apiService.setImagePreference(profileId)) }, t('imageProfiles.defaultSaved')),
            setGlobalDefault: profileId => void run(async () => { setList(await apiService.setGlobalImageDefault(profileId)) }, t('imageProfiles.defaultSaved')),
            seedStarter: () => void run(async () => { setList(await apiService.seedStarterImageProfiles()) }, t('imageProfiles.starterDone')),
            forgetKeys: () => imageCredentialSession.forget(),
            clearNotice: () => setNotice(null),
        },
    }
}
