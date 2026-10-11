/**
 * One LLM profile at a glance: name, response model and provider, status
 * (draft / published version), custom provider props and where it is used.
 * Arcane marks app profiles (platform key), ember marks personal ones (the
 * player's own key); the card body stays neutral.
 */
import { useTranslation } from 'react-i18next'
import { Bot, Eye, KeyRound, Pencil, Star } from 'lucide-react'
import type { LlmCatalogModel, LlmProfileDetail, LlmProfileSummary, LlmRole } from '@/shared/types/llmProfile.types'
import { Badge, Button, Card, Icon, IconTile, cx } from '@/ui/primitives'
import { configKey, helperRolesOf, providerOptionCount, type ProfileUsage } from './llmProfileModel'

interface ProfileCardProps {
    profile: LlmProfileSummary
    /** Loaded detail; `undefined` while loading, `null` when it could not be loaded. */
    detail: LlmProfileDetail | null | undefined
    models: LlmCatalogModel[]
    usage: ProfileUsage
    /** Root console: shows the draft state and how many user choices point here. */
    systemAdmin?: boolean
    disabled?: boolean
    /** Root: this profile is the app default for everyone. */
    isAppDefault?: boolean
    /** Root: offered on published profiles that are not the default yet. */
    onSetDefault?: () => void
    onOpen: () => void
}

export function ProfileCard({ profile, detail, models, usage, systemAdmin = false, disabled = false, isAppDefault = false, onSetDefault, onOpen }: ProfileCardProps) {
    const { t } = useTranslation()
    const personal = profile.scope === 'user'
    const editable = systemAdmin || personal
    const config = detail ? detail.current?.config ?? detail.draft_config : undefined
    const primary = config?.roles.primary
    const model = primary && models.find(item => item.catalog_model_key === primary.catalog_model_key)
    const helpers = config ? helperRolesOf(Object.keys(config.roles) as LlmRole[]) : []
    const props = providerOptionCount(config)
    const version = detail?.current?.revision_number
    const unpublished = systemAdmin && detail?.current && detail.draft_config && configKey(detail.draft_config) !== configKey(detail.current.config)
    const userChoices = systemAdmin && detail?.impact ? detail.impact.user_defaults + detail.impact.user_features : 0
    const used = [...(usage.isDefault ? [t('llmProfiles.card.defaultUse')] : []), ...usage.features.map(feature => t(`llmProfiles.features.${feature}`))]

    return <Card className={cx('flex min-w-0 flex-col gap-4 p-5', profile.status === 'archived' && 'opacity-70')}>
        <div className="flex min-w-0 items-start gap-3">
            <IconTile icon={personal ? KeyRound : Bot} tone={personal ? 'ember' : 'arcane'} size="sm" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h3 className="break-words font-display text-h3 font-semibold leading-tight text-parchment-50">{profile.name}</h3>
                <p className="font-ui text-caption text-parchment-300">
                    {t(`llmProfiles.scope.${profile.scope}`)} · {t(personal ? 'llmProfiles.card.yourKey' : 'llmProfiles.card.platformKey')}
                </p>
            </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
            {isAppDefault && <Badge tone="ember" icon={<Icon icon={Star} size={12} />}>{t('llmProfiles.card.defaultForEveryone')}</Badge>}
            {profile.status === 'archived' ? <Badge tone="neutral">{t('llmProfiles.status.archived')}</Badge>
                : profile.status === 'draft' ? <Badge tone="warning">{t('llmProfiles.status.draft')}</Badge>
                    : <Badge tone="live">{version ? t('llmProfiles.card.publishedVersion', { n: version }) : t('llmProfiles.card.published')}</Badge>}
            {unpublished && <Badge tone="warning">{t('llmProfiles.card.unpublishedChanges')}</Badge>}
            {props > 0 && <Badge tone="neutral">{t('llmProfiles.card.customProps', { n: props })}</Badge>}
        </div>

        <dl className="flex flex-col gap-2 font-ui text-label">
            <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-caption text-parchment-400">{t('llmProfiles.roles.primary')}</dt>
                <dd className="min-w-0 text-parchment-100">
                    {detail === undefined ? <span className="text-parchment-400">{t('llmProfiles.card.loadingModel')}</span>
                        : primary ? <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                            <span className="break-words font-semibold">{model?.display_name ?? primary.catalog_model_key}</span>
                            <span className="break-all font-mono text-meta text-parchment-400">{config?.provider_target_key}</span>
                        </span> : <span className="text-parchment-400">—</span>}
                </dd>
                {helpers.length > 0 && <dd className="text-caption text-parchment-300">
                    {t('llmProfiles.card.separateModels', { roles: helpers.map(role => t(`llmProfiles.roles.${role}`)).join(', ') })}
                </dd>}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-caption text-parchment-400">{t(systemAdmin ? 'llmProfiles.card.usedFor' : 'llmProfiles.card.youUseFor')}</dt>
                <dd className={cx('break-words', used.length ? 'text-parchment-100' : 'text-parchment-400')}>
                    {used.length ? used.join(' · ') : t(systemAdmin ? 'llmProfiles.card.notAssigned' : 'llmProfiles.card.notChosen')}
                </dd>
                {userChoices > 0 && <dd className="text-caption text-parchment-300">{t('llmProfiles.card.userChoices', { n: userChoices })}</dd>}
            </div>
        </dl>

        {profile.description && <p className="line-clamp-3 font-ui text-body text-parchment-200">{profile.description}</p>}

        <div className="mt-auto flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={disabled} onClick={onOpen}
                iconLeft={<Icon icon={editable ? Pencil : Eye} size={14} />}>
                {t(editable ? 'llmProfiles.edit' : 'llmProfiles.view')}
            </Button>
            {onSetDefault && !isAppDefault && profile.status === 'active' && <Button variant="ghost" size="sm" disabled={disabled} onClick={onSetDefault}
                iconLeft={<Icon icon={Star} size={14} />}>{t('llmProfiles.card.setDefault')}</Button>}
        </div>
    </Card>
}
