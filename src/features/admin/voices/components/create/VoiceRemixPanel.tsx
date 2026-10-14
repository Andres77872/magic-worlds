/**
 * Remix (05 §8.9, AC-R8): a variant of an owned voice. Ineligible inputs show
 * the reason (D09 Library remix rule, IVC consent scope); saves carry
 * `parent_voice_key`. The original is never modified.
 */
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Shuffle } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { RemixPromptStrength, VoiceRemixRequest } from '@/shared'
import { Button, Field, Icon, Input, Select, SwitchRow } from '@/ui/primitives'
import {
    DEFAULT_PREVIEW_TEXT,
    DESIGN_DESCRIPTION_MAX,
    DESIGN_DESCRIPTION_MIN,
    DESIGN_LOUDNESS_DEFAULT,
    DESIGN_TEXT_MAX,
    DESIGN_TEXT_MIN,
    REMIX_GUIDANCE_DEFAULT,
    REMIX_PROMPT_STRENGTHS,
} from '../../constants'
import { remixEligibility } from '../../consoleRules'
import { voiceSelectOptions } from '../../voiceOptions'
import { ControlSlider } from '@/features/voices/components/ControlSlider'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'
import { CountedTextarea, lengthOk } from './CountedTextarea'
import { PreviewSessionView } from './PreviewSessionView'
import { usePreviewSession } from './usePreviewSession'

export function VoiceRemixPanel() {
    const { t } = useTranslation()
    const { catalog } = useVoiceConsole()
    const state = usePreviewSession()
    const reasonId = useId()
    const [sourceKey, setSourceKey] = useState('')
    const [change, setChange] = useState('')
    const [text, setText] = useState(DEFAULT_PREVIEW_TEXT)
    const [autoText, setAutoText] = useState(false)
    const [guidance, setGuidance] = useState(REMIX_GUIDANCE_DEFAULT)
    const [strength, setStrength] = useState<RemixPromptStrength>('medium')
    const [loudness, setLoudness] = useState(DESIGN_LOUDNESS_DEFAULT)
    const [seed, setSeed] = useState('')
    const [attempted, setAttempted] = useState(false)

    const source = sourceKey ? catalog.byKey.get(sourceKey) : undefined
    const eligibility = source ? remixEligibility(source) : null
    const options = voiceSelectOptions(catalog.voices.filter((voice) => voice.status !== 'removed'), t)
    const valid = Boolean(eligibility?.eligible) && lengthOk(change, DESIGN_DESCRIPTION_MIN, DESIGN_DESCRIPTION_MAX) && (autoText || lengthOk(text, DESIGN_TEXT_MIN, DESIGN_TEXT_MAX))

    const submit = (event: FormEvent) => {
        event.preventDefault()
        setAttempted(true)
        if (!valid || !source) return
        const parsedSeed = Number.parseInt(seed, 10)
        const body: VoiceRemixRequest = {
            voice_description: change.trim(),
            text: autoText ? null : text.trim(),
            auto_generate_text: autoText,
            guidance_scale: guidance,
            prompt_strength: strength,
            loudness,
            seed: Number.isFinite(parsedSeed) ? parsedSeed : null,
        }
        void state.generate((signal) => apiService.remixAdminVoice(source.voice_key, body, signal), body.voice_description, source.voice_key)
    }

    return (
        <div className="flex flex-col gap-5">
            <form onSubmit={submit} noValidate aria-label={t('admin.voices.remix.title')} className="flex flex-col gap-4">
                <p className="font-ui text-[13px] text-parchment-300">{t('admin.voices.remix.description')}</p>
                <Field label={t('admin.voices.remix.source')}>
                    <Select options={options} value={sourceKey} onChange={setSourceKey} placeholder={t('admin.voices.lab.voicePlaceholder')} />
                </Field>
                {eligibility && !eligibility.eligible && eligibility.reasonKey && (
                    <p id={reasonId} role="status" className="font-ui text-sm text-amber-500">
                        {t(eligibility.reasonKey)}
                    </p>
                )}
                <CountedTextarea
                    label={t('admin.voices.remix.change')}
                    helper={t('admin.voices.remix.changeHelp')}
                    value={change}
                    onChange={setChange}
                    min={DESIGN_DESCRIPTION_MIN}
                    max={DESIGN_DESCRIPTION_MAX}
                    showError={attempted}
                    rows={2}
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
                <div className="grid gap-4 sm:grid-cols-2">
                    <ControlSlider
                        label={t('admin.voices.remix.guidance')}
                        value={guidance}
                        min={0}
                        max={20}
                        step={0.5}
                        defaultValue={REMIX_GUIDANCE_DEFAULT}
                        onChange={setGuidance}
                        format={(value) => value.toFixed(1)}
                    />
                    <Field label={t('admin.voices.remix.strength.label')}>
                        <Select
                            options={REMIX_PROMPT_STRENGTHS.map((value) => ({ value, label: t(`admin.voices.remix.strength.${value}`) }))}
                            value={strength}
                            onChange={(value) => setStrength(value as RemixPromptStrength)}
                        />
                    </Field>
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
                    <Field label={t('admin.voices.design.seed')} helper={t('admin.voices.design.seedHelp')}>
                        <Input type="number" inputMode="numeric" value={seed} onChange={(event) => setSeed(event.target.value)} />
                    </Field>
                </div>
                <div>
                    <Button
                        type="submit"
                        variant="arcane"
                        iconLeft={<Icon icon={Shuffle} size={15} />}
                        disabled={state.generating || !eligibility?.eligible}
                        aria-describedby={eligibility && !eligibility.eligible ? reasonId : undefined}
                    >
                        {state.generating ? t('admin.voices.design.generating') : t('admin.voices.remix.generate')}
                    </Button>
                </div>
            </form>

            <PreviewSessionView state={state} filenameBase={source?.display_name ?? 'remix'} />
        </div>
    )
}
