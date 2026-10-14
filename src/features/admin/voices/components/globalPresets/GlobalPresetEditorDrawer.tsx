/**
 * Global preset editor (R1-FE-06, 05 §8.12): the preset editor in "global"
 * mode. V2 only (D12): a catalog voice, all five settings (SETTING_RANGES), an
 * optional emotion and language. Warns when users could not apply the preset
 * (voice not public, or not active). The rules run before the write
 * (`globalPresetRules`); server refusals use the console copy (`consoleErrors`).
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminGlobalPresetRow, VoiceEmotion } from '@/shared'
import { Button, Callout, Drawer, Field, Icon, Input, Select, Textarea } from '@/ui/primitives'
import {
    draftFromPreset,
    emptyGlobalPresetDraft,
    GLOBAL_PRESET_EMOTIONS,
    GLOBAL_PRESET_SETTING_KEYS,
    globalPresetIssues,
    globalPresetWarnings,
    toGlobalPresetInput,
    voiceLanguages,
    type GlobalPresetDraft,
    type GlobalPresetField,
    type GlobalPresetIssue,
    type GlobalPresetV2Row,
} from '../../globalPresetRules'
import { voiceSelectOptions } from '../../voiceOptions'
import { VoiceSettingsEditor } from '../shell/VoiceSettingsEditor'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'

interface GlobalPresetEditorDrawerProps {
    /** The V2 row to edit; omitted to create one. */
    preset?: GlobalPresetV2Row | null
    onClose: () => void
    onSaved: (row: AdminGlobalPresetRow, created: boolean) => void
}

export function GlobalPresetEditorDrawer({ preset = null, onClose, onSaved }: GlobalPresetEditorDrawerProps) {
    const { t } = useTranslation()
    const { catalog, languageName, locale, notify, reportError } = useVoiceConsole()
    const [draft, setDraft] = useState<GlobalPresetDraft>(() => (preset ? draftFromPreset(preset) : emptyGlobalPresetDraft()))
    const [submitted, setSubmitted] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const voice = draft.voice_key ? catalog.byKey.get(draft.voice_key) : undefined
    const issues = globalPresetIssues(draft, voice)
    const shown = submitted ? issues : []
    const fieldError = (field: GlobalPresetField) => {
        const issue = shown.find((item) => item.field === field)
        return issue ? describeIssue(issue) : undefined
    }
    // The server's `voice_public` describes the saved voice only.
    const warnings = globalPresetWarnings(voice, preset && preset.voice_key === draft.voice_key ? preset.voice_public : null)
    const languages = voiceLanguages(voice)
    const languageOptions = [
        { value: '', label: t('admin.voices.globalPresets.anyLanguage') },
        ...[...new Set([...languages, ...(draft.language_code && !languages.includes(draft.language_code) ? [draft.language_code] : [])])].map((code) => ({
            value: code,
            label: `${languageName(code)} (${code})`,
        })),
    ]
    const voiceOptions = voiceSelectOptions(
        catalog.voices.filter((entry) => entry.status !== 'removed' || entry.voice_key === draft.voice_key),
        t,
    )

    function describeIssue(issue: GlobalPresetIssue): string {
        const values = issue.setting ? { ...issue.values, label: t(`admin.voices.settings.${issue.setting}`) } : issue.values
        return t(`admin.voices.globalPresets.rules.${issue.key}`, values)
    }

    const update = (patch: Partial<GlobalPresetDraft>) => setDraft((previous) => ({ ...previous, ...patch }))

    const pickVoice = (voiceKey: string) => {
        const next = catalog.byKey.get(voiceKey)
        const nextLanguages = voiceLanguages(next)
        setDraft((previous) => ({
            ...previous,
            voice_key: voiceKey,
            // A new preset starts from the voice's own defaults; an edit keeps its settings.
            settings: preset ? previous.settings : next?.default_settings ? { ...next.default_settings } : null,
            language_code: previous.language_code && nextLanguages.length > 0 && !nextLanguages.includes(previous.language_code) ? '' : previous.language_code,
        }))
    }

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        setSubmitted(true)
        if (issues.length > 0 || saving) return
        setSaving(true)
        setError(null)
        const input = toGlobalPresetInput(draft)
        try {
            const row = preset ? await apiService.updateAdminGlobalPreset(preset.preset_id, input) : await apiService.createAdminGlobalPreset(input)
            notify(t(preset ? 'admin.voices.globalPresets.toasts.saved' : 'admin.voices.globalPresets.toasts.created'))
            onSaved(row, !preset)
        } catch (caught) {
            setError(reportError(caught))
        } finally {
            setSaving(false)
        }
    }

    const settingIssues = shown.filter((issue) => issue.field === 'settings')

    return (
        <Drawer
            open
            onClose={onClose}
            eyebrow={t('admin.voices.globalPresets.editor.eyebrow')}
            title={preset ? t('admin.voices.globalPresets.editor.editTitle', { name: preset.name }) : t('admin.voices.globalPresets.editor.createTitle')}
            size="xl"
        >
            <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
                <Field label={t('admin.voices.globalPresets.editor.name')} error={fieldError('name')}>
                    <Input value={draft.name} onChange={(event) => update({ name: event.target.value })} />
                </Field>
                <Field label={t('admin.voices.globalPresets.editor.description')}>
                    <Textarea value={draft.description} onChange={(event) => update({ description: event.target.value })} rows={2} />
                </Field>
                <Field label={t('admin.voices.globalPresets.editor.voice')} error={fieldError('voice_key')}>
                    <Select
                        options={voiceOptions}
                        value={draft.voice_key}
                        onChange={pickVoice}
                        placeholder={t('admin.voices.globalPresets.editor.voicePlaceholder')}
                    />
                </Field>

                {warnings.length > 0 && (
                    <Callout tone="warning" icon={<Icon icon={AlertTriangle} size={16} />}>
                        <ul className="flex flex-col gap-1" data-testid="global-preset-warnings">
                            {warnings.map((warning) => (
                                <li key={warning}>{t(`admin.voices.globalPresets.editor.${warning}Warning`)}</li>
                            ))}
                        </ul>
                    </Callout>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                        label={t('admin.voices.globalPresets.editor.language')}
                        helper={languages.length > 0 ? t('admin.voices.globalPresets.editor.languageHelp') : undefined}
                        error={fieldError('language_code')}
                    >
                        {languages.length > 0 ? (
                            <Select options={languageOptions} value={draft.language_code} onChange={(value) => update({ language_code: value })} />
                        ) : (
                            <Input
                                value={draft.language_code}
                                onChange={(event) => update({ language_code: event.target.value })}
                                placeholder={t('admin.voices.globalPresets.anyLanguage')}
                                maxLength={3}
                            />
                        )}
                    </Field>
                    <Field label={t('admin.voices.globalPresets.editor.emotion')}>
                        <Select
                            options={[
                                { value: '', label: t('admin.voices.globalPresets.editor.emotionNone') },
                                ...GLOBAL_PRESET_EMOTIONS.map((emotion) => ({ value: emotion, label: t(`admin.voices.globalPresets.emotions.${emotion}`) })),
                            ]}
                            value={draft.emotion ?? ''}
                            onChange={(value) => update({ emotion: (value || null) as VoiceEmotion | null })}
                        />
                    </Field>
                </div>

                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 font-ui text-label font-semibold text-fg">{t('admin.voices.globalPresets.editor.settings')}</legend>
                    <VoiceSettingsEditor keys={GLOBAL_PRESET_SETTING_KEYS} value={draft.settings ?? {}} onChange={(settings) => update({ settings })} locale={locale} />
                    {voice && (
                        <div>
                            <Button
                                variant="ghost"
                                size="sm"
                                iconLeft={<Icon icon={RotateCcw} size={14} />}
                                onClick={() => update({ settings: voice.default_settings ? { ...voice.default_settings } : null })}
                            >
                                {t('admin.voices.globalPresets.editor.useVoiceDefaults')}
                            </Button>
                        </div>
                    )}
                    {settingIssues.length > 0 && (
                        <ul className="flex flex-col gap-0.5 font-ui text-sm text-blood-300">
                            {settingIssues.map((issue) => (
                                <li key={issue.setting}>{describeIssue(issue)}</li>
                            ))}
                        </ul>
                    )}
                </fieldset>

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
                        {saving
                            ? t('admin.voices.globalPresets.editor.saving')
                            : preset
                              ? t('admin.voices.globalPresets.editor.save')
                              : t('admin.voices.globalPresets.editor.create')}
                    </Button>
                </div>
            </form>
        </Drawer>
    )
}
