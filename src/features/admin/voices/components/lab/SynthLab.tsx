/**
 * Synth lab (05 §8.11, AC-R10): any catalog voice, any allow-listed model,
 * only the controls that model supports (03 §5.6), two markup modes, and
 * results with request id and character cost. Renders bill as admin spend.
 * The text limit comes from the server (`labTextLimit`). The models, output
 * formats, normalization modes and markup flags come from the A4 model list
 * when it exists (`useLabModels`, R1-FE-06); without it the lab is the R0 lab
 * (two MP3 formats, fixed `auto` normalization). A 422 refusal of a format or
 * a normalization narrows what is offered for that model.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { TestTube2 } from 'lucide-react'
import { ApiError, apiService } from '@/infrastructure/api'
import type { LabMarkupMode, LabModelAlias, LabTextNormalization, VoiceCapabilities, VoiceSettingsV2 } from '@/shared'
import { Button, Field, Icon, Input, Select, Textarea } from '@/ui/primitives'
import { DEFAULT_LAB_TEXT, LAB_COMPARE_MAX, LAB_DEFAULT_OUTPUT_FORMAT, LAB_MODELS } from '../../constants'
import { voiceName, voiceSelectOptions } from '../../voiceOptions'
import { ConsoleSection } from '../shell/ConsoleSection'
import { VoiceSettingsEditor } from '../shell/VoiceSettingsEditor'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'
import { LabResultCard, type LabResult } from './LabResultCard'
import { labTextLimit } from './labLimits'
import { MarkupToolbar } from './MarkupToolbar'
import { useLabModels, type LabModelOption } from './useLabModels'

const pickSettings = (settings: VoiceSettingsV2, keys: readonly (keyof VoiceSettingsV2)[]): VoiceSettingsV2 =>
    Object.fromEntries(keys.filter((key) => settings[key] !== undefined && settings[key] !== null).map((key) => [key, settings[key]])) as VoiceSettingsV2

const KNOWN_ALIASES: ReadonlySet<string> = new Set(LAB_MODELS.map((profile) => profile.alias))

/** Formats and normalization modes the BFF refused for a model (422), so they are no longer offered. */
interface LabRefusals {
    formats: string[]
    normalization: boolean
}

export function SynthLab({ initialVoiceKey = null }: { initialVoiceKey?: string | null }) {
    const { t } = useTranslation()
    const { catalog, locale, reportError } = useVoiceConsole()
    const textId = useId()
    const [voiceKey, setVoiceKey] = useState(initialVoiceKey ?? '')
    const [modelAlias, setModelAlias] = useState<LabModelAlias>('el_v4')
    const [outputFormat, setOutputFormat] = useState<string>(LAB_DEFAULT_OUTPUT_FORMAT)
    const [normalization, setNormalization] = useState<LabTextNormalization>('auto')
    const [languageCode, setLanguageCode] = useState('')
    const [seed, setSeed] = useState('')
    const [markupMode, setMarkupMode] = useState<LabMarkupMode>('app')
    const [settings, setSettings] = useState<VoiceSettingsV2>(() => catalog.byKey.get(initialVoiceKey ?? '')?.default_settings ?? {})
    const [text, setText] = useState(DEFAULT_LAB_TEXT)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [results, setResults] = useState<LabResult[]>([])
    const [pinned, setPinned] = useState<number[]>([])
    const [capabilities, setCapabilities] = useState<VoiceCapabilities | null>(null)
    // `max_chars` of a 422 `text_over_model_limit`, per model: the server's own limit.
    const [learnedLimits, setLearnedLimits] = useState<Partial<Record<LabModelAlias, number>>>({})
    const [refusals, setRefusals] = useState<Partial<Record<LabModelAlias, LabRefusals>>>({})
    const labModels = useLabModels()
    const nextId = useRef(1)

    // Model text limits from the capabilities (see `labLimits`); a failed read keeps the BFF lab cap.
    useEffect(() => {
        let cancelled = false
        void Promise.resolve()
            .then(() => apiService.getVoiceCapabilities())
            .then((value) => {
                if (!cancelled) setCapabilities(value)
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [])

    const voice = voiceKey ? catalog.byKey.get(voiceKey) : undefined
    const models = labModels.models.filter((option) => !voice || (voice.provider === 'fish_audio') === (option.alias === 'fish_drama_3'))
    const model: LabModelOption =
        models.find((profile) => profile.alias === modelAlias) ?? models.find((profile) => profile.available) ?? models[0] ?? labModels.models[0]
    const modelLabel = (option: LabModelOption) =>
        option.label ?? (KNOWN_ALIASES.has(option.alias) ? t(`admin.voices.lab.models.${option.alias}`) : option.alias)
    const modelAvailable = model.available && (!voice || (voice.provider === 'fish_audio') === (model.alias === 'fish_drama_3'))
    const maxChars = labTextLimit(model, capabilities, learnedLimits[model.alias])
    const tooLong = text.length > maxChars
    // What this model offers, minus what the BFF refused for it; the selection falls back to the first offer.
    const refused = refusals[model.alias]
    const offeredFormats = model.outputFormats.filter((format) => !refused?.formats.includes(format))
    const formats = offeredFormats.length > 0 ? offeredFormats : [LAB_DEFAULT_OUTPUT_FORMAT]
    const format = formats.includes(outputFormat) ? outputFormat : formats[0]
    const normalizations: LabTextNormalization[] = refused?.normalization ? ['auto'] : model.textNormalization
    const textNormalization = normalizations.includes(normalization) ? normalization : normalizations[0]

    const insert = (snippet: string) => {
        const area = document.getElementById(textId) as HTMLTextAreaElement | null
        if (!area) {
            setText((previous) => `${previous}${snippet}`)
            return
        }
        const start = area.selectionStart ?? text.length
        const end = area.selectionEnd ?? text.length
        const next = `${text.slice(0, start)}${snippet}${text.slice(end)}`
        setText(next)
        requestAnimationFrame(() => {
            area.focus()
            area.setSelectionRange(start + snippet.length, start + snippet.length)
        })
    }

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        if (!voice || !text.trim() || tooLong || !modelAvailable) return
        setBusy(true)
        setError(null)
        const parsedSeed = Number.parseInt(seed, 10)
        try {
            const result = await apiService.testAdminVoice({
                voice_key: voice.voice_key,
                model_alias: model.alias,
                text,
                markup_mode: voice.provider === 'fish_audio' ? 'app' : markupMode,
                output_format: format,
                language_code: model.sendsLanguageCode ? languageCode.trim().toLowerCase() || null : null,
                seed: model.supportsSeed && Number.isFinite(parsedSeed) ? parsedSeed : null,
                apply_text_normalization: textNormalization,
                voice_settings: voice.provider === 'fish_audio' ? null : pickSettings(settings, model.settings),
            })
            const id = nextId.current++
            setResults((previous) => [
                {
                    id,
                    title: t('admin.voices.lab.resultTitle', { voice: voiceName(voice, voice.voice_key, t), model: modelLabel(model) }),
                    blob: result.blob,
                    contentType: result.content_type,
                    outputFormat: format,
                    requestId: result.request_id,
                    characterCost: result.character_cost,
                },
                ...previous,
            ])
        } catch (caught) {
            const limit = caught instanceof ApiError && caught.code === 'text_over_model_limit' ? caught.details?.max_chars : undefined
            if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
                setLearnedLimits((previous) => ({ ...previous, [model.alias]: limit }))
            }
            // R1-FE-06: a refused format or normalization is no longer offered for this model.
            const code = caught instanceof ApiError ? caught.code : undefined
            if (code === 'unsupported_output_format' || code === 'unsupported_text_normalization') {
                setRefusals((previous) => {
                    const current = previous[model.alias] ?? { formats: [], normalization: false }
                    return {
                        ...previous,
                        [model.alias]: code === 'unsupported_output_format'
                            ? { ...current, formats: [...new Set([...current.formats, format])] }
                            : { ...current, normalization: true },
                    }
                })
            }
            setError(reportError(caught))
        } finally {
            setBusy(false)
        }
    }

    const togglePin = (id: number) => setPinned((previous) => (previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id].slice(-LAB_COMPARE_MAX)))
    const pinnedResults = pinned.map((id) => results.find((result) => result.id === id)).filter((result): result is LabResult => Boolean(result))

    return (
        <ConsoleSection icon={TestTube2} title={t('admin.voices.lab.title')} description={t('admin.voices.lab.description')}>
            <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
                <div className="flex flex-col gap-4 rounded-lg border border-line-faint bg-ink-800/70 p-4">
                    <Field label={t('admin.voices.lab.voice')}>
                        <Select
                            options={voiceSelectOptions(catalog.voices, t)}
                            value={voiceKey}
                            onChange={(value) => {
                                setVoiceKey(value)
                                setSettings(catalog.byKey.get(value)?.default_settings ?? {})
                            }}
                            placeholder={t('admin.voices.lab.voicePlaceholder')}
                        />
                    </Field>
                    <Field label={t('admin.voices.lab.model')} error={model.available ? undefined : t('admin.voices.lab.modelUnavailable')}>
                        <Select
                            options={models.map((profile) => ({
                                value: profile.alias,
                                label: modelLabel(profile),
                                ...(profile.available ? {} : { disabled: true, description: t('admin.voices.lab.modelUnavailable') }),
                            }))}
                            value={model.alias}
                            onChange={(value) => setModelAlias(value as LabModelAlias)}
                        />
                    </Field>
                    <Field label={t('admin.voices.lab.outputFormat')} helper={format.startsWith('pcm_') ? t('admin.voices.lab.formatPcmHint') : undefined}>
                        <Select options={formats.map((value) => ({ value, label: value }))} value={format} onChange={setOutputFormat} />
                    </Field>
                    {model.sendsLanguageCode ? (
                        <Field label={t('admin.voices.lab.languageCode')}>
                            <Input value={languageCode} onChange={(event) => setLanguageCode(event.target.value)} placeholder={t('admin.voices.lab.auto')} maxLength={3} />
                        </Field>
                    ) : (
                        <p className="font-ui text-caption text-fg-muted">
                            {t('admin.voices.lab.languageCode')}: {t('admin.voices.lab.languageCodeDisabled')}
                        </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        {model.supportsSeed && (
                            <Field label={t('admin.voices.lab.seed')}>
                                <Input type="number" inputMode="numeric" value={seed} onChange={(event) => setSeed(event.target.value)} />
                            </Field>
                        )}
                        {normalizations.length > 1 ? (
                            <Field label={t('admin.voices.lab.normalization.label')}>
                                <Select
                                    options={normalizations.map((value) => ({ value, label: t(`admin.voices.lab.normalization.${value}`) }))}
                                    value={textNormalization}
                                    onChange={(value) => setNormalization(value as LabTextNormalization)}
                                />
                            </Field>
                        ) : (
                            <div>
                                <p className="mb-2 block font-ui text-label font-semibold text-fg">{t('admin.voices.lab.normalization.label')}</p>
                                <p className="py-2.5 font-ui text-body text-parchment-200">{t(`admin.voices.lab.normalization.${textNormalization}`)}</p>
                                {textNormalization === 'auto' && <p className="font-ui text-caption text-fg-muted">{t('admin.voices.lab.normalization.fixed')}</p>}
                            </div>
                        )}
                    </div>
                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-1 font-ui text-label font-semibold text-fg">{t('admin.voices.lab.settingsTitle')}</legend>
                        <VoiceSettingsEditor keys={model.settings} value={settings} onChange={setSettings} locale={locale} />
                    </fieldset>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                    <Field label={t('admin.voices.lab.markup.label')} className="max-w-xs">
                        <Select
                            options={(voice?.provider === 'fish_audio' ? ['app'] as const : ['app', 'native'] as const).map((value) => ({ value, label: t(`admin.voices.lab.markup.${value}`) }))}
                            value={voice?.provider === 'fish_audio' ? 'app' : markupMode}
                            onChange={(value) => setMarkupMode(value as LabMarkupMode)}
                        />
                    </Field>
                    <p className="font-ui text-caption text-fg-muted">
                        {voice?.provider === 'fish_audio' || markupMode === 'app' ? t('admin.voices.lab.markup.appHelp') : t('admin.voices.lab.markup.nativeHelp')}
                    </p>
                    {voice?.provider !== 'fish_audio' && <MarkupToolbar mode={markupMode} model={model} onInsert={insert} />}
                    <Field label={t('admin.voices.lab.text')} htmlFor={textId} error={tooLong ? t('admin.voices.lab.tooLong', { max: maxChars }) : undefined}>
                        <Textarea id={textId} value={text} onChange={(event) => setText(event.target.value)} rows={8} />
                    </Field>
                    <span className="text-right font-mono text-[11px] text-fg-muted">{t('admin.voices.common.chars', { count: text.length, max: maxChars })}</span>
                    {error && (
                        <p role="alert" className="font-ui text-sm text-blood-300">
                            {error}
                        </p>
                    )}
                    <div>
                        <Button type="submit" variant="primary" iconLeft={<Icon icon={TestTube2} size={15} />} disabled={busy || !voice || !text.trim() || tooLong || !modelAvailable}>
                            {busy ? t('admin.voices.lab.synthesizing') : t('admin.voices.lab.synthesize')}
                        </Button>
                    </div>
                </div>
            </form>

            {pinnedResults.length > 0 && (
                <section aria-labelledby="lab-compare-heading" className="flex flex-col gap-2">
                    <h3 id="lab-compare-heading" className="font-display text-base font-semibold text-fg">
                        {t('admin.voices.lab.compare')}
                    </h3>
                    <div className="grid gap-3 lg:grid-cols-3">
                        {pinnedResults.map((result) => (
                            <LabResultCard key={`pinned-${result.id}`} result={result} pinned canPin onTogglePin={() => togglePin(result.id)} />
                        ))}
                    </div>
                </section>
            )}

            {results.length > 0 && (
                <section aria-labelledby="lab-results-heading" className="flex flex-col gap-2">
                    <h3 id="lab-results-heading" className="font-display text-base font-semibold text-fg">
                        {t('admin.voices.lab.results')}
                    </h3>
                    <p className="font-ui text-caption text-fg-muted">{t('admin.voices.lab.compareHint')}</p>
                    <div className="grid gap-3 lg:grid-cols-2">
                        {results.map((result) => (
                            <LabResultCard
                                key={result.id}
                                result={result}
                                pinned={pinned.includes(result.id)}
                                canPin={pinned.length < LAB_COMPARE_MAX}
                                onTogglePin={() => togglePin(result.id)}
                            />
                        ))}
                    </div>
                </section>
            )}
        </ConsoleSection>
    )
}
