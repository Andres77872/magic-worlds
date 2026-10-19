/**
 * The profile editor drawer. Sections, top to bottom: basics, response model,
 * separate models for roleplay and voice call (collapsed), advanced settings
 * (collapsed), custom provider props (collapsed), server compatibility, then
 * the test panel, history (root) and the danger zone. The footer always says
 * where the profile stands (unsaved / draft saved / published vN) next to the
 * actions. In `view` mode it renders a read-only summary of an app profile with
 * "Copy as personal profile".
 *
 * Purely presentational: the page owns the draft, the API calls and the busy flag.
 */
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Bot, FlaskConical, History, KeyRound, Loader2, Play, Save, Send, ShieldCheck } from 'lucide-react'
import type { LlmFeature } from '@/shared/types/llm.types'
import type {
    LlmCatalogModel,
    LlmConnection,
    LlmFeatureView,
    LlmProfileDetail,
    LlmProfileMutation,
    LlmProfileRole,
    LlmProfileTestResult,
    LlmProfileTestTarget,
    LlmRole,
} from '@/shared/types/llmProfile.types'
import { Badge, Button, Callout, Drawer, Eyebrow, Field, Icon, Input, Select, Textarea, cx } from '@/ui/primitives'
import { Disclosure } from './Disclosure'
import { LlmProfileCompatibilityPanel, type LlmCompatibilityState } from './LlmProfileCompatibilityPanel'
import { ModelFacts } from './ModelFacts'
import { ProviderPropsField } from './ProviderPropsField'
import { RoleSettingsFields } from './RoleSettingsFields'
import { isCustomProviderBaseUrl } from '@/shared/llmCustomProvider'
import { HELPER_ROLES, ROLE_ORDER, configKey, formatTokens, modelOptions, providerOptionCount, withProviderOptions, customProfileConfig, customProfileReady, customRole, usableModels } from './llmProfileModel'

export type ProfileEditorMode = 'create' | 'edit' | 'view'

export interface ProfileEditorProps {
    open: boolean
    mode: ProfileEditorMode
    systemAdmin: boolean
    draft: LlmProfileMutation
    /** The saved profile (edit / view); null while creating. */
    editing: LlmProfileDetail | null
    models: LlmCatalogModel[]
    modelsTotal: number
    connections: LlmConnection[]
    /** Features this profile can be tested against. */
    testFeatures: LlmFeatureView[]
    testFeature: LlmFeature | undefined
    compatibility: LlmCompatibilityState | null
    /** Any local edit that is not saved yet. */
    dirty: boolean
    /** Root only: local edits differ from the saved draft (blocks draft test, validation and publishing). */
    draftUnsaved: boolean
    /** Changes whenever a different saved value is loaded, to reset the props text. */
    propsKey: number | string
    propsInvalid: boolean
    propsServerError?: string
    /** No usable model in the catalog for this payer. */
    noModelsMessage?: string
    busy: boolean
    error?: string
    notice?: string
    testResult: LlmProfileTestResult | null
    onChange: (draft: LlmProfileMutation) => void
    onChooseModel: (role: LlmRole, catalogModelKey: string) => void
    onPropsValidity: (valid: boolean) => void
    onTestFeatureChange: (feature: LlmFeature) => void
    onSave: () => void
    onPublish: () => void
    onValidate: () => void
    onTest: (kind: LlmProfileTestTarget['kind']) => void
    onArchive: () => void
    onRollback: (revisionId: string) => void
    onLoadMoreModels: () => void
    onCopyPersonal: () => void
    onClose: () => void
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
    return <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
            <h3 className="font-ui text-sm font-semibold text-parchment-50">{title}</h3>
            {hint && <p className="font-ui text-caption text-parchment-300">{hint}</p>}
        </div>
        {children}
    </section>
}

export function ProfileEditor(props: ProfileEditorProps) {
    const { open, mode, systemAdmin, draft, editing, models, modelsTotal, connections, testFeatures, testFeature, compatibility,
        dirty, draftUnsaved, propsKey, propsInvalid, propsServerError, noModelsMessage, busy, error, notice, testResult,
        onChange, onChooseModel, onPropsValidity, onTestFeatureChange, onSave, onPublish, onValidate, onTest, onArchive,
        onRollback, onLoadMoreModels, onCopyPersonal, onClose } = props
    const { t, i18n } = useTranslation()
    const locale = i18n.resolvedLanguage
    const [testOpen, setTestOpen] = useState(false)
    const [rollback, setRollback] = useState('')
    const testRef = useRef<HTMLDivElement>(null)
    const readOnly = mode === 'view'
    const config = draft.config
    const appProfile = readOnly || systemAdmin
    const modelOf = (key: string | undefined) => models.find(model => model.catalog_model_key === key)
    const primaryModel = modelOf(config.roles.primary.catalog_model_key)
    const helperChoices = models.filter(model => model.provider_target_key === config.provider_target_key && model.catalog_revision === config.catalog_revision)
    const configuredRoles = ROLE_ORDER.filter(role => config.roles[role])
    const helperCount = HELPER_ROLES.filter(role => config.roles[role]).length
    const propsCount = providerOptionCount(config)
    const current = editing?.current ?? null

    const setRole = (role: LlmRole, value: LlmProfileRole) => onChange({ ...draft, config: { ...config, roles: { ...config.roles, [role]: value } } })

    const status = (() => {
        if (readOnly) return current ? t('llmProfiles.editor.status.published', { n: current.revision_number }) : t('llmProfiles.editor.status.readOnly')
        if (mode === 'create') return t('llmProfiles.editor.status.new')
        if (dirty) return t(systemAdmin ? 'llmProfiles.editor.status.unsaved' : 'llmProfiles.editor.status.unsavedPersonal')
        if (!systemAdmin) return current ? t('llmProfiles.editor.status.saved', { n: current.revision_number }) : t('llmProfiles.editor.status.unsavedPersonal')
        if (!current) return t('llmProfiles.editor.status.draftSaved')
        return editing?.draft_config && configKey(editing.draft_config) !== configKey(current.config)
            ? t('llmProfiles.editor.status.draftAhead', { n: current.revision_number })
            : t('llmProfiles.editor.status.published', { n: current.revision_number })
    })()
    const statusTone = mode === 'create' || dirty ? 'text-ember-300' : current ? 'text-verdant-500' : 'text-parchment-200'

    // A result keeps the test panel visible (it can only come from that panel).
    const showTest = testOpen || testResult !== null
    const toggleTest = () => {
        const next = !showTest
        setTestOpen(next)
        if (next) window.requestAnimationFrame(() => testRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }))
    }

    const canSave = !readOnly && !busy && Boolean(draft.name.trim()) && !propsInvalid && customProfileReady(config)
    const editingSaved = mode === 'edit' && editing !== null
    const footer = <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className={cx('font-ui text-label font-semibold', statusTone)}>{status}</p>
        <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>{t('llmProfiles.close')}</Button>
            {readOnly && <Button onClick={onCopyPersonal} disabled={busy} iconLeft={<Icon icon={KeyRound} size={15} />}>{t('llmProfiles.copyPersonal')}</Button>}
            {editingSaved && <Button variant="secondary" aria-expanded={showTest} onClick={toggleTest} iconLeft={<Icon icon={FlaskConical} size={15} />}>
                {t('llmProfiles.editor.testToggle')}</Button>}
            {editingSaved && systemAdmin && <Button variant={dirty ? 'secondary' : 'primary'} disabled={busy || draftUnsaved || editing?.status === 'archived'}
                onClick={onPublish} iconLeft={<Icon icon={Send} size={15} />}>{t('llmProfiles.publish')}</Button>}
            {!readOnly && <Button variant={dirty || mode === 'create' || !systemAdmin ? 'primary' : 'secondary'} disabled={!canSave} onClick={onSave}
                iconLeft={<Icon icon={busy ? Loader2 : Save} size={15} className={busy ? 'animate-spin' : undefined} />}>
                {t(systemAdmin ? 'llmProfiles.editor.saveDraft' : 'llmProfiles.save')}</Button>}
        </div>
    </div>

    return <Drawer open={open} onClose={onClose} size="2xl" footer={footer}
        title={t(readOnly ? 'llmProfiles.view' : mode === 'edit' ? 'llmProfiles.edit' : 'llmProfiles.create')}
        eyebrow={<Eyebrow tone={appProfile ? 'arcane' : 'ember'}>{t(appProfile ? 'llmProfiles.editor.eyebrowApp' : 'llmProfiles.editor.eyebrowPersonal')}</Eyebrow>}
        icon={<Icon icon={appProfile ? Bot : KeyRound} size={18} className={appProfile ? 'text-arcane-300' : 'text-ember-300'} />}>
        <div className="flex flex-col gap-6">
            {error && <Callout tone="danger" role="alert">{error}</Callout>}
            {notice && <Callout tone="success" role="status">{notice}</Callout>}

            {readOnly ? <ReadOnlySummary draft={draft} models={models} /> : <>
                <Section title={t('llmProfiles.editor.basics')}>
                    <Field label={t('llmProfiles.name')}>
                        <Input value={draft.name} maxLength={160} disabled={busy} placeholder={t('llmProfiles.editor.namePlaceholder')}
                            onChange={event => onChange({ ...draft, name: event.target.value })} />
                    </Field>
                    <Field label={t('llmProfiles.description')} helper={t('llmProfiles.editor.descriptionHint')}>
                        <Textarea value={draft.description} maxLength={2000} rows={2} disabled={busy}
                            onChange={event => onChange({ ...draft, description: event.target.value })} />
                    </Field>
                </Section>

                {!systemAdmin && <Field label={t('llmProfiles.custom.source')}>
                    <Select value={config.custom_provider ? 'custom' : 'preset'} disabled={busy}
                        options={[{ value: 'preset', label: t('llmProfiles.custom.preset'), disabled: usableModels(models).length === 0 },
                            { value: 'custom', label: t('llmProfiles.custom.choice') }]}
                        onChange={source => {
                            if (source === 'custom') onChange({ ...draft, config: customProfileConfig() })
                            else if (usableModels(models)[0]) onChooseModel('primary', usableModels(models)[0].catalog_model_key)
                        }} />
                </Field>}

                {config.custom_provider ? <Section title={t('llmProfiles.custom.title')} hint={t('llmProfiles.custom.hint')}>
                    <Field label={t('llmProfiles.custom.url')} helper={t('llmProfiles.custom.urlHint')}
                        error={config.custom_provider.base_url && !isCustomProviderBaseUrl(config.custom_provider.base_url) ? t('llmProfiles.custom.invalidUrl') : undefined}>
                        <Input type="url" maxLength={2048} value={config.custom_provider.base_url} disabled={busy}
                            placeholder="https://provider.example/v1"
                            onChange={event => onChange({ ...draft, config: { ...config,
                                custom_provider: { ...config.custom_provider!, base_url: event.target.value } } })} />
                    </Field>
                    <Field label={t('llmProfiles.custom.model')} helper={t('llmProfiles.custom.modelHint')}>
                        <Input value={config.roles.primary.provider_model_id ?? ''} maxLength={256} disabled={busy}
                            onChange={event => setRole('primary', { ...config.roles.primary, provider_model_id: event.target.value })} />
                    </Field>
                    <Field label={t('llmProfiles.custom.api')}>
                        <Select value={config.custom_provider.endpoint} disabled={busy}
                            options={[{ value: 'chat_completions', label: 'Chat Completions' }, { value: 'responses', label: 'Responses' }]}
                            onChange={value => {
                                const endpoint = value as LlmProfileRole['endpoint']
                                const roles = { ...config.roles }
                                for (const role of ROLE_ORDER) if (roles[role]) roles[role] = { ...roles[role]!, endpoint }
                                onChange({ ...draft, config: { ...config, roles, custom_provider: { ...config.custom_provider!, endpoint } } })
                            }} />
                    </Field>
                    <Callout tone="info" role="note">{t('llmProfiles.custom.server')}</Callout>
                </Section> : <Section title={t('llmProfiles.editor.responseModel')} hint={t('llmProfiles.editor.responseModelHint')}>
                    {noModelsMessage && <Callout tone="warning" role="note">{noModelsMessage}</Callout>}
                    <Field label={t('llmProfiles.editor.model')}>
                        <Select value={config.roles.primary.catalog_model_key} disabled={busy}
                            options={modelOptions(models, t, locale, config.roles.primary.catalog_model_key)}
                            onChange={id => onChooseModel('primary', id)} />
                    </Field>
                    <ModelFacts model={primaryModel} compact />
                    {models.length < modelsTotal && <div>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={onLoadMoreModels}>{t('llmProfiles.moreModels')}</Button>
                    </div>}
                    {systemAdmin && <Field label={t('llmProfiles.connection')} helper={t('llmProfiles.editor.connectionHint')}>
                        <Select value={config.platform_connection_key ?? ''} disabled={busy}
                            options={connections.filter(connection => connection.provider_target_key === config.provider_target_key)
                                .map(connection => ({ value: connection.connection_key, label: connection.connection_key, disabled: !connection.available }))}
                            onChange={value => onChange({ ...draft, config: { ...config, platform_connection_key: value } })} />
                    </Field>}
                </Section>}

                <Disclosure title={t(config.custom_provider ? 'llmProfiles.custom.separate' : 'llmProfiles.editor.separate')}
                    hint={t(config.custom_provider ? 'llmProfiles.custom.separateHint' : 'llmProfiles.editor.separateHint')} defaultOpen={helperCount > 0}
                    trailing={helperCount > 0 ? <Badge tone="arcane">{helperCount}</Badge> : undefined}>
                    {HELPER_ROLES.map(role => {
                        const value = config.roles[role]
                        const options = [{ value: '', label: t('llmProfiles.samePrimary') }, ...modelOptions(helperChoices, t, locale, value?.catalog_model_key)]
                        return <div key={role} className="flex flex-col gap-2">
                            <Field label={t(`llmProfiles.roles.${role}`)} helper={t(`llmProfiles.editor.${role}Hint`)}>
                                {config.custom_provider ? <Input value={value?.provider_model_id ?? ''} maxLength={256} disabled={busy}
                                    placeholder={t('llmProfiles.samePrimary')}
                                    onChange={event => {
                                        const roles = { ...config.roles }
                                        if (event.target.value) roles[role] = { ...(value ?? customRole('', config.custom_provider!.endpoint)), provider_model_id: event.target.value }
                                        else delete roles[role]
                                        onChange({ ...draft, config: { ...config, roles } })
                                    }} />
                                    : <Select value={value?.catalog_model_key ?? ''} disabled={busy} options={options} onChange={id => onChooseModel(role, id)} />}
                            </Field>
                            {value && !config.custom_provider && <ModelFacts model={modelOf(value.catalog_model_key)} compact />}
                        </div>
                    })}
                    <p className="font-ui text-caption text-parchment-400">{t(config.custom_provider ? 'llmProfiles.custom.sameProvider' : 'llmProfiles.editor.sameProvider')}</p>
                </Disclosure>

                <Disclosure title={t('llmProfiles.editor.advanced')} hint={t('llmProfiles.editor.advancedHint')}>
                    {configuredRoles.map(role => <div key={role} className="flex flex-col gap-3">
                        {configuredRoles.length > 1 && <h4 className="font-ui text-label font-semibold text-parchment-100">
                            {t('llmProfiles.editor.roleSettings', { role: t(`llmProfiles.roles.${role}`) })}</h4>}
                        <RoleSettingsFields value={config.roles[role]!} model={modelOf(config.roles[role]!.catalog_model_key)} disabled={busy} custom={Boolean(config.custom_provider)}
                            onChange={value => setRole(role, value)} />
                    </div>)}
                </Disclosure>

                <Disclosure title={t('llmProfiles.editor.props')} defaultOpen={propsCount > 0 || Boolean(propsServerError)}
                    trailing={propsCount > 0 ? <Badge tone="neutral">{propsCount}</Badge> : undefined}>
                    <ProviderPropsField key={propsKey} value={config.provider_options} disabled={busy} serverError={propsServerError}
                        onValidityChange={onPropsValidity}
                        onChange={value => onChange({ ...draft, config: withProviderOptions(config, value) })} />
                </Disclosure>

                {compatibility && <LlmProfileCompatibilityPanel state={compatibility} custom={Boolean(config.custom_provider)} />}

                {editingSaved && editing && showTest && <div ref={testRef} className="flex flex-col gap-4 rounded-lg border border-line-faint bg-surface-raised/40 p-4">
                    <Section title={t('llmProfiles.editor.testTitle')} hint={t('llmProfiles.testExplanation')}>
                        <Field label={t('llmProfiles.testFeature')} helper={systemAdmin && draftUnsaved ? t('llmProfiles.testUnsaved') : undefined}>
                            <Select value={testFeature ?? ''} disabled={busy || testFeatures.length === 0} onChange={value => onTestFeatureChange(value as LlmFeature)}
                                options={testFeatures.map(item => ({ value: item.feature_key, label: t(`llmProfiles.features.${item.feature_key}`),
                                    description: item.roles.map(role => t(`llmProfiles.roles.${role}`)).join(' · ') }))} />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                            {systemAdmin && <Button variant="secondary" disabled={busy || draftUnsaved || !testFeature} onClick={() => onTest('draft')}
                                iconLeft={<Icon icon={Play} size={15} />}>{t('llmProfiles.testDraft')}</Button>}
                            <Button variant="secondary" disabled={busy || !editing.current || !testFeature} onClick={() => onTest('published')}
                                iconLeft={<Icon icon={Play} size={15} />}>{t('llmProfiles.test')}</Button>
                            {systemAdmin && <Button variant="ghost" disabled={busy || draftUnsaved} onClick={onValidate}
                                iconLeft={<Icon icon={ShieldCheck} size={15} />}>{t('llmProfiles.validate')}</Button>}
                        </div>
                        {testResult && <Callout tone="success" role="status">
                            <span className="block font-semibold text-parchment-50">{t('llmProfiles.editor.testPassed')}</span>
                            <span className="block break-words">{t('llmProfiles.testResult', { target: t(`llmProfiles.testTarget.${testResult.target}`),
                                feature: t(`llmProfiles.features.${testResult.feature}`),
                                roles: testResult.roles.map(role => t(`llmProfiles.roles.${role}`)).join(', '), output: testResult.output })}</span>
                        </Callout>}
                    </Section>
                </div>}

                {systemAdmin && editingSaved && editing && editing.revisions.length > 0 && <Disclosure title={t('llmProfiles.editor.history')}
                    hint={t('llmProfiles.editor.historyHint')} trailing={<Icon icon={History} size={15} className="text-parchment-400" />}>
                    <ul className="flex flex-col divide-y divide-line-faint">
                        {editing.revisions.map(revision => <li key={revision.revision_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <span className="font-ui text-label font-semibold text-parchment-100">v{revision.revision_number}</span>
                            <span className="flex items-center gap-2">
                                <span className="font-mono text-meta text-parchment-400">{new Date(revision.created_at).toLocaleString(locale)}</span>
                                {revision.revision_id === current?.revision_id && <Badge tone="live">{t('llmProfiles.editor.live')}</Badge>}
                            </span>
                        </li>)}
                    </ul>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <Field label={t('llmProfiles.editor.restoreLabel')} className="min-w-0 flex-1">
                            <Select value={rollback} disabled={busy} onChange={setRollback}
                                options={editing.revisions.filter(revision => revision.revision_id !== current?.revision_id)
                                    .map(revision => ({ value: revision.revision_id, label: `v${revision.revision_number}` }))} />
                        </Field>
                        <Button variant="secondary" disabled={busy || !rollback} onClick={() => onRollback(rollback)}>{t('llmProfiles.rollback')}</Button>
                    </div>
                </Disclosure>}

                {editingSaved && editing?.status !== 'archived' && <section className="flex flex-col gap-3 rounded-lg border border-blood-500/30 p-4">
                    <div className="flex flex-col gap-0.5">
                        <h3 className="font-ui text-sm font-semibold text-blood-300">{t('llmProfiles.editor.danger')}</h3>
                        <p className="font-ui text-caption text-parchment-300">{t('llmProfiles.editor.archiveHint')}</p>
                    </div>
                    <div>
                        <Button variant="danger-ghost" disabled={busy} onClick={onArchive} iconLeft={<Icon icon={Archive} size={15} />}>
                            {t('llmProfiles.archive')}</Button>
                    </div>
                </section>}
            </>}
        </div>
    </Drawer>
}

function ReadOnlySummary({ draft, models }: { draft: LlmProfileMutation; models: LlmCatalogModel[] }) {
    const { t, i18n } = useTranslation()
    const config = draft.config
    const primary = config.roles.primary
    const modelOf = (key: string) => models.find(model => model.catalog_model_key === key)
    const helpers = HELPER_ROLES.filter(role => config.roles[role])
    const options = Object.keys(config.provider_options ?? {})
    const limits = ['max_input_tokens', 'max_output_tokens', 'max_messages', 'timeout_seconds'] as const
    return <div className="flex flex-col gap-6">
        <Callout tone="info" role="note">{t('llmProfiles.editor.readOnlyNote')}</Callout>
        <div className="flex flex-col gap-1">
            <h3 className="break-words font-display text-h3 font-semibold text-parchment-50">{draft.name}</h3>
            {draft.description && <p className="font-ui text-body text-parchment-200">{draft.description}</p>}
        </div>
        <Section title={t('llmProfiles.editor.responseModel')} hint={t('llmProfiles.editor.responseModelHint')}>
            <ModelFacts model={modelOf(primary.catalog_model_key)} fallbackKey={primary.catalog_model_key} />
            <dl className="grid grid-cols-2 gap-3 font-ui text-label sm:grid-cols-4">
                {limits.map(limit => <div key={limit} className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-caption text-parchment-400">{t(`llmProfiles.settings.${limit}`)}</dt>
                    <dd className="tabular-nums text-parchment-100">{limit === 'timeout_seconds' ? primary.settings[limit]
                        : formatTokens(primary.settings[limit], i18n.resolvedLanguage)}</dd>
                </div>)}
            </dl>
        </Section>
        <Section title={t('llmProfiles.editor.separate')} hint={t('llmProfiles.editor.separateHint')}>
            {helpers.length === 0 ? <p className="font-ui text-label text-parchment-200">{t('llmProfiles.editor.noSeparate')}</p>
                : <dl className="flex flex-col gap-3">
                    {helpers.map(role => <div key={role} className="flex flex-col gap-1">
                        <dt className="font-ui text-caption text-parchment-400">{t(`llmProfiles.roles.${role}`)}</dt>
                        <dd><ModelFacts model={modelOf(config.roles[role]!.catalog_model_key)} fallbackKey={config.roles[role]!.catalog_model_key} /></dd>
                    </div>)}
                </dl>}
        </Section>
        <Section title={t('llmProfiles.editor.props')}>
            {options.length === 0 ? <p className="font-ui text-label text-parchment-200">{t('llmProfiles.editor.propsNone')}</p>
                : <div className="flex flex-wrap gap-1.5">{options.map(key => <code key={key}
                    className="rounded-full bg-ink-600 px-2.5 py-[3px] font-mono text-meta text-parchment-200">{key}</code>)}</div>}
        </Section>
    </div>
}
