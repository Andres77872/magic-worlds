/**
 * Image model choice next to a portrait generator: active, available profiles
 * (the caller's default first-labelled), what one image costs, and whether the
 * user's own key is set for a personal profile. A failed load offers a retry.
 */
import { useTranslation } from 'react-i18next'
import type { ImageProfile } from '@/shared/types/imageProfile.types'
import { Field, Select } from '@/ui/primitives'

export interface ImageProfilePickerProps {
    profiles: ImageProfile[]
    selected?: ImageProfile
    defaultId: string | null
    loaded: boolean
    failed: boolean
    keyHeld: boolean
    disabled?: boolean
    onSelect: (profileId: string) => void
    onForgetKey: () => void
    onRetry?: () => void
}

export function ImageProfilePicker({ profiles, selected, defaultId, loaded, failed, keyHeld, disabled = false, onSelect, onForgetKey, onRetry }: ImageProfilePickerProps) {
    const { t } = useTranslation()
    if (failed) return <p className="flex flex-wrap items-center gap-x-2 font-ui text-caption text-parchment-400">
        <span>{t('imageProfiles.picker.loadFailed')}</span>
        {onRetry && <button type="button" disabled={disabled} onClick={onRetry}
            className="text-arcane-300 underline-offset-2 hover:underline disabled:opacity-50">{t('imageProfiles.picker.retry')}</button>}
    </p>
    if (!loaded) return null
    if (profiles.length === 0) return <p className="font-ui text-caption text-parchment-400">{t('imageProfiles.picker.none')}</p>

    const price = (profile: ImageProfile) => profile.credential_mode === 'user_byok'
        ? t('imageProfiles.picker.yourKey') : t('imageProfiles.picker.credits', { count: profile.credit_cost })
    const providerName = selected ? t(`imageProfiles.providers.${selected.provider}`) : ''

    return <div className="flex flex-col gap-1.5">
        <Field label={t('imageProfiles.picker.label')}>
            <Select size="sm" value={selected?.profile_id ?? ''} disabled={disabled} onChange={onSelect}
                options={profiles.map(profile => ({
                    value: profile.profile_id,
                    label: profile.profile_id === defaultId ? t('imageProfiles.picker.defaultSuffix', { name: profile.name }) : profile.name,
                    textValue: profile.name,
                    description: `${profile.model_display_name ?? profile.model_id} · ${price(profile)}`,
                }))} />
        </Field>
        {selected?.credential_mode === 'user_byok' && <p className="flex flex-wrap items-center gap-x-2 font-ui text-caption text-parchment-300">
            <span>{t(keyHeld ? 'imageProfiles.picker.keyHeld' : 'imageProfiles.picker.keyNeeded', { provider: providerName })}</span>
            {keyHeld && <button type="button" disabled={disabled} onClick={onForgetKey}
                className="text-arcane-300 underline-offset-2 hover:underline disabled:opacity-50">{t('imageProfiles.picker.forgetKey')}</button>}
        </p>}
    </div>
}
