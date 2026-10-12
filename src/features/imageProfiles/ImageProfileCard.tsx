/**
 * One image profile at a glance: name, model and provider, price (credits, or
 * "your key" for a personal profile), default and availability badges.
 * Arcane marks app profiles (platform key), ember marks personal ones.
 */
import { useTranslation } from 'react-i18next'
import { Archive, ImageIcon, KeyRound, Pencil, Star } from 'lucide-react'
import type { ImageProfile } from '@/shared/types/imageProfile.types'
import { Badge, Button, Card, Icon, IconTile, cx } from '@/ui/primitives'

interface ImageProfileCardProps {
    profile: ImageProfile
    /** The global default (root page) or the user's own default (user page). */
    isDefault?: boolean
    defaultLabel?: string
    /** Offered on active, available profiles that are not the default yet. */
    onMakeDefault?: () => void
    makeDefaultLabel?: string
    onEdit?: () => void
    onArchive?: () => void
    disabled?: boolean
}

export function ImageProfileCard({ profile, isDefault = false, defaultLabel, onMakeDefault, makeDefaultLabel, onEdit, onArchive, disabled = false }: ImageProfileCardProps) {
    const { t } = useTranslation()
    const personal = profile.scope === 'user'
    const active = profile.status === 'active'
    const tuned = Object.keys(profile.settings).length
    const custom = Object.keys(profile.provider_options).length
    const modelName = profile.model_display_name ?? profile.model_id

    return <Card className={cx('flex min-w-0 flex-col gap-4 p-5', !active && 'opacity-70')}>
        <div className="flex min-w-0 items-start gap-3">
            <IconTile icon={personal ? KeyRound : ImageIcon} tone={personal ? 'ember' : 'arcane'} size="sm" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h3 className="break-words font-display text-h3 font-semibold leading-tight text-parchment-50">{profile.name}</h3>
                <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 font-ui text-caption text-parchment-300">
                    {modelName !== profile.name && <span>{modelName}</span>}
                    <span className="text-parchment-400">{t(`imageProfiles.providers.${profile.provider}`)}</span>
                </p>
            </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
            {isDefault && <Badge tone="ember" icon={<Icon icon={Star} size={12} />}>{defaultLabel}</Badge>}
            {!active ? <Badge tone="neutral">{t('imageProfiles.card.archived')}</Badge>
                : !profile.available && <Badge tone="warning">{t('imageProfiles.card.unavailable')}</Badge>}
            {personal ? <Badge tone="ember">{t('imageProfiles.card.yourKey')}</Badge>
                : <Badge tone="arcane">{t('imageProfiles.card.credits', { count: profile.credit_cost })}</Badge>}
            {tuned > 0 && <Badge tone="neutral">{t('imageProfiles.card.tunedSettings', { count: tuned })}</Badge>}
            {custom > 0 && <Badge tone="neutral">{t('imageProfiles.card.customFields', { count: custom })}</Badge>}
        </div>

        {active && !profile.available && <p className="font-ui text-caption text-parchment-300">{t('imageProfiles.card.unavailableHint')}</p>}
        {profile.description && <p className="line-clamp-3 font-ui text-body text-parchment-200">{profile.description}</p>}
        <p className="break-all font-mono text-meta text-parchment-400">{profile.model_id}</p>

        {(onEdit || onArchive || onMakeDefault) && <div className="mt-auto flex flex-wrap gap-2">
            {onEdit && active && <Button variant="secondary" size="sm" disabled={disabled} onClick={onEdit}
                iconLeft={<Icon icon={Pencil} size={14} />}>{t('imageProfiles.edit')}</Button>}
            {onMakeDefault && active && profile.available && !isDefault && <Button variant="ghost" size="sm" disabled={disabled}
                onClick={onMakeDefault} iconLeft={<Icon icon={Star} size={14} />}>{makeDefaultLabel}</Button>}
            {onArchive && active && <Button variant="danger-ghost" size="sm" disabled={disabled || (isDefault && !personal)} onClick={onArchive}
                iconLeft={<Icon icon={Archive} size={14} />}>{t('imageProfiles.archive')}</Button>}
        </div>}
    </Card>
}
