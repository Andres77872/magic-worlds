/**
 * Voice Design (D20, 05 §8.8, AC-R7): description 20–1,000 characters, text
 * 100–1,000 or auto, advanced options, three previews, and a same-session save.
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Info, Sparkles } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { VoiceDesignRequest } from '@/shared'
import { Button, Field, Icon, Input, SwitchRow } from '@/ui/primitives'
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

export function VoiceDesignPanel() {
    const { t } = useTranslation()
    const state = usePreviewSession()
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
    const textValid = autoText || lengthOk(text, DESIGN_TEXT_MIN, DESIGN_TEXT_MAX)
    const valid = descriptionValid && textValid && noSoundAlike

    const submit = (event: FormEvent) => {
        event.preventDefault()
        setAttempted(true)
        if (!valid) return
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
                <p className="font-ui text-[13px] text-parchment-300">{t('admin.voices.design.description')}</p>
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
                <SwitchRow label={t('admin.voices.design.autoText')} checked={autoText} onChange={setAutoText} variant="plain" />
                <CountedTextarea
                    label={t('admin.voices.design.text')}
                    helper={t('admin.voices.design.textHelp')}
                    value={text}
                    onChange={setText}
                    min={DESIGN_TEXT_MIN}
                    max={DESIGN_TEXT_MAX}
                    disabled={autoText}
                    showError={attempted}
                />

                <div className="flex flex-col gap-3">
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
                </div>

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
                    <Button type="submit" variant="arcane" iconLeft={<Icon icon={Sparkles} size={15} />} disabled={state.generating}>
                        {state.generating ? t('admin.voices.design.generating') : t('admin.voices.design.generate')}
                    </Button>
                </div>
            </form>

            <PreviewSessionView state={state} filenameBase={description.slice(0, 40)} />
        </div>
    )
}
