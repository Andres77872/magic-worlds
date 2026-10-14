/**
 * One legacy mapping row (05 §8.6): target, ordered alternates (D33), settings
 * override, language, status and notes, with the target's own sample. The
 * sample follows the row's language as edited, else the target's primary
 * language, else English: the first of them the target has a sample in.
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminCatalogVoice, LegacyMappingRow, LegacyMappingStatus, LegacyMappingUpdate, VoiceSettingsV2 } from '@/shared'
import { Button, Drawer, Field, Icon, Input, Select, SwitchRow, Textarea } from '@/ui/primitives'
import { sampleUrl } from '../../consoleRules'
import { voiceSelectOptions } from '../../voiceOptions'
import { ConsoleAudioPlayer } from '../shell/ConsoleAudioPlayer'
import { OrderedVoiceList } from '../shell/OrderedVoiceList'
import { VoiceSettingsEditor } from '../shell/VoiceSettingsEditor'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'

const STATUSES: LegacyMappingStatus[] = ['proposed', 'approved', 'retired']
const OVERRIDE_KEYS = ['stability', 'similarity_boost', 'speed'] as const
const SAMPLE_FALLBACK_LANGUAGE = 'en'

/** `"es-MX"`, `" ES "` → `"es"`; empty or malformed → null. */
function primaryLanguage(code: string | null | undefined): string | null {
    const primary = code?.trim().toLowerCase().split(/[-_]/)[0] ?? ''
    return /^[a-z]{2,3}$/.test(primary) ? primary : null
}

/** The target's sample for the row: the row language, then the target's primary language, then English. */
function mappingSample(target: AdminCatalogVoice, rowLanguage: string | null | undefined): { language: string; path: string } | null {
    for (const candidate of [rowLanguage, target.primary_language, SAMPLE_FALLBACK_LANGUAGE]) {
        const language = primaryLanguage(candidate)
        const path = language ? sampleUrl(target, language) : null
        if (language && path) return { language, path }
    }
    return null
}

interface MappingEditorDrawerProps {
    row: LegacyMappingRow
    onClose: () => void
    onSaved: (row: LegacyMappingRow) => void
}

export function MappingEditorDrawer({ row, onClose, onSaved }: MappingEditorDrawerProps) {
    const { t } = useTranslation()
    const { catalog, languageName, locale, notify, reportError, sendToLab } = useVoiceConsole()
    const [target, setTarget] = useState(row.voice_key ?? '')
    const [alternates, setAlternates] = useState<string[]>(row.alternate_voice_keys)
    const [overrideOn, setOverrideOn] = useState(row.settings_override !== null)
    const [override, setOverride] = useState<VoiceSettingsV2>(row.settings_override ?? {})
    const [legacyLanguage, setLegacyLanguage] = useState(row.legacy_language ?? '')
    const [status, setStatus] = useState<LegacyMappingStatus>(row.status)
    const [notes, setNotes] = useState(row.notes ?? '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const options = voiceSelectOptions(catalog.voices.filter((voice) => voice.status !== 'removed'), t)
    const targetVoice = target ? catalog.byKey.get(target) : undefined
    // The draft starts from the stored row language, so clearing the field falls
    // through to the target's primary language, not the old value.
    const targetSample = targetVoice ? mappingSample(targetVoice, legacyLanguage) : null

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        setSaving(true)
        setError(null)
        const body: LegacyMappingUpdate = {
            voice_key: target || null,
            alternate_voice_keys: alternates.filter((key) => key !== target),
            settings_override: overrideOn ? override : null,
            legacy_language: legacyLanguage.trim().toLowerCase() || null,
            status,
            notes: notes.trim() || null,
        }
        try {
            const saved = await apiService.putLegacyMapping(row.legacy_voice_id, body)
            onSaved(saved)
            notify(t('admin.voices.toasts.mappingSaved'))
        } catch (caught) {
            setError(reportError(caught))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Drawer open onClose={onClose} eyebrow={t('admin.voices.mapping.editor.eyebrow')} title={row.legacy_voice_id} size="xl">
            <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
                <Field label={t('admin.voices.mapping.editor.target')}>
                    <Select options={options} value={target} onChange={setTarget} placeholder={t('admin.voices.mapping.unmapped')} />
                </Field>

                <OrderedVoiceList
                    label={t('admin.voices.mapping.editor.alternates')}
                    help={t('admin.voices.mapping.editor.alternatesHelp')}
                    addLabel={t('admin.voices.mapping.editor.addAlternate')}
                    value={alternates}
                    options={options.filter((option) => option.value !== target)}
                    onChange={setAlternates}
                />

                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 font-ui text-label font-semibold text-fg">{t('admin.voices.mapping.editor.settingsOverride')}</legend>
                    <SwitchRow label={t('admin.voices.mapping.editor.overrideToggle')} checked={overrideOn} onChange={setOverrideOn} variant="plain" />
                    {overrideOn && <VoiceSettingsEditor keys={OVERRIDE_KEYS} value={override} onChange={setOverride} locale={locale} />}
                </fieldset>

                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('admin.voices.mapping.editor.legacyLanguage')} helper={t('admin.voices.mapping.editor.legacyLanguageHelp')}>
                        <Input value={legacyLanguage} onChange={(event) => setLegacyLanguage(event.target.value)} maxLength={3} />
                    </Field>
                    <Field label={t('admin.voices.mapping.editor.status')}>
                        <Select
                            options={STATUSES.map((value) => ({ value, label: t(`admin.voices.mapping.status.${value}`) }))}
                            value={status}
                            onChange={(value) => setStatus(value as LegacyMappingStatus)}
                        />
                    </Field>
                </div>
                <Field label={t('admin.voices.mapping.editor.notes')}>
                    <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
                </Field>

                <section aria-labelledby="mapping-sample-heading" className="flex flex-col gap-2 rounded-lg border border-line-faint bg-ink-800/70 p-4">
                    <h3 id="mapping-sample-heading" className="font-display text-base font-semibold text-fg">
                        {t('admin.voices.mapping.editor.sample')}
                    </h3>
                    {targetVoice && targetSample ? (
                        <ConsoleAudioPlayer path={targetSample.path} title={t('admin.voices.mapping.editor.targetTitle', { name: targetVoice.display_name })} />
                    ) : (
                        <p className="font-ui text-sm text-fg-muted">
                            {targetVoice ? t('admin.voices.mapping.editor.targetNoSample') : t('admin.voices.mapping.unmapped')}
                        </p>
                    )}
                    {targetVoice && (
                        <>
                            <p className="font-ui text-caption text-fg-muted">
                                {targetSample ? `${languageName(targetSample.language)} · ` : ''}
                                {t('admin.voices.mapping.editor.labHint')}
                            </p>
                            <div>
                                <Button variant="ghost" size="sm" iconLeft={<Icon icon={Send} size={14} />} onClick={() => sendToLab(targetVoice.voice_key)}>
                                    {t('admin.voices.catalog.actions.sendToLab')}
                                </Button>
                            </div>
                        </>
                    )}
                </section>

                {error && (
                    <p role="alert" className="font-ui text-sm text-blood-300">
                        {error}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        {t('admin.voices.common.cancel')}
                    </Button>
                    <Button type="submit" variant="primary" disabled={saving}>
                        {saving ? t('admin.voices.common.saving') : t('admin.voices.mapping.editor.save')}
                    </Button>
                </div>
            </form>
        </Drawer>
    )
}
