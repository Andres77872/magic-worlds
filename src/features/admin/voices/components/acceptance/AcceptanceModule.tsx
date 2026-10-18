/**
 * Acceptance (R0 deliverable, 05 §8.4, AC-R3): queue voices, batch-render the
 * fixed scripts on v4, listen to the samples and against a reference
 * voice, then score the rubric and record the verdict per model and language.
 * A pass that leaves the language without an own sample renders it.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AcceptanceRenderResponse, AcceptanceVerdictRequest, CatalogSample } from '@/shared'
import { Button, Callout, Field, Input, Select, SwitchRow } from '@/ui/primitives'
import {
    ACCEPTANCE_MODELS,
    CONSOLE_LANGUAGES,
    STANDARD_MODEL_ID,
    LIGHT_LANGUAGES,
    SCRIPT_VERSION,
} from '../../constants'
import { isAbortError } from '../../consoleErrors'
import { hasSample, isAccepted, publishProgress, sampleUrl } from '../../consoleRules'
import { voiceName, voiceSelectOptions, withSamples } from '../../voiceOptions'
import { CheckboxField } from '../shell/CheckboxField'
import { ConsoleAudioPlayer } from '../shell/ConsoleAudioPlayer'
import { ConsoleSection } from '../shell/ConsoleSection'
import { useLoadErrorMessage, useVoiceConsole } from '../shell/VoiceConsoleContext'
import { AcceptanceProgress } from './AcceptanceProgress'
import { RubricForm } from './RubricForm'
import { SideBySideRenders } from './SideBySideRenders'

interface RunState {
    done: number
    total: number
}

const toggle = (list: string[], value: string, on: boolean) => (on ? [...new Set([...list, value])] : list.filter((item) => item !== value))

export function AcceptanceModule({ initialVoiceKey = null }: { initialVoiceKey?: string | null }) {
    const { t } = useTranslation()
    const { catalog, languageName, locale, notify, reportError } = useVoiceConsole()
    const catalogError = useLoadErrorMessage(catalog.error)
    const initialVoice = initialVoiceKey ? catalog.byKey.get(initialVoiceKey) : undefined
    const initialLanguage = initialVoice?.primary_language && CONSOLE_LANGUAGES.includes(initialVoice.primary_language) ? initialVoice.primary_language : 'en'

    const [selected, setSelected] = useState<string[]>(initialVoiceKey ? [initialVoiceKey] : [])
    const [languages, setLanguages] = useState<string[]>([initialLanguage])
    const [models, setModels] = useState<string[]>([...ACCEPTANCE_MODELS])
    const [light, setLight] = useState(false)
    const [filter, setFilter] = useState('')
    const [run, setRun] = useState<RunState | null>(null)
    const [runMessage, setRunMessage] = useState<string | null>(null)
    const [runErrors, setRunErrors] = useState<string[]>([])
    const [renders, setRenders] = useState<Record<string, AcceptanceRenderResponse>>({})
    const [reviewKey, setReviewKey] = useState<string | null>(initialVoiceKey)
    const [reviewLanguage, setReviewLanguage] = useState(initialLanguage)
    const [referenceKey, setReferenceKey] = useState<string | null>(null)
    const [saving, setSaving] = useState<string | null>(null)
    const [saveErrors, setSaveErrors] = useState<Record<string, string | null>>({})
    const [samples, setSamples] = useState<CatalogSample[]>([])
    const [renderingSamples, setRenderingSamples] = useState(false)
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => () => abortRef.current?.abort(), [])

    const queueable = useMemo(
        () => catalog.voices.filter((voice) => voice.status === 'draft' || voice.status === 'active'),
        [catalog.voices],
    )
    const needle = filter.trim().toLowerCase()
    const visibleQueue = needle ? queueable.filter((voice) => voice.display_name.toLowerCase().includes(needle)) : queueable
    const progress = publishProgress(catalog.voices, catalog.summary)

    const runRenders = async () => {
        if (selected.length === 0 || languages.length === 0 || models.length === 0) {
            setRunMessage(t('admin.voices.acceptance.queue.needsSelection'))
            return
        }
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller
        const queue = [...selected]
        setRun({ done: 0, total: queue.length })
        setRunMessage(null)
        setRunErrors([])
        let done = 0
        for (const voiceKey of queue) {
            try {
                const response = await apiService.renderAcceptance(
                    { voice_key: voiceKey, model_ids: catalog.byKey.get(voiceKey)?.provider === 'fish_audio' ? ['drama-3', 's2.1-pro'] : models, languages, script_version: SCRIPT_VERSION },
                    controller.signal,
                )
                if (controller.signal.aborted) return
                setRenders((previous) => ({ ...previous, [voiceKey]: response }))
            } catch (error) {
                if (controller.signal.aborted || isAbortError(error)) return
                const name = voiceName(catalog.byKey.get(voiceKey), voiceKey, t)
                setRunErrors((previous) => [...previous, t('admin.voices.acceptance.queue.failedVoice', { name, error: reportError(error) })])
            }
            done += 1
            setRun({ done, total: queue.length })
        }
        setRun(null)
        setRunMessage(t('admin.voices.acceptance.queue.done', { count: done }))
        if (!reviewKey || !queue.includes(reviewKey)) setReviewKey(queue[0])
        if (!languages.includes(reviewLanguage)) setReviewLanguage(languages[0])
    }

    const reviewVoice = reviewKey ? catalog.byKey.get(reviewKey) : undefined
    const batch = reviewKey ? renders[reviewKey] : undefined
    const languageRenders = batch?.items.filter((item) => item.language === reviewLanguage) ?? []
    const reviewOptions = voiceSelectOptions(
        catalog.voices.filter((voice) => voice.voice_key === reviewKey || renders[voice.voice_key] || selected.includes(voice.voice_key)),
        t,
    )
    const references = catalog.voices.filter((voice) => voice.voice_key !== reviewKey && isAccepted(voice, STANDARD_MODEL_ID, reviewLanguage))
    const reference = referenceKey ? catalog.byKey.get(referenceKey) : undefined
    const candidateNarration =
        languageRenders.find((item) => item.model_id === STANDARD_MODEL_ID && item.script_kind === 'narration') ??
        languageRenders.find((item) => item.script_kind === 'narration')

    const measuredLufs = (modelId: string): number | null => {
        // `integrated_lufs` is optional (I-15 measures offline): skip absent, null or non-finite values.
        const values = languageRenders
            .filter((item) => item.model_id === modelId)
            .map((item) => item.integrated_lufs)
            .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
        if (values.length === 0) return null
        return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    }

    const saveVerdict = async (modelId: string, body: AcceptanceVerdictRequest) => {
        if (!reviewVoice) return
        setSaving(modelId)
        setSaveErrors((previous) => ({ ...previous, [modelId]: null }))
        try {
            const response = await apiService.putAcceptanceVerdict(reviewVoice.voice_key, modelId, reviewLanguage, body)
            let voice = response.voice
            catalog.upsert(voice)
            notify(t('admin.voices.toasts.verdictSaved'))
            // AC-R3: samples are rendered on acceptance. The server renders them on a pass;
            // when the row still has no own sample for this language, render it here.
            if (body.verdict === 'pass' && !hasSample(voice, reviewLanguage)) {
                const rendered = await apiService.renderCatalogSamples(voice.voice_key, { languages: [reviewLanguage], model_ids: [modelId] })
                voice = withSamples(voice, rendered.items)
                catalog.upsert(voice)
                setSamples(rendered.items)
                notify(t('admin.voices.toasts.samplesRendered'))
            }
        } catch (error) {
            setSaveErrors((previous) => ({ ...previous, [modelId]: reportError(error) }))
        } finally {
            setSaving(null)
        }
    }

    const rerenderSamples = async () => {
        if (!reviewVoice) return
        setRenderingSamples(true)
        try {
            const rendered = await apiService.renderCatalogSamples(reviewVoice.voice_key, { languages: [reviewLanguage] })
            catalog.upsert(withSamples(reviewVoice, rendered.items))
            setSamples(rendered.items)
            notify(t('admin.voices.toasts.samplesRendered'))
        } catch (error) {
            notify(reportError(error), 'error')
        } finally {
            setRenderingSamples(false)
        }
    }

    return (
        <ConsoleSection icon={Star} title={t('admin.voices.acceptance.title')} description={t('admin.voices.acceptance.description')}>
            <AcceptanceProgress progress={progress} languageName={languageName} />

            {catalogError && (
                <Callout tone="danger" role="alert" action={<Button variant="secondary" size="sm" onClick={catalog.reload}>{t('admin.voices.common.retry')}</Button>}>
                    {catalogError}
                </Callout>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
                <section aria-labelledby="acceptance-queue-heading" className="flex flex-col gap-4 rounded-lg border border-line-faint bg-ink-800/70 p-4">
                    <h3 id="acceptance-queue-heading" className="font-display text-base font-semibold text-fg">
                        {t('admin.voices.acceptance.queue.title')}
                    </h3>

                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-1 font-ui text-label font-semibold text-fg">{t('admin.voices.acceptance.queue.voices')}</legend>
                        <Input
                            type="search"
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                            aria-label={t('admin.voices.acceptance.queue.voicesFilter')}
                            placeholder={t('admin.voices.acceptance.queue.voicesFilter')}
                        />
                        {catalog.loading && queueable.length === 0 ? (
                            <p className="font-ui text-sm text-fg-muted">{t('admin.voices.common.loading')}</p>
                        ) : queueable.length === 0 ? (
                            <p className="font-ui text-sm text-fg-muted">{t('admin.voices.acceptance.queue.noVoices')}</p>
                        ) : (
                            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                                {visibleQueue.map((voice) => (
                                    <CheckboxField
                                        key={voice.voice_key}
                                        label={voice.display_name}
                                        description={t(`admin.voices.status.${voice.status}`)}
                                        checked={selected.includes(voice.voice_key)}
                                        onChange={(on) => setSelected((previous) => toggle(previous, voice.voice_key, on))}
                                    />
                                ))}
                            </div>
                        )}
                    </fieldset>

                    <fieldset className="flex flex-col gap-1.5">
                        <legend className="mb-1 font-ui text-label font-semibold text-fg">{t('admin.voices.acceptance.queue.languages')}</legend>
                        <div className="grid grid-cols-2 gap-1.5">
                            {CONSOLE_LANGUAGES.map((language) => (
                                <CheckboxField
                                    key={language}
                                    label={languageName(language)}
                                    checked={languages.includes(language)}
                                    onChange={(on) => setLanguages((previous) => toggle(previous, language, on))}
                                />
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="flex flex-col gap-1.5">
                        <legend className="mb-1 font-ui text-label font-semibold text-fg">{t('admin.voices.acceptance.queue.models')}</legend>
                        {ACCEPTANCE_MODELS.map((modelId) => (
                            <CheckboxField
                                key={modelId}
                                label={t(`admin.voices.models.${modelId}`)}
                                checked={models.includes(modelId)}
                                onChange={(on) => setModels((previous) => toggle(previous, modelId, on))}
                            />
                        ))}
                    </fieldset>

                    <SwitchRow
                        label={t('admin.voices.acceptance.queue.light')}
                        description={t('admin.voices.acceptance.queue.lightHelp')}
                        checked={light}
                        onChange={(on) => {
                            setLight(on)
                            if (on) setLanguages((previous) => previous.filter((language) => (LIGHT_LANGUAGES as readonly string[]).includes(language)))
                        }}
                        variant="plain"
                    />

                    <Button variant="primary" onClick={() => void runRenders()} disabled={run !== null}>
                        {t('admin.voices.acceptance.queue.run')}
                    </Button>
                    <div aria-live="polite" className="font-ui text-sm text-parchment-200">
                        {run ? t('admin.voices.acceptance.queue.running', { done: run.done, total: run.total }) : runMessage}
                    </div>
                    {runErrors.length > 0 && (
                        <ul role="alert" className="flex flex-col gap-1 font-ui text-sm text-blood-300">
                            {runErrors.map((message) => (
                                <li key={message}>{message}</li>
                            ))}
                        </ul>
                    )}
                </section>

                <section aria-labelledby="acceptance-review-heading" className="flex min-w-0 flex-col gap-4">
                    <h3 id="acceptance-review-heading" className="font-display text-base font-semibold text-fg">
                        {t('admin.voices.acceptance.review.title')}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={t('admin.voices.acceptance.review.voice')}>
                            <Select
                                options={reviewOptions}
                                value={reviewKey}
                                onChange={(value) => {
                                    setReviewKey(value)
                                    setSamples([])
                                }}
                                placeholder={t('admin.voices.acceptance.review.pickVoice')}
                            />
                        </Field>
                        <Field label={t('admin.voices.acceptance.review.language')}>
                            <Select
                                options={CONSOLE_LANGUAGES.map((language) => ({ value: language, label: languageName(language) }))}
                                value={reviewLanguage}
                                onChange={(value) => {
                                    setReviewLanguage(value)
                                    setReferenceKey(null)
                                    setSamples([])
                                }}
                            />
                        </Field>
                    </div>

                    {!reviewVoice ? (
                        <p className="font-ui text-sm text-fg-muted">{t('admin.voices.acceptance.review.pickVoice')}</p>
                    ) : (
                        <>
                            <div className="flex flex-col gap-2">
                                <h4 className="font-ui text-label font-semibold text-fg">{t('admin.voices.acceptance.review.sideBySide')}</h4>
                                {languageRenders.length === 0 ? (
                                    <p className="font-ui text-sm text-fg-muted">{t('admin.voices.acceptance.review.noRenders')}</p>
                                ) : (
                                    <SideBySideRenders renders={languageRenders} language={reviewLanguage} scriptVersion={batch?.script_version ?? null} />
                                )}
                            </div>

                            <div className="flex flex-col gap-3 rounded-lg border border-line-faint bg-ink-800/70 p-4">
                                <h4 className="font-ui text-label font-semibold text-fg">{t('admin.voices.acceptance.review.reference')}</h4>
                                <Field label={t('admin.voices.acceptance.review.referenceVoice')} className="max-w-md">
                                    <Select
                                        options={voiceSelectOptions(references, t)}
                                        value={referenceKey}
                                        onChange={setReferenceKey}
                                        placeholder={t('admin.voices.acceptance.review.referencePick')}
                                    />
                                </Field>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="flex flex-col gap-1.5">
                                        {candidateNarration?.audio_url ? (
                                            <ConsoleAudioPlayer
                                                path={candidateNarration.audio_url}
                                                title={t('admin.voices.acceptance.review.candidateRender', { name: reviewVoice.display_name })}
                                                durationMs={candidateNarration.duration_ms}
                                            />
                                        ) : (
                                            <p className="font-ui text-sm text-fg-muted">{t('admin.voices.acceptance.review.noRenders')}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        {reference ? (
                                            sampleUrl(reference, reviewLanguage) ? (
                                                <ConsoleAudioPlayer
                                                    path={sampleUrl(reference, reviewLanguage)}
                                                    title={t('admin.voices.acceptance.review.referenceSample', { name: reference.display_name })}
                                                />
                                            ) : (
                                                <p className="font-ui text-sm text-fg-muted">{t('admin.voices.acceptance.review.referenceNoSample')}</p>
                                            )
                                        ) : (
                                            <p className="font-ui text-sm text-fg-muted">{t('admin.voices.acceptance.review.referencePick')}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4 2xl:grid-cols-2">
                                {(reviewVoice.provider === 'fish_audio' ? ['drama-3', 's2.1-pro'] : ACCEPTANCE_MODELS).map((modelId) => {
                                    const stored =
                                        reviewVoice.acceptance.find((row) => row.model_id === modelId && row.language === reviewLanguage) ?? null
                                    const measured = measuredLufs(modelId)
                                    return (
                                        <RubricForm
                                            // Remount when a new render batch brings a new measurement, so the form starts from it.
                                            key={`${reviewVoice.voice_key}-${reviewLanguage}-${modelId}-${stored?.reviewed_at ?? 'new'}-${measured ?? 'unmeasured'}`}
                                            modelId={modelId}
                                            modelLabel={t(`admin.voices.models.${modelId}`)}
                                            stored={stored}
                                            measuredLufs={measured}
                                            locale={locale}
                                            saving={saving === modelId}
                                            error={saveErrors[modelId] ?? null}
                                            onSubmit={(body) => void saveVerdict(modelId, body)}
                                        />
                                    )
                                })}
                            </div>

                            <section aria-labelledby="acceptance-samples-heading" className="flex flex-col gap-3 rounded-lg border border-line-faint bg-ink-800/70 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 id="acceptance-samples-heading" className="font-ui text-label font-semibold text-fg">
                                        {t('admin.voices.acceptance.samples.title')}
                                    </h4>
                                    <Button variant="secondary" size="sm" onClick={() => void rerenderSamples()} disabled={renderingSamples}>
                                        {renderingSamples ? t('admin.voices.acceptance.samples.rendering') : t('admin.voices.acceptance.samples.render')}
                                    </Button>
                                </div>
                                <p className="font-ui text-caption text-fg-muted">{t('admin.voices.acceptance.samples.note')}</p>
                                {samples.length > 0
                                    ? samples.map((sample) => (
                                          <ConsoleAudioPlayer
                                              key={sample.sample_asset_id}
                                              path={sample.url}
                                              title={t('admin.voices.acceptance.samples.sampleTitle', {
                                                  model: t(`admin.voices.models.short.${sample.model_id}`, { defaultValue: sample.model_id }),
                                                  language: languageName(sample.language),
                                              })}
                                          />
                                      ))
                                    : sampleUrl(reviewVoice, reviewLanguage) && (
                                          <ConsoleAudioPlayer
                                              path={sampleUrl(reviewVoice, reviewLanguage)}
                                              title={t('admin.voices.catalog.detail.sampleTitle', {
                                                  name: reviewVoice.display_name,
                                                  language: languageName(reviewLanguage),
                                              })}
                                          />
                                      )}
                            </section>
                        </>
                    )}
                </section>
            </div>
        </ConsoleSection>
    )
}
