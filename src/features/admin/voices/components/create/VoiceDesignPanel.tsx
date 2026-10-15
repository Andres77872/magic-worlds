/**
 * Voice Design: shared description with provider-specific text/controls,
 * candidate comparison and an actor-owned same-session save.
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Info, Sparkles } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { VoiceDesignRequest } from '@/shared'
import { Button, Callout, Field, Icon, Input, Select, SwitchRow } from '@/ui/primitives'
import {
    DEFAULT_PREVIEW_TEXT,
    DEFAULT_PROMPT,
    DESIGN_DESCRIPTION_MAX,
    DESIGN_DESCRIPTION_MIN,
    DESIGN_GUIDANCE_DEFAULT,
    DESIGN_LOUDNESS_DEFAULT,
    DESIGN_QUALITY_DEFAULT,
    DESIGN_TEXT_MAX,
    DESIGN_TEXT_MIN,
} from '../../constants'
import { ControlSlider } from '@/features/voices/components/ControlSlider'
import { CheckboxField } from '../shell/CheckboxField'
import { CountedTextarea, lengthOk } from './CountedTextarea'
import { PreviewSessionView } from './PreviewSessionView'
import { usePreviewSession } from './usePreviewSession'
import { useAbortableLoad } from '../../hooks/useAbortableLoad'

const loadFishDesign = (signal: AbortSignal) => apiService.getFishDesignCapabilities(signal)
const FISH_TEXT = {
    en: 'Rain whispered against the tower windows as the last candle burned low.',
    es: 'La lluvia susurraba contra las ventanas de la torre mientras la última vela se consumía.',
}

export function VoiceDesignPanel() {
    const { t, i18n } = useTranslation()
    const state = usePreviewSession()
    const fish = useAbortableLoad(loadFishDesign, 'fish-design')
    const [provider, setProvider] = useState<'elevenlabs' | 'fish_audio'>(() => new URLSearchParams(window.location.hash.split('?')[1]).get('provider') === 'fish_audio' ? 'fish_audio' : 'elevenlabs')
    const [language, setLanguage] = useState<'en' | 'es'>('en')
    const [fishText, setFishText] = useState(FISH_TEXT.en)
    const [count, setCount] = useState(2)
    const isFish = provider === 'fish_audio'
    const fishAvailable = fish.data?.available === true
    const [description, setDescription] = useState(DEFAULT_PROMPT)
    const [text, setText] = useState(DEFAULT_PREVIEW_TEXT)
    const [autoText, setAutoText] = useState(false)
    const [advancedOpen, setAdvancedOpen] = useState(false)
    const [loudness, setLoudness] = useState(DESIGN_LOUDNESS_DEFAULT)
    const [guidance, setGuidance] = useState(DESIGN_GUIDANCE_DEFAULT)
    const [seed, setSeed] = useState('')
    const [qualityOn, setQualityOn] = useState(false)
    const [quality, setQuality] = useState(DESIGN_QUALITY_DEFAULT)
    const [enhance, setEnhance] = useState(false)
    const [noSoundAlike, setNoSoundAlike] = useState(false)
    const [attempted, setAttempted] = useState(false)

    const descriptionValid = lengthOk(description, DESIGN_DESCRIPTION_MIN, DESIGN_DESCRIPTION_MAX)
    const textValid = isFish ? lengthOk(fishText, 1, 150) : autoText || lengthOk(text, DESIGN_TEXT_MIN, DESIGN_TEXT_MAX)
    const valid = descriptionValid && textValid && noSoundAlike && (!isFish || fishAvailable)

    const submit = (event: FormEvent) => {
        event.preventDefault()
        setAttempted(true)
        if (!valid) return
        if (isFish) {
            void state.generate((signal) => apiService.designFishVoice({
                voice_description: description.trim(), text: fishText.trim(), language,
                candidate_count: count, attest_original_voice: true,
            }, signal), description.trim(), null)
            return
        }
        const parsedSeed = Number.parseInt(seed, 10)
        const body: VoiceDesignRequest = {
            voice_description: description.trim(),
            text: autoText ? null : text.trim(),
            auto_generate_text: autoText,
            loudness,
            guidance_scale: guidance,
            seed: Number.isFinite(parsedSeed) ? parsedSeed : null,
            quality: qualityOn ? quality : null,
            should_enhance: enhance,
        }
        void state.generate((signal) => apiService.designAdminVoice(body, signal), body.voice_description, null)
    }

    return (
        <div className="flex flex-col gap-5">
            <form onSubmit={submit} noValidate aria-label={t('admin.voices.design.title')} className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('admin.voices.fish.designProvider')}>
                    {(['fish_audio', 'elevenlabs'] as const).map((value) => <Button key={value}
                        variant={provider === value ? 'primary' : 'secondary'} aria-pressed={provider === value}
                        onClick={() => setProvider(value)} disabled={state.generating || state.saving}>
                        {value === 'fish_audio' ? 'Fish Audio' : 'ElevenLabs'}
                    </Button>)}
                </div>
                <p className="font-ui text-[13px] text-parchment-300">{t(isFish ? 'admin.voices.fish.designDescription' : 'admin.voices.design.description')}</p>
                {isFish && <>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={t('admin.voices.fish.designLanguage')}><Select value={language}
                            options={[{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }]}
                            onChange={(value) => {
                                const next = value as typeof language
                                if (fishText === FISH_TEXT[language]) setFishText(FISH_TEXT[next])
                                setLanguage(next)
                            }} /></Field>
                        <Field label={t('admin.voices.fish.designCandidates')}><Select value={String(count)}
                            options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: String(value) }))}
                            onChange={(value) => setCount(Number(value))} /></Field>
                    </div>
                    {!fishAvailable && <Callout tone="warning">{t('admin.voices.fish.designUnavailable')}</Callout>}
                    {fishAvailable && fish.data?.request_price_usd_micros != null && <p className="font-ui text-caption text-fg-muted">
                        {t('admin.voices.fish.designCost', { price: new Intl.NumberFormat(i18n.resolvedLanguage ?? 'en', { style: 'currency', currency: 'USD' }).format(fish.data.request_price_usd_micros / 1_000_000) })}
                    </p>}
                </>}
                <CountedTextarea
                    label={t('admin.voices.design.descriptionLabel')}
                    helper={t('admin.voices.design.descriptionHelp')}
                    value={description}
                    onChange={setDescription}
                    min={DESIGN_DESCRIPTION_MIN}
                    max={DESIGN_DESCRIPTION_MAX}
                    showError={attempted}
                    rows={3}
                />
                {!isFish && <SwitchRow label={t('admin.voices.design.autoText')} checked={autoText} onChange={setAutoText} variant="plain" />}
                <CountedTextarea
                    label={t('admin.voices.design.text')}
                    helper={t(isFish ? 'admin.voices.fish.designTextHelp' : 'admin.voices.design.textHelp')}
                    value={isFish ? fishText : text}
                    onChange={isFish ? setFishText : setText}
                    min={isFish ? 1 : DESIGN_TEXT_MIN}
                    max={isFish ? 150 : DESIGN_TEXT_MAX}
                    disabled={!isFish && autoText}
                    showError={attempted}
                />

                {!isFish && <div className="flex flex-col gap-3">
                    <div>
                        <Button
                            variant="ghost"
                            size="sm"
                            aria-expanded={advancedOpen}
                            aria-controls="voice-design-advanced"
                            iconLeft={<Icon icon={ChevronDown} size={14} className={advancedOpen ? 'rotate-180' : undefined} />}
                            onClick={() => setAdvancedOpen((open) => !open)}
                        >
                            {t('admin.voices.design.advanced')}
                        </Button>
                    </div>
                    <div id="voice-design-advanced" hidden={!advancedOpen} className="grid gap-4 rounded-lg border border-line-faint bg-ink-800/70 p-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <ControlSlider
                                label={t('admin.voices.design.loudness')}
                                value={loudness}
                                min={-1}
                                max={1}
                                step={0.05}
                                defaultValue={DESIGN_LOUDNESS_DEFAULT}
                                onChange={setLoudness}
                                format={(value) => value.toFixed(2)}
                            />
                            <span className="font-ui text-caption text-fg-muted">{t('admin.voices.design.loudnessHelp')}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <ControlSlider
                                label={t('admin.voices.design.guidance')}
                                value={guidance}
                                min={0}
                                max={20}
                                step={0.5}
                                defaultValue={DESIGN_GUIDANCE_DEFAULT}
                                onChange={setGuidance}
                                format={(value) => value.toFixed(1)}
                            />
                            <span className="font-ui text-caption text-fg-muted">{t('admin.voices.design.guidanceHelp')}</span>
                        </div>
                        <Field label={t('admin.voices.design.seed')} helper={t('admin.voices.design.seedHelp')}>
                            <Input type="number" inputMode="numeric" value={seed} onChange={(event) => setSeed(event.target.value)} />
                        </Field>
                        <div className="flex flex-col gap-2">
                            <SwitchRow label={t('admin.voices.design.qualityToggle')} checked={qualityOn} onChange={setQualityOn} variant="plain" />
                            {qualityOn && (
                                <ControlSlider
                                    label={t('admin.voices.design.quality')}
                                    value={quality}
                                    min={-1}
                                    max={1}
                                    step={0.05}
                                    defaultValue={DESIGN_QUALITY_DEFAULT}
                                    onChange={setQuality}
                                    format={(value) => value.toFixed(2)}
                                />
                            )}
                        </div>
                        <SwitchRow label={t('admin.voices.design.enhance')} checked={enhance} onChange={setEnhance} variant="plain" />
                    </div>
                </div>}

                <CheckboxField label={t('admin.voices.design.noSoundAlike')} checked={noSoundAlike} onChange={setNoSoundAlike} />
                {attempted && !noSoundAlike && (
                    <p role="alert" className="font-ui text-sm text-blood-300">
                        {t('admin.voices.design.noSoundAlikeRequired')}
                    </p>
                )}
                <p className="flex items-center gap-2 font-ui text-caption text-amber-500">
                    <Icon icon={Info} size={13} />
                    {t('admin.voices.design.childLikeBanned')}
                </p>
                <div>
                    <Button type="submit" variant="arcane" iconLeft={<Icon icon={Sparkles} size={15} />} disabled={state.generating || state.saving || isFish && !fishAvailable}>
                        {state.generating ? t('admin.voices.design.generating') : t('admin.voices.design.generate')}
                    </Button>
                </div>
            </form>

            <PreviewSessionView state={state} filenameBase={description.slice(0, 40)} />
        </div>
    )
}
