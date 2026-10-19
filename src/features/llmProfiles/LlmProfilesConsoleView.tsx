import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * Layout of both LLM profile pages, fed by `useLlmProfilesConsole` (or fixtures
 * in Storybook).
 *
 * Root ("LLM profiles"): Profiles → Which profile each feature uses → Catalog
 * and activity (collapsed). User ("Models and profiles"): a link to the root
 * console for root users → Your profiles → App profiles → Which profile each
 * feature uses → Your provider key → Request usage.
 */
import { isLlmFeatureEnabled } from '@/shared/featureFlags'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, ArrowRight, Bot, Crown, Info, KeyRound, Layers, Loader2, Plus, RefreshCw, Star } from 'lucide-react'
import type { LlmProfileSummary } from '@/shared/types/llmProfile.types'
import { Button, Callout, Field, Icon, IconTile, PageHeader, SectionHeader, Select, Toast } from '@/ui/primitives'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { AssignmentsTable } from './AssignmentsTable'
import { ByokKeyPanel } from './ByokKeyPanel'
import { CatalogActivity } from './CatalogActivity'
import { LlmCapacityUsageView } from './LlmCapacityUsageView'
import { ProfileCard } from './ProfileCard'
import { ProfileEditor } from './ProfileEditor'
import { profileUsage } from './llmProfileModel'
import type { LlmProfilesConsole } from './useLlmProfilesConsole'

interface LlmProfilesConsoleViewProps {
    state: LlmProfilesConsole
    /** User page only: the signed-in user is root, so link to the app-profile console. */
    onManageAppProfiles?: () => void
}

export function LlmProfilesConsoleView({ state, onManageAppProfiles }: LlmProfilesConsoleViewProps) {
    useFeatureFlags()
    const { t } = useTranslation()
    const { systemAdmin, loading, busy, profiles, details, models, preferences, assignments, editor, actions } = state
    const order = (items: LlmProfileSummary[]) => [...items].sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived'))
    const personal = order(profiles.filter(profile => profile.scope === 'user'))
    const app = order(profiles.filter(profile => profile.scope === 'system'))
    const choices = profiles.filter(profile => profile.status === 'active')
    const noModels = !loading && !state.hasUsableModels
    const noModelsMessage = noModels ? t(systemAdmin ? 'llmProfiles.page.rootNoModels' : 'llmProfiles.page.noModels') : undefined
    const createDisabled = loading || busy || systemAdmin && noModels
    const appDefault = systemAdmin ? preferences?.default_profile_id ?? null : null
    const [defaultChoice, setDefaultChoice] = useState('')
    const noDefaultId = useId()

    const card = (profile: LlmProfileSummary) => <ProfileCard key={profile.profile_id} profile={profile} systemAdmin={systemAdmin}
        detail={details[profile.profile_id]} models={models} usage={profileUsage(profile.profile_id, preferences)}
        disabled={busy} onOpen={() => actions.open(profile)} isAppDefault={appDefault === profile.profile_id}
        onSetDefault={systemAdmin ? () => actions.setAppDefault(profile.profile_id) : undefined} />
    const grid = (items: LlmProfileSummary[]) => <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">{items.map(card)}</div>
    const createButton = <Button onClick={actions.create} disabled={createDisabled} iconLeft={<Icon icon={Plus} size={16} />}>{t('llmProfiles.create')}</Button>
    const sectionHead = (icon: LucideIcon, title: string, hint: string, right?: ReactNode) => <div className="flex flex-col gap-1">
        <SectionHeader icon={icon} title={title} right={right} />
        <p className="max-w-[72ch] font-ui text-label text-parchment-300">{hint}</p>
    </div>
    const { offset, total, size } = state.page

    return <div className="relative mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-8 sm:py-10">
        <PageHeader eyebrow={systemAdmin ? t('llmProfiles.page.rootEyebrow') : undefined} eyebrowTone="arcane" size="lg" divider
            title={t(systemAdmin ? 'llmProfiles.rootTitle' : 'llmProfiles.title')}
            subtitle={t(systemAdmin ? 'llmProfiles.rootSubtitle' : 'llmProfiles.subtitle')}
            icon={<IconTile icon={systemAdmin ? Crown : Bot} tone="arcane" />}
            actions={<>
                <Button variant="secondary" size="sm" disabled={loading || busy} onClick={actions.refresh}
                    iconLeft={<Icon icon={RefreshCw} size={15} className={loading ? 'animate-spin' : undefined} />}>{t('llmProfiles.refresh')}</Button>
                {systemAdmin && createButton}
            </>} />

        {!systemAdmin && onManageAppProfiles && <div className="flex flex-col gap-3 rounded-lg border border-arcane-500/30 bg-arcane-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex min-w-0 items-start gap-2.5 font-ui text-sm text-parchment-200">
                <Icon icon={Crown} size={16} className="mt-0.5 shrink-0 text-arcane-300" />{t('llmProfiles.page.manageBanner')}
            </p>
            <div className="shrink-0">
                <Button variant="arcane" size="sm" onClick={onManageAppProfiles} iconRight={<Icon icon={ArrowRight} size={15} />}>
                    {t('llmProfiles.page.manageAction')}</Button>
            </div>
        </div>}

        {state.error && !editor && <Callout tone="danger" role="alert">{state.error}</Callout>}

        {systemAdmin && preferences && !preferences.default_profile_id && <section aria-labelledby={noDefaultId}
            className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5">
            <div className="flex items-start gap-2.5">
                <Icon icon={AlertTriangle} size={18} className="mt-0.5 shrink-0 text-amber-500" />
                <div className="flex min-w-0 flex-col gap-1">
                    <h2 id={noDefaultId} className="font-display text-h3 font-semibold text-parchment-50">{t('llmProfiles.page.noDefaultTitle')}</h2>
                    <p className="font-ui text-body text-parchment-200">{t('llmProfiles.page.noDefault')}</p>
                </div>
            </div>
            {choices.length === 0 ? <p className="font-ui text-label text-parchment-300">{t('llmProfiles.page.noDefaultPublish')}</p>
                : <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Field label={t('llmProfiles.page.defaultLabel')} className="min-w-0 flex-1 sm:max-w-md">
                        <Select value={defaultChoice} disabled={busy} onChange={setDefaultChoice}
                            options={choices.map(profile => ({ value: profile.profile_id, label: profile.name }))} />
                    </Field>
                    <Button disabled={busy || !defaultChoice} onClick={() => actions.setAppDefault(defaultChoice)}
                        iconLeft={<Icon icon={Star} size={15} />}>{t('llmProfiles.page.setDefault')}</Button>
                </div>}
        </section>}
        {loading && <p role="status" className="flex items-center gap-2 font-ui text-label text-parchment-300">
            <Icon icon={Loader2} size={15} className="animate-spin" />{t('llmProfiles.loading')}</p>}

        <p className="flex max-w-[80ch] items-start gap-2 font-ui text-label text-parchment-300">
            <Icon icon={Info} size={15} className="mt-0.5 shrink-0 text-arcane-300" />
            {t(systemAdmin ? 'llmProfiles.page.rootHowItWorks' : 'llmProfiles.page.howItWorks')}
        </p>

        {systemAdmin ? <section className="flex flex-col gap-4">
            {sectionHead(Layers, t('llmProfiles.page.profiles'), t('llmProfiles.page.profilesHint'))}
            {noModelsMessage && <Callout tone="warning" role="note">{noModelsMessage}</Callout>}
            {app.length > 0 ? grid(app) : !loading && <EmptyState icon={<Icon icon={Bot} size={36} />} message={t('llmProfiles.page.noProfiles')}
                button={noModels ? undefined : { label: t('llmProfiles.create'), onClick: actions.create }} />}
        </section> : <>
            <section className="flex flex-col gap-4">
                {sectionHead(KeyRound, t('llmProfiles.page.yourProfiles'), t('llmProfiles.page.yourProfilesHint'), createButton)}
                {noModels && <Callout tone="info" role="note">
                    <span className="block font-semibold text-parchment-50">{t('llmProfiles.page.noModelsTitle')}</span>
                    <span className="block">{noModelsMessage}</span>
                </Callout>}
                {personal.length > 0 ? grid(personal)
                    : !loading && <p className="font-ui text-body text-parchment-300">{t('llmProfiles.page.noPersonal')}</p>}
            </section>
            <section className="flex flex-col gap-4">
                {sectionHead(Bot, t('llmProfiles.page.appProfiles'), t('llmProfiles.page.appProfilesHint'))}
                {app.length > 0 ? grid(app) : !loading && <p className="font-ui text-body text-parchment-300">{t('llmProfiles.page.noApp')}</p>}
            </section>
        </>}

        {total > size && <nav aria-label={t(systemAdmin ? 'llmProfiles.page.profiles' : 'llmProfiles.title')} className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="ghost" size="sm" disabled={offset === 0 || loading} onClick={() => actions.setOffset(Math.max(0, offset - size))}>{t('llmProfiles.previous')}</Button>
            <span className="font-ui text-label tabular-nums text-parchment-300">
                {t('llmProfiles.page.range', { from: total ? offset + 1 : 0, to: Math.min(offset + size, total), total })}</span>
            <Button variant="ghost" size="sm" disabled={offset + size >= total || loading} onClick={() => actions.setOffset(offset + size)}>{t('llmProfiles.next')}</Button>
        </nav>}

        {assignments && <AssignmentsTable scope={systemAdmin ? 'app' : 'personal'} value={assignments} issues={state.assignmentIssues}
            defaultGaps={state.defaultGaps}
            features={state.features.filter(feature => isLlmFeatureEnabled(feature.feature_key) && (systemAdmin || feature.user_selection_enabled))} profiles={choices}
            dirty={state.assignmentsDirty} busy={busy} onChange={actions.setAssignments} onSave={actions.saveAssignments}
            note={systemAdmin ? undefined : t('llmProfiles.mediaScope')} />}

        {systemAdmin ? <CatalogActivity modelCount={state.modelsTotal} audit={state.audit} profiles={profiles} busy={busy} onSync={actions.syncCatalog} />
            : <>
                <ByokKeyPanel onForget={actions.forgetKeys} />
                <LlmCapacityUsageView usage={state.capacityUsage} loading={loading} error={state.capacityError} />
            </>}

        {editor && <ProfileEditor open mode={editor.mode} systemAdmin={systemAdmin} draft={editor.draft} editing={editor.editing}
            models={models} modelsTotal={state.modelsTotal} connections={state.connections}
            testFeatures={editor.testFeatures} testFeature={editor.testFeature} compatibility={editor.compatibility}
            dirty={editor.dirty} draftUnsaved={editor.draftUnsaved} propsKey={editor.propsKey} propsInvalid={editor.propsInvalid}
            propsServerError={editor.propsServerError} noModelsMessage={editor.mode === 'view' ? undefined : noModelsMessage}
            busy={busy} error={state.error} testResult={editor.testResult}
            onChange={actions.updateDraft} onChooseModel={actions.chooseModel} onPropsValidity={actions.setPropsValidity}
            onTestFeatureChange={actions.setTestFeature} onSave={actions.save} onPublish={actions.requestPublish} onValidate={actions.validate}
            onTest={actions.test} onArchive={actions.requestArchive} onRollback={actions.rollback} onLoadMoreModels={actions.loadMoreModels}
            onCopyPersonal={actions.copyPersonal} onClose={actions.closeEditor} />}

        <ConfirmDialog visible={state.confirm !== null} isProcessing={busy}
            title={t(state.confirm?.kind === 'archive' ? 'llmProfiles.archive' : 'llmProfiles.publish')}
            message={state.confirm?.message ?? ''} variant={state.confirm?.kind === 'archive' ? 'danger' : 'primary'}
            confirmLabel={t(state.confirm?.kind === 'archive' ? 'llmProfiles.archive' : 'llmProfiles.publish')}
            onCancel={actions.cancelConfirm} onConfirm={actions.confirm} />

        {state.notice && <Toast open tone="success" title={state.notice} onClose={actions.clearNotice} autoCloseMs={4000} />}
    </div>
}
