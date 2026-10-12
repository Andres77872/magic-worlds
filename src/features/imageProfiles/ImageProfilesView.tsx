/**
 * Layout of both image profile pages, fed by `useImageProfilesConsole` (or
 * fixtures in Storybook).
 *
 * Root ("Image profiles"): global default → missing platform keys → profiles.
 * User ("Image models"): a link to the root console for root users → default
 * image model → your profiles → app profiles → your provider keys.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, ArrowRight, Crown, ImageIcon, Info, KeyRound, Layers, Loader2, Plus, RefreshCw, Sparkles, Star } from 'lucide-react'
import type { ImageProfile } from '@/shared/types/imageProfile.types'
import { Button, Callout, Card, Icon, IconTile, PageHeader, SectionHeader, Select, Toast } from '@/ui/primitives'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { ImageProfileCard } from './ImageProfileCard'
import { ImageProfileEditor } from './ImageProfileEditor'
import { PLATFORM_KEY_ENV, pickableProfiles } from './imageProfileModel'
import type { ImageProfilesConsole } from './useImageProfilesConsole'

interface ImageProfilesViewProps {
    state: ImageProfilesConsole
    /** User page only: the signed-in user is root, so link to the root console. */
    onManageAppProfiles?: () => void
}

export function ImageProfilesView({ state, onManageAppProfiles }: ImageProfilesViewProps) {
    const { t } = useTranslation()
    const { systemAdmin, loading, busy, catalog, list, editor, actions } = state
    const items = list?.items ?? []
    const order = (profiles: ImageProfile[]) => [...profiles].sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived'))
    const app = order(items.filter(profile => profile.scope === 'system'))
    const personal = order(items.filter(profile => profile.scope === 'user'))
    const systemDefault = list?.system_default_profile_id ?? null
    const userDefault = list?.user_default_profile_id ?? null
    // A personal default that can no longer run is skipped by the server: the app default applies instead.
    const userDefaultApplies = userDefault !== null && userDefault === list?.effective_default_profile_id
    // Only worth saying when an active app profile actually needs the missing key.
    const missingKeys = catalog?.providers.filter(provider => !provider.platform_available
        && app.some(profile => profile.status === 'active' && profile.provider === provider.provider)) ?? []
    const providerName = (provider: string) => t(`imageProfiles.providers.${provider}`)

    const sectionHead = (icon: LucideIcon, title: string, hint: string, right?: ReactNode) => <div className="flex flex-col gap-1">
        <SectionHeader icon={icon} title={title} right={right} />
        <p className="max-w-[72ch] font-ui text-label text-parchment-300">{hint}</p>
    </div>
    const grid = (profiles: ImageProfile[]) => <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">
        {profiles.map(profile => {
            const editable = systemAdmin || profile.scope === 'user'
            const isDefault = systemAdmin ? profile.profile_id === systemDefault : profile.profile_id === list?.effective_default_profile_id
            return <ImageProfileCard key={profile.profile_id} profile={profile} disabled={busy} isDefault={isDefault}
                defaultLabel={t(systemAdmin || !userDefaultApplies ? 'imageProfiles.card.globalDefault' : 'imageProfiles.card.yourDefault')}
                makeDefaultLabel={t(systemAdmin ? 'imageProfiles.card.makeGlobalDefault' : 'imageProfiles.card.useByDefault')}
                onMakeDefault={() => systemAdmin ? actions.setGlobalDefault(profile.profile_id) : actions.setUserDefault(profile.profile_id)}
                onEdit={editable ? () => actions.openEdit(profile) : undefined}
                onArchive={editable ? () => actions.requestArchive(profile) : undefined} />
        })}
    </div>
    const createButton = <Button onClick={actions.openCreate} disabled={loading || busy || !catalog}
        iconLeft={<Icon icon={Plus} size={16} />}>{t('imageProfiles.create')}</Button>

    // Like the cards' "Make global default": an unavailable profile cannot run, so it is listed but not offered.
    const globalChoices = app.filter(profile => profile.status === 'active')
    const userChoices = pickableProfiles(items)
    const systemDefaultName = app.find(profile => profile.profile_id === systemDefault)?.name

    return <div className="relative mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-8 sm:py-10">
        <PageHeader eyebrow={systemAdmin ? t('imageProfiles.rootEyebrow') : undefined} eyebrowTone="arcane" size="lg" divider
            title={t(systemAdmin ? 'imageProfiles.rootTitle' : 'imageProfiles.title')}
            subtitle={t(systemAdmin ? 'imageProfiles.rootSubtitle' : 'imageProfiles.subtitle')}
            icon={<IconTile icon={systemAdmin ? Crown : ImageIcon} tone="arcane" />}
            actions={<>
                <Button variant="secondary" size="sm" disabled={loading || busy} onClick={actions.refresh}
                    iconLeft={<Icon icon={RefreshCw} size={15} className={loading ? 'animate-spin' : undefined} />}>{t('imageProfiles.refresh')}</Button>
                {systemAdmin && <Button variant="secondary" size="sm" disabled={loading || busy} onClick={actions.seedStarter}
                    iconLeft={<Icon icon={Sparkles} size={15} />}>{t('imageProfiles.starter')}</Button>}
                {systemAdmin && createButton}
            </>} />

        {!systemAdmin && onManageAppProfiles && <div className="flex flex-col gap-3 rounded-lg border border-arcane-500/30 bg-arcane-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex min-w-0 items-start gap-2.5 font-ui text-sm text-parchment-200">
                <Icon icon={Crown} size={16} className="mt-0.5 shrink-0 text-arcane-300" />{t('imageProfiles.manageBanner')}
            </p>
            <div className="shrink-0">
                <Button variant="arcane" size="sm" onClick={onManageAppProfiles} iconRight={<Icon icon={ArrowRight} size={15} />}>
                    {t('imageProfiles.manageAction')}</Button>
            </div>
        </div>}

        {state.error && !editor && <Callout tone="danger" role="alert">{state.error}</Callout>}
        {loading && <p role="status" className="flex items-center gap-2 font-ui text-label text-parchment-300">
            <Icon icon={Loader2} size={15} className="animate-spin" />{t('imageProfiles.loading')}</p>}

        {systemAdmin ? <>
            <section className="flex flex-col gap-4">
                {sectionHead(Star, t('imageProfiles.page.globalDefault'), t('imageProfiles.page.globalDefaultHint'))}
                {list && !systemDefault && <Callout tone="warning" role="note" icon={<Icon icon={AlertTriangle} size={16} />}>
                    {t('imageProfiles.page.noDefault')}</Callout>}
                {globalChoices.length > 0 && <div className="max-w-md">
                    <Select value={systemDefault ?? ''} disabled={busy || loading} aria-label={t('imageProfiles.page.globalDefault')}
                        placeholder={t('imageProfiles.page.globalDefault')} options={globalChoices.map(profile => ({ value: profile.profile_id, label: profile.name,
                            disabled: !profile.available,
                            description: `${profile.model_display_name ?? profile.model_id} · ${profile.available
                                ? t('imageProfiles.card.credits', { count: profile.credit_cost }) : t('imageProfiles.card.unavailable')}` }))}
                        onChange={value => { if (value && value !== systemDefault) actions.setGlobalDefault(value) }} />
                </div>}
            </section>
            {missingKeys.map(provider => <Callout key={provider.provider} tone="warning" role="note">
                {t('imageProfiles.page.noPlatformKey', { provider: providerName(provider.provider), env: PLATFORM_KEY_ENV[provider.provider] })}</Callout>)}
            <p className="flex max-w-[80ch] items-start gap-2 font-ui text-label text-parchment-300">
                <Icon icon={Info} size={15} className="mt-0.5 shrink-0 text-arcane-300" />{t('imageProfiles.page.rootHowItWorks')}
            </p>
            <section className="flex flex-col gap-4">
                {sectionHead(Layers, t('imageProfiles.page.profiles'), t('imageProfiles.page.profilesHint'))}
                {app.length > 0 ? grid(app) : !loading && list && <EmptyState icon={<Icon icon={ImageIcon} size={36} />}
                    message={t('imageProfiles.page.noProfiles')} button={{ label: t('imageProfiles.starter'), onClick: actions.seedStarter }} />}
            </section>
        </> : <>
            <section className="flex flex-col gap-4">
                {sectionHead(Star, t('imageProfiles.page.defaultTitle'), t('imageProfiles.page.defaultHint'))}
                <div className="max-w-md">
                    <Select value={userDefaultApplies ? userDefault : ''} disabled={busy || loading || !list} aria-label={t('imageProfiles.page.defaultTitle')}
                        options={[
                            { value: '', label: systemDefaultName ? t('imageProfiles.page.appDefault', { name: systemDefaultName }) : t('imageProfiles.page.appDefaultUnset') },
                            ...userChoices.map(profile => ({ value: profile.profile_id, label: profile.name,
                                description: `${profile.model_display_name ?? profile.model_id} · ${profile.scope === 'user'
                                    ? t('imageProfiles.card.yourKey') : t('imageProfiles.card.credits', { count: profile.credit_cost })}` })),
                        ]}
                        onChange={value => { if (value !== (userDefault ?? '')) actions.setUserDefault(value || null) }} />
                </div>
            </section>
            <section className="flex flex-col gap-4">
                {sectionHead(KeyRound, t('imageProfiles.page.yourProfiles'), t('imageProfiles.page.yourProfilesHint'), createButton)}
                {personal.length > 0 ? grid(personal)
                    : !loading && <p className="font-ui text-body text-parchment-300">{t('imageProfiles.page.noPersonal')}</p>}
            </section>
            <section className="flex flex-col gap-4">
                {sectionHead(ImageIcon, t('imageProfiles.page.appProfiles'), t('imageProfiles.page.appProfilesHint'))}
                {app.length > 0 ? grid(app) : !loading && <p className="font-ui text-body text-parchment-300">{t('imageProfiles.page.noApp')}</p>}
            </section>
            <Card className="flex flex-col gap-3 p-4 sm:p-5">
                <SectionHeader icon={KeyRound} title={t('imageProfiles.byok.title')} />
                <p className="max-w-[72ch] font-ui text-body text-parchment-200">{t('imageProfiles.byok.body')}</p>
                <p className="font-ui text-label text-parchment-300">{state.heldKeys.length > 0
                    ? t('imageProfiles.byok.held', { providers: state.heldKeys.map(providerName).join(', ') })
                    : t('imageProfiles.byok.none')}</p>
                <div>
                    <Button variant="secondary" size="sm" disabled={state.heldKeys.length === 0} onClick={actions.forgetKeys}>
                        {t('imageProfiles.byok.forget')}</Button>
                </div>
            </Card>
        </>}

        {editor && <ImageProfileEditor open mode={editor.mode} systemAdmin={systemAdmin} catalog={catalog} draft={editor.draft}
            propsKey={editor.propsKey} propsValid={editor.propsValid} busy={busy} error={state.error}
            onChange={actions.updateDraft} onChooseModel={actions.chooseModel} onPropsValidity={actions.setPropsValid}
            onSave={actions.save} onClose={actions.closeEditor}
            onArchive={editor.profile && !(systemAdmin && editor.profile.profile_id === systemDefault)
                ? () => actions.requestArchive(editor.profile!) : undefined} />}

        <ConfirmDialog visible={state.confirm !== null} isProcessing={busy} variant="danger"
            title={t('imageProfiles.confirmArchiveTitle')} confirmLabel={t('imageProfiles.archive')} cancelLabel={t('imageProfiles.cancel')}
            message={t('imageProfiles.confirmArchive', { name: state.confirm?.name ?? '' })}
            onCancel={actions.cancelArchive} onConfirm={actions.confirmArchive} />

        {state.notice && <Toast open tone="success" title={state.notice} onClose={actions.clearNotice} autoCloseMs={4000} />}
    </div>
}
