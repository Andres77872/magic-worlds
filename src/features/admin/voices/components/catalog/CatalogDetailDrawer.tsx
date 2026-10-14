/**
 * Catalog detail drawer (05 §8.3, AC-R2): publish checklist and actions,
 * retire and replacement behind the impact view, display metadata, own
 * samples per language, and the double-confirmed provider delete.
 */
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, RefreshCw, Send, Star, Trash2 } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminCatalogUpdate, AdminCatalogVoice, VoiceAgeBucket, VoiceGender, VoiceSettingsV2, VoiceVisibility } from '@/shared'
import { Badge, Button, Callout, Drawer, Field, Icon, Input, Select, Textarea } from '@/ui/primitives'
import { AGE_BUCKETS, GENDERS, OWNED_SOURCE_KINDS } from '../../constants'
import {
    allPassed,
    isBlockedUntilL2,
    isPublished,
    offersProviderDelete,
    providerDeleteBlockers,
    publishChecklist,
    replacementCandidates,
} from '../../consoleRules'
import { publishFailureMessage, publishFailures, type PublishFailure } from '../../publishFailures'
import {
    replacementDependentsOf,
    replacementOrphans,
    repointRefusalOf,
    type ReplacementDependents,
    type RepointRefusal,
} from '../../replacementDependents'
import { voiceName, voiceSelectOptions } from '../../voiceOptions'
import { CopyableVoiceId } from '../CopyableVoiceId'
import { ConsoleAudioPlayer } from '../shell/ConsoleAudioPlayer'
import { RuleChecklist } from '../shell/RuleChecklist'
import { VoiceSettingsEditor } from '../shell/VoiceSettingsEditor'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'
import { ImpactDialog, type ImpactMode } from './ImpactDialog'
import { ProviderDeleteDialog } from './ProviderDeleteDialog'
import { RepointDialog } from './RepointDialog'

interface CatalogDetailDrawerProps {
    voice: AdminCatalogVoice
    onClose: () => void
    onUpdated: (voice: AdminCatalogVoice) => void
    /** After a re-point: the server moved the dependents it found at retry time, so the lists refetch. */
    onDependentsMoved?: () => void
}

type PublishVisibility = Exclude<VoiceVisibility, 'admin'>

/** The server's refusal codes of the last failed change, shown in the section that made it. */
interface ServerRefusal {
    section: 'publishing' | 'replacement'
    failures: PublishFailure[]
}

/** A change refused with 409 `voice_is_replacement`, waiting for root to pick where its dependents go (I-34). */
interface PendingRepoint {
    body: AdminCatalogUpdate
    toastKey: string
    dependents: ReplacementDependents
    /** Why the last re-point failed, worded; null before the first attempt. */
    error: string | null
}

type PatchResult = 'saved' | 'failed' | 'repoint'

export function CatalogDetailDrawer({ voice, onClose, onUpdated, onDependentsMoved }: CatalogDetailDrawerProps) {
    const { t } = useTranslation()
    const { catalog, languageName, notify, reportError, sendToAcceptance, sendToLab } = useVoiceConsole()
    const checklistId = useId()
    const [visibility, setVisibility] = useState<PublishVisibility>(voice.visibility === 'plan_gated' ? 'plan_gated' : 'public')
    const [minPlan, setMinPlan] = useState(voice.min_plan ?? '')
    const [replacement, setReplacement] = useState(voice.replacement_voice_key ?? '')
    const [impactMode, setImpactMode] = useState<ImpactMode | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [busy, setBusy] = useState<string | null>(null)
    const [refusal, setRefusal] = useState<ServerRefusal | null>(null)
    const [repoint, setRepoint] = useState<PendingRepoint | null>(null)

    const published = isPublished(voice)
    const blockedL2 = isBlockedUntilL2(voice)
    const currentReplacement = voice.replacement_voice_key ? catalog.byKey.get(voice.replacement_voice_key) : undefined
    const checks = publishChecklist({ ...voice, min_plan: minPlan.trim() || null }, { visibility, replacement: currentReplacement })
    const canPublish = allPassed(checks) && !blockedL2
    const candidates = replacementCandidates(voice, catalog.voices)
    const replacementOptions = voiceSelectOptions(
        currentReplacement && !candidates.some((candidate) => candidate.voice_key === currentReplacement.voice_key) ? [currentReplacement, ...candidates] : candidates,
        t,
    )

    const patch = async (action: string, body: AdminCatalogUpdate, toastKey: string, section: ServerRefusal['section'] = 'publishing'): Promise<PatchResult> => {
        setBusy(action)
        try {
            const updated = await apiService.updateAdminCatalogVoice(voice.voice_key, body)
            onUpdated(updated)
            setRefusal(null)
            notify(t(toastKey))
            return 'saved'
        } catch (error) {
            const failures = publishFailures(error)
            setRefusal(failures && failures.length > 0 ? { section, failures } : null)
            // I-34: other voices use this one as their replacement; offer to re-point them.
            const dependents = replacementDependentsOf(error)
            if (dependents) {
                setRepoint({ body, toastKey, dependents, error: null })
                return 'repoint'
            }
            notify(reportError(error), 'error')
            return 'failed'
        } finally {
            setBusy(null)
        }
    }

    const describeRepointRefusal = (refused: RepointRefusal, targetKey: string): string => {
        if (!refused.voiceKey) return t('admin.voices.errors.repointTargetInvalid')
        const names = {
            target: voiceName(catalog.byKey.get(targetKey), targetKey, t),
            name: voiceName(catalog.byKey.get(refused.voiceKey), refused.voiceKey, t),
        }
        return refused.reason
            ? t('admin.voices.catalog.repoint.targetInvalid', { ...names, reason: publishFailureMessage({ code: refused.reason, language: null }, t) })
            : t('admin.voices.catalog.repoint.targetInvalidNoReason', names)
    }

    /** Retry the refused change with its dependents moved to `targetKey` (`?repoint_dependents_to=`). */
    const repointAndSave = async (targetKey: string) => {
        const pending = repoint
        if (!pending || !targetKey) return
        setBusy('repoint')
        try {
            const updated = await apiService.updateAdminCatalogVoice(voice.voice_key, pending.body, { repointDependentsTo: targetKey })
            onUpdated(updated)
            // The server re-computes the dependents during the retry and moves the set it finds then,
            // which can differ from the 409's list: patch the listed ones now, then refetch the truth.
            for (const key of pending.dependents.keys) {
                const dependent = catalog.byKey.get(key)
                if (dependent) onUpdated({ ...dependent, replacement_voice_key: targetKey })
            }
            onDependentsMoved?.()
            setRefusal(null)
            setRepoint(null)
            notify(
                t('admin.voices.toasts.repointed', {
                    action: t(pending.toastKey),
                    count: pending.dependents.keys.length,
                    name: voiceName(catalog.byKey.get(targetKey), targetKey, t),
                }),
            )
        } catch (error) {
            // With `repoint_dependents_to` sent the server never answers 409 `voice_is_replacement`.
            const refused = repointRefusalOf(error)
            setRepoint({ ...pending, error: refused ? describeRepointRefusal(refused, targetKey) : reportError(error) })
        } finally {
            setBusy(null)
        }
    }

    const publish = () =>
        void patch(
            'publish',
            { status: 'active', visibility, ...(visibility === 'plan_gated' ? { min_plan: minPlan.trim() } : {}) },
            'admin.voices.toasts.published',
        )

    const confirmImpact = async () => {
        // A refusal that offers a re-point closes the impact view: the re-point dialog takes over.
        if (impactMode === 'retire') {
            if ((await patch('impact', { status: 'hidden' }, 'admin.voices.toasts.retired')) !== 'failed') setImpactMode(null)
        } else if (impactMode === 'replacement') {
            if ((await patch('impact', { replacement_voice_key: replacement || null }, 'admin.voices.toasts.replacementSet', 'replacement')) !== 'failed') setImpactMode(null)
        }
    }

    const syncThis = async () => {
        setBusy('sync')
        try {
            const result = await apiService.syncAdminCatalog({ job: 'B', voice_keys: [voice.voice_key] })
            const orphans = replacementOrphans(result?.detail)
            if (orphans > 0) notify(t('admin.voices.catalog.sync.orphans', { count: orphans }), 'error')
            else notify(t('admin.voices.toasts.syncQueued', { job: 'B' }))
        } catch (error) {
            notify(reportError(error), 'error')
        } finally {
            setBusy(null)
        }
    }

    const deleteBlockers = providerDeleteBlockers(voice)

    const refusalList = (section: ServerRefusal['section']) =>
        refusal?.section === section ? (
            <Callout tone="danger" role="alert" data-testid={`server-refusal-${section}`}>
                <p className="font-semibold text-parchment-100">{t('admin.voices.catalog.publishChecklist.serverRefused')}</p>
                <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
                    {refusal.failures.map((failure) => (
                        <li key={`${failure.code}:${failure.language ?? ''}`}>
                            {publishFailureMessage(failure, t, languageName)}
                            {failure.dependentVoiceKeys && failure.dependentVoiceKeys.length > 0 && (
                                <span className="block">
                                    {t('admin.voices.publishFailures.dependents', {
                                        names: failure.dependentVoiceKeys.map((key) => voiceName(catalog.byKey.get(key), key, t)).join(', '),
                                    })}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </Callout>
        ) : null

    return (
        <Drawer
            open
            onClose={onClose}
            eyebrow={t('admin.voices.catalog.detail.eyebrow')}
            title={voice.display_name}
            size="xl"
        >
            <div className="flex flex-col gap-7">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                        <Badge tone={voice.status === 'active' ? 'live' : voice.status === 'blocked' || voice.status === 'failed' || voice.status === 'removed' ? 'danger' : 'neutral'}>
                            {t(`admin.voices.status.${voice.status}`)}
                        </Badge>
                        <Badge tone={voice.visibility === 'admin' ? 'neutral' : 'ember'}>{t(`admin.voices.visibility.${voice.visibility}`)}</Badge>
                        <Badge tone={OWNED_SOURCE_KINDS.has(voice.source_kind) ? 'arcane' : 'neutral'}>{t(`admin.voices.sourceKind.${voice.source_kind}`)}</Badge>
                    </div>
                    <p className="font-ui text-caption text-fg-muted">{t('admin.voices.catalog.providerName', { name: voice.provider_name })}</p>
                    <div>
                        <span className="font-ui text-caption text-fg-muted">{t('admin.voices.catalog.detail.providerVoiceId')}</span>
                        <CopyableVoiceId value={voice.provider_voice_id} compact />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button variant="secondary" size="sm" iconLeft={<Icon icon={Star} size={14} />} onClick={() => sendToAcceptance(voice.voice_key)}>
                            {t('admin.voices.catalog.actions.sendToAcceptance')}
                        </Button>
                        <Button variant="secondary" size="sm" iconLeft={<Icon icon={Send} size={14} />} onClick={() => sendToLab(voice.voice_key)}>
                            {t('admin.voices.catalog.actions.sendToLab')}
                        </Button>
                        <Button variant="ghost" size="sm" iconLeft={<Icon icon={RefreshCw} size={14} />} onClick={() => void syncThis()} disabled={busy === 'sync'}>
                            {t('admin.voices.catalog.actions.syncNow')}
                        </Button>
                    </div>
                </div>

                <DrawerSection title={t('admin.voices.catalog.detail.sections.publishing')}>
                    {!published && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field label={t('admin.voices.catalog.detail.visibilityLabel')}>
                                <Select
                                    options={(['public', 'plan_gated'] as const).map((value) => ({ value, label: t(`admin.voices.visibility.${value}`) }))}
                                    value={visibility}
                                    onChange={(value) => setVisibility(value as PublishVisibility)}
                                />
                            </Field>
                            {visibility === 'plan_gated' && (
                                <Field label={t('admin.voices.catalog.detail.minPlan')} helper={t('admin.voices.catalog.detail.minPlanHelp')}>
                                    <Input value={minPlan} onChange={(event) => setMinPlan(event.target.value)} />
                                </Field>
                            )}
                        </div>
                    )}
                    <RuleChecklist id={checklistId} title={t('admin.voices.catalog.publishChecklist.title')} checks={checks} />
                    {refusalList('publishing')}
                    {blockedL2 && (
                        <p className="flex items-start gap-2 font-ui text-sm text-amber-500">
                            <Icon icon={Lock} size={14} className="mt-0.5 shrink-0" />
                            {t('admin.voices.catalog.publishChecklist.blockedUntilL2Hint')}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {published ? (
                            <Button variant="danger-ghost" onClick={() => setImpactMode('retire')}>
                                {t('admin.voices.catalog.actions.retire')}
                            </Button>
                        ) : blockedL2 ? (
                            <Button variant="secondary" disabled iconLeft={<Icon icon={Lock} size={14} />}>
                                {t('admin.voices.catalog.publishChecklist.blockedUntilL2')}
                            </Button>
                        ) : (
                            <Button variant="primary" onClick={publish} disabled={!canPublish || busy === 'publish'} aria-describedby={checklistId}>
                                {voice.status === 'hidden' ? t('admin.voices.catalog.actions.republish') : t('admin.voices.catalog.actions.publish')}
                            </Button>
                        )}
                    </div>
                </DrawerSection>

                <DrawerSection title={t('admin.voices.catalog.detail.sections.replacement')}>
                    <Field
                        label={t('admin.voices.catalog.detail.replacementLabel')}
                        helper={candidates.length === 0 ? t('admin.voices.catalog.detail.replacementHelp') : t('admin.voices.catalog.detail.replacementCandidates')}
                    >
                        <Select options={replacementOptions} value={replacement} onChange={setReplacement} placeholder={t('admin.voices.common.notSet')} />
                    </Field>
                    {voice.replacement_voice_key && (
                        <p className="font-ui text-caption text-fg-muted">
                            {voiceName(currentReplacement, voice.replacement_voice_key, t)}
                        </p>
                    )}
                    {refusalList('replacement')}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => setImpactMode('replacement')}
                            disabled={!replacement || replacement === voice.replacement_voice_key}
                        >
                            {t('admin.voices.catalog.actions.setReplacement')}
                        </Button>
                    </div>
                </DrawerSection>

                <DrawerSection title={t('admin.voices.catalog.detail.sections.metadata')}>
                    <MetadataForm voice={voice} saving={busy === 'metadata'} onSave={(body) => void patch('metadata', body, 'admin.voices.toasts.saved')} />
                </DrawerSection>

                <DrawerSection title={t('admin.voices.catalog.detail.sections.languages')}>
                    {voice.languages.length === 0 || voice.languages.every((entry) => !entry.sample_url) ? (
                        <p className="font-ui text-sm text-fg-muted">{t('admin.voices.catalog.detail.noSamples')}</p>
                    ) : null}
                    <ul className="flex flex-col gap-3">
                        {voice.languages.map((entry) => (
                            <li key={entry.language} className="flex flex-col gap-1.5">
                                <span className="font-ui text-label font-semibold text-parchment-100">
                                    {languageName(entry.language)}
                                    {entry.accent ? ` · ${entry.accent}` : ''}
                                </span>
                                {entry.model_ids.length > 0 && (
                                    <span className="font-ui text-caption text-fg-muted">
                                        {t('admin.voices.catalog.detail.modelsVerified', { models: entry.model_ids.join(', ') })}
                                    </span>
                                )}
                                {entry.sample_url && (
                                    <ConsoleAudioPlayer
                                        path={entry.sample_url}
                                        title={t('admin.voices.catalog.detail.sampleTitle', { name: voice.display_name, language: languageName(entry.language) })}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                </DrawerSection>

                {offersProviderDelete(voice) ? (
                    <DrawerSection title={t('admin.voices.catalog.detail.sections.danger')}>
                        <ul className="flex flex-col gap-1">
                            {deleteBlockers
                                .filter((check) => !check.passed)
                                .map((check) => (
                                    <li key={check.id} className="font-ui text-sm text-blood-300">
                                        {t(check.labelKey, check.labelValues)}
                                    </li>
                                ))}
                        </ul>
                        <div>
                            <Button variant="danger" iconLeft={<Icon icon={Trash2} size={14} />} onClick={() => setDeleting(true)} disabled={!allPassed(deleteBlockers)}>
                                {t('admin.voices.catalog.actions.providerDelete')}
                            </Button>
                        </div>
                    </DrawerSection>
                ) : (
                    <p className="font-ui text-caption text-fg-muted">{t('admin.voices.catalog.detail.ownedOnly')}</p>
                )}
            </div>

            {impactMode && (
                <ImpactDialog
                    voice={voice}
                    mode={impactMode}
                    processing={busy === 'impact'}
                    onCancel={() => setImpactMode(null)}
                    onConfirm={() => void confirmImpact()}
                />
            )}
            {repoint && (
                <RepointDialog
                    voice={voice}
                    dependents={repoint.dependents}
                    processing={busy === 'repoint'}
                    error={repoint.error}
                    onCancel={() => setRepoint(null)}
                    onConfirm={(targetKey) => void repointAndSave(targetKey)}
                />
            )}
            {deleting && (
                <ProviderDeleteDialog
                    voice={voice}
                    onCancel={() => setDeleting(false)}
                    onDeleted={(updated) => {
                        setDeleting(false)
                        onUpdated(updated)
                        notify(t('admin.voices.toasts.deleted'))
                    }}
                />
            )}
        </Drawer>
    )
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
    const id = useId()
    return (
        <section aria-labelledby={id} className="flex flex-col gap-3 border-t border-line-faint pt-5">
            <h3 id={id} className="font-display text-base font-semibold text-fg">
                {title}
            </h3>
            {children}
        </section>
    )
}

const ALL_SETTING_KEYS = ['stability', 'similarity_boost', 'speed', 'style', 'use_speaker_boost'] as const

function MetadataForm({ voice, saving, onSave }: { voice: AdminCatalogVoice; saving: boolean; onSave: (body: AdminCatalogUpdate) => void }) {
    const { t } = useTranslation()
    const { locale } = useVoiceConsole()
    const [displayName, setDisplayName] = useState(voice.display_name)
    const [description, setDescription] = useState(voice.description ?? '')
    const [gender, setGender] = useState<string>(voice.gender ?? '')
    const [age, setAge] = useState<string>(voice.age ?? '')
    const [accent, setAccent] = useState(voice.accent ?? '')
    const [primaryLanguage, setPrimaryLanguage] = useState(voice.primary_language ?? '')
    const [tags, setTags] = useState(voice.tags.join(', '))
    const [sortRank, setSortRank] = useState(String(voice.sort_rank))
    const [settings, setSettings] = useState<VoiceSettingsV2>(voice.default_settings ?? {})

    const submit = (event: FormEvent) => {
        event.preventDefault()
        const rank = Number.parseInt(sortRank, 10)
        onSave({
            display_name: displayName.trim(),
            description: description.trim() || null,
            gender: (gender || null) as VoiceGender | null,
            age: (age || null) as VoiceAgeBucket | null,
            accent: accent.trim() || null,
            primary_language: primaryLanguage.trim().toLowerCase() || null,
            tags: tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
            ...(Number.isFinite(rank) ? { sort_rank: rank } : {}),
            default_settings: settings,
        })
    }

    const anyOption = { value: '', label: t('admin.voices.common.notSet') }

    return (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
            <Field label={t('admin.voices.catalog.detail.displayName')}>
                <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
            </Field>
            <Field label={t('admin.voices.catalog.detail.description')}>
                <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('admin.voices.catalog.detail.gender')}>
                    <Select options={[anyOption, ...GENDERS.map((value) => ({ value, label: t(`admin.voices.gender.${value}`) }))]} value={gender} onChange={setGender} />
                </Field>
                <Field label={t('admin.voices.catalog.detail.age')}>
                    <Select options={[anyOption, ...AGE_BUCKETS.map((value) => ({ value, label: t(`admin.voices.age.${value}`) }))]} value={age} onChange={setAge} />
                </Field>
                <Field label={t('admin.voices.catalog.detail.accent')}>
                    <Input value={accent} onChange={(event) => setAccent(event.target.value)} />
                </Field>
                <Field label={t('admin.voices.catalog.detail.primaryLanguage')}>
                    <Input value={primaryLanguage} onChange={(event) => setPrimaryLanguage(event.target.value)} maxLength={3} />
                </Field>
                <Field label={t('admin.voices.catalog.detail.tags')} helper={t('admin.voices.catalog.detail.tagsHelp')}>
                    <Input value={tags} onChange={(event) => setTags(event.target.value)} />
                </Field>
                <Field label={t('admin.voices.catalog.detail.sortRank')}>
                    <Input type="number" value={sortRank} onChange={(event) => setSortRank(event.target.value)} />
                </Field>
            </div>
            <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 font-ui text-label font-semibold text-fg">{t('admin.voices.catalog.detail.defaultSettings')}</legend>
                <p className="font-ui text-caption text-fg-muted">{t('admin.voices.catalog.detail.defaultSettingsHelp')}</p>
                <VoiceSettingsEditor keys={ALL_SETTING_KEYS} value={settings} onChange={setSettings} locale={locale} />
            </fieldset>
            <div>
                <Button type="submit" variant="primary" disabled={saving || !displayName.trim()}>
                    {saving ? t('admin.voices.common.saving') : t('admin.voices.catalog.detail.saveMetadata')}
                </Button>
            </div>
        </form>
    )
}
