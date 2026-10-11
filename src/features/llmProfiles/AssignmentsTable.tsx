/**
 * "Which profile each feature uses": a default row, then one row per feature,
 * grouped by what the feature does. Rows whose feature uses the separate
 * preflight / metadata models are marked. When the server refuses a save, the
 * reason shows inline on the row it concerns; a feature left on the default
 * that the default cannot serve gets a (non-blocking) warning. One Save button.
 */
import { useTranslation } from 'react-i18next'
import { Layers, Loader2, Save } from 'lucide-react'
import type { LlmFeature } from '@/shared/types/llm.types'
import type { LlmFeatureView, LlmPreferences, LlmProfileSummary } from '@/shared/types/llmProfile.types'
import { Badge, Button, Callout, Card, Field, Icon, SectionHeader, Select, cx, type SelectOption } from '@/ui/primitives'
import { capabilityLabel, groupFeatures, helperRolesOf, type AssignmentIssue, type AssignmentIssues } from './llmProfileModel'

const KNOWN_ISSUES = new Set(['SYSTEM_DEFAULT_REQUIRED', 'PROFILE_INCOMPATIBLE', 'MODEL_CONTEXT_INSUFFICIENT', 'PROVIDER_MODEL_UNAVAILABLE',
    'PROFILE_ENDPOINT_UNSUPPORTED', 'PROFILE_PARAMETER_UNSUPPORTED', 'PLATFORM_CONNECTION_UNAVAILABLE', 'FEATURE_BYOK_DISABLED',
    'FEATURE_SELECTION_DISABLED', 'PROFILE_UNAVAILABLE'])

interface AssignmentsTableProps {
    /** `app`: the root policy (app default + per-feature profiles). `personal`: the user's own choices. */
    scope: 'app' | 'personal'
    features: LlmFeatureView[]
    /** Profiles that can be chosen (published / active). */
    profiles: LlmProfileSummary[]
    value: LlmPreferences
    issues?: AssignmentIssues | null
    /** Features the current default profile cannot serve (warned on rows that use the default). */
    defaultGaps?: LlmFeature[]
    dirty?: boolean
    busy?: boolean
    onChange: (next: LlmPreferences) => void
    onSave: () => void
    /** Footnote under the table (e.g. which features always use the app's choice). */
    note?: string
}

export function AssignmentsTable({ scope, features, profiles, value, issues, defaultGaps = [], dirty = false, busy = false, onChange, onSave, note }: AssignmentsTableProps) {
    const { t } = useTranslation()
    const choices: SelectOption[] = profiles.map(profile => ({ value: profile.profile_id, label: profile.name, textValue: profile.name,
        description: scope === 'personal' ? t(`llmProfiles.scope.${profile.scope}`) : undefined }))
    const withMissing = (selected: string | null | undefined, options: SelectOption[]) =>
        selected && !options.some(option => option.value === selected) ? [...options, { value: selected, label: selected, disabled: true }] : options
    const defaultOptions = withMissing(value.default_profile_id,
        [{ value: '', label: t(scope === 'app' ? 'llmProfiles.assign.noDefault' : 'llmProfiles.assign.useAppChoice') }, ...choices])
    // What an unassigned feature falls back to, named when possible.
    const defaultName = profiles.find(profile => profile.profile_id === value.default_profile_id)?.name
    const fallbackLabel = defaultName ? t('llmProfiles.assign.useDefaultNamed', { name: defaultName })
        : t(scope === 'personal' ? 'llmProfiles.assign.useAppChoice' : 'llmProfiles.assign.useDefault')
    const featureView = (feature: LlmFeature) => features.find(item => item.feature_key === feature)

    const issueText = (issue: AssignmentIssue, feature?: LlmFeature) => {
        const view = feature ? featureView(feature) : undefined
        const role = t(`llmProfiles.roleNouns.${issue.role ?? 'primary'}`)
        const needed = view?.requirements[issue.role ?? 'primary']?.capabilities.filter(capability => capability !== 'chat') ?? []
        const params = { role, feature: feature ? t(`llmProfiles.features.${feature}`) : '', code: issue.code,
            capabilities: needed.length ? needed.map(capability => capabilityLabel(capability, t)).join(', ') : t('llmProfiles.assign.requiredCapability') }
        return KNOWN_ISSUES.has(issue.code) ? t(`llmProfiles.assign.issues.${issue.code}`, params) : t('llmProfiles.assign.issues.other', params)
    }

    const setFeature = (feature: LlmFeature, profileId: string) => {
        const feature_profiles = { ...value.feature_profiles }
        if (profileId) feature_profiles[feature] = profileId; else delete feature_profiles[feature]
        onChange({ ...value, feature_profiles })
    }

    const rowIssues = issues ? Object.keys(issues.features).length + (issues.default ? 1 : 0) : 0
    const cellClass = 'block px-0 py-1 sm:table-cell sm:px-3 sm:py-3 sm:align-top'

    return <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-1">
            <SectionHeader icon={Layers} title={t('llmProfiles.assign.title')} />
            <p className="max-w-[72ch] font-ui text-label text-parchment-300">
                {t(scope === 'app' ? 'llmProfiles.assign.rootHint' : 'llmProfiles.assign.userHint')}
            </p>
        </div>
        <table className="relative block w-full border-collapse font-ui text-label sm:table">
            <caption className="sr-only">{t('llmProfiles.assign.title')}</caption>
            <thead className="hidden sm:table-header-group">
                <tr className="text-left text-caption uppercase tracking-[0.08em] text-parchment-400">
                    <th scope="col" className="px-3 pb-2 font-semibold">{t('llmProfiles.assign.feature')}</th>
                    <th scope="col" className="w-[min(22rem,50%)] px-3 pb-2 font-semibold">{t('llmProfiles.assign.profile')}</th>
                </tr>
            </thead>
            <tbody className="block sm:table-row-group">
                <tr className={cx('flex flex-col gap-1 rounded-md border border-ember-500/25 bg-ember-500/[.06] p-3 sm:table-row sm:p-0',
                    issues?.default && 'border-blood-500/40')}>
                    <th scope="row" className={cx(cellClass, 'text-left font-normal')}>
                        <span className="block font-semibold text-parchment-50">{t('llmProfiles.assign.defaultRow')}</span>
                        <span className="block text-caption text-parchment-300">{t('llmProfiles.assign.defaultRowHint')}</span>
                    </th>
                    <td className={cellClass}>
                        <Field error={issues?.default ? issueText(issues.default) : undefined}>
                            <Select size="sm" aria-label={`${t('llmProfiles.assign.defaultRow')} — ${t('llmProfiles.assign.defaultRowHint')}`}
                                value={value.default_profile_id ?? ''} options={defaultOptions} disabled={busy}
                                onChange={id => onChange({ ...value, default_profile_id: id || null })} />
                        </Field>
                    </td>
                </tr>
            </tbody>
            {groupFeatures(features).map(group => <tbody key={group.key} className="block sm:table-row-group">
                <tr className="block sm:table-row">
                    <th scope="colgroup" colSpan={2} className="block px-0 pb-1 pt-5 text-left sm:table-cell sm:px-3">
                        <span className="block font-display text-base font-semibold text-parchment-50">{t(`llmProfiles.assign.groups.${group.key}`)}</span>
                        <span className="block text-caption font-normal text-parchment-300">{t(`llmProfiles.assign.groupHints.${group.key}`)}</span>
                    </th>
                </tr>
                {group.features.map(feature => {
                    const helpers = helperRolesOf(feature.roles)
                    const issue = issues?.features[feature.feature_key]
                    const gap = !issue && !value.feature_profiles[feature.feature_key] && value.default_profile_id && defaultGaps.includes(feature.feature_key)
                    const name = t(`llmProfiles.features.${feature.feature_key}`)
                    const options = withMissing(value.feature_profiles[feature.feature_key], [{ value: '', label: fallbackLabel }, ...choices])
                    return <tr key={feature.feature_key} className={cx('flex flex-col gap-1 border-b border-line-faint py-2 sm:table-row sm:py-0',
                        issue && 'bg-blood-500/[.06]')}>
                        <th scope="row" className={cx(cellClass, 'text-left font-normal')}>
                            <span className="block font-semibold text-parchment-100">{name}</span>
                            {helpers.length > 0 && <span className="mt-1 flex flex-wrap gap-1">
                                <Badge tone="arcane">{t('llmProfiles.assign.alsoUses', { roles: helpers.map(role => t(`llmProfiles.roleNouns.${role}`)).join(', ') })}</Badge>
                            </span>}
                        </th>
                        <td className={cellClass}>
                            <Field error={issue ? issueText(issue, feature.feature_key) : undefined}>
                                <Select size="sm" aria-label={name} value={value.feature_profiles[feature.feature_key] ?? ''}
                                    options={options} disabled={busy} onChange={id => setFeature(feature.feature_key, id)} />
                            </Field>
                            {gap && <p className="mt-1.5 font-ui text-caption text-amber-500">{t('llmProfiles.assign.defaultCannotServe')}</p>}
                        </td>
                    </tr>
                })}
            </tbody>)}
        </table>
        {note && <p className="font-ui text-caption text-parchment-300">{note}</p>}
        {issues && (rowIssues > 0 || issues.general) && <Callout tone="danger" role="alert">
            {rowIssues > 0 ? t('llmProfiles.assign.fixRows') : issues.general}
        </Callout>}
        <div className="flex flex-wrap items-center justify-end gap-3">
            {dirty && <span role="status" className="font-ui text-caption text-ember-300">{t('llmProfiles.assign.unsaved')}</span>}
            <Button variant={dirty ? 'primary' : 'secondary'} disabled={busy} onClick={onSave}
                iconLeft={<Icon icon={busy ? Loader2 : Save} size={15} className={busy ? 'animate-spin' : undefined} />}>
                {t('llmProfiles.savePreferences')}
            </Button>
        </div>
    </Card>
}
