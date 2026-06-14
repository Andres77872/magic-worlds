import { useTranslation } from 'react-i18next'
import { Field, Select, type SelectOption } from '@/ui/primitives'
import {
    DEFAULT_PITCH,
    DEFAULT_SPEED,
    DEFAULT_VOL,
    EMOTION_OPTIONS,
    FORMAT_OPTIONS,
    type KeyedOption,
    LANGUAGE_BOOST_OPTIONS,
    MODEL_OPTIONS,
    SAMPLE_RATE_OPTIONS,
    type SynthSettings,
} from '../constants'
import { ControlSlider } from './ControlSlider'

interface SynthControlsProps {
    settings: SynthSettings
    onChange: (patch: Partial<SynthSettings>) => void
}

export function SynthControls({ settings, onChange }: SynthControlsProps) {
    const { t } = useTranslation()
    const resolve = (options: KeyedOption[]): SelectOption[] =>
        options.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
            ...(option.descriptionKey ? { description: t(option.descriptionKey) } : {}),
        }))
    return (
        <div className="flex flex-col gap-4 rounded-lg border border-parchment-50/[.08] bg-ink-800/40 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('admin.voices.synth.fields.model')}>
                    <Select options={resolve(MODEL_OPTIONS)} value={settings.model} onChange={(model) => onChange({ model })} size="sm" />
                </Field>
                <Field label={t('admin.voices.synth.fields.emotion')}>
                    <Select options={resolve(EMOTION_OPTIONS)} value={settings.emotion} onChange={(emotion) => onChange({ emotion })} size="sm" />
                </Field>
                <Field label={t('admin.voices.synth.fields.audioFormat')}>
                    <Select
                        options={resolve(FORMAT_OPTIONS)}
                        value={settings.audioFormat}
                        onChange={(audioFormat) => onChange({ audioFormat })}
                        size="sm"
                    />
                </Field>
                <Field label={t('admin.voices.synth.fields.sampleRate')}>
                    <Select
                        options={resolve(SAMPLE_RATE_OPTIONS)}
                        value={settings.sampleRate}
                        onChange={(sampleRate) => onChange({ sampleRate })}
                        size="sm"
                    />
                </Field>
            </div>
            <Field label={t('admin.voices.synth.fields.languageBoost')}>
                <Select
                    options={resolve(LANGUAGE_BOOST_OPTIONS)}
                    value={settings.languageBoost}
                    onChange={(languageBoost) => onChange({ languageBoost })}
                    size="sm"
                />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
                <ControlSlider
                    label={t('admin.voices.synth.fields.speed')}
                    value={settings.speed}
                    min={0.5}
                    max={2}
                    step={0.1}
                    defaultValue={DEFAULT_SPEED}
                    onChange={(speed) => onChange({ speed })}
                    format={(value) => value.toFixed(1)}
                />
                <ControlSlider
                    label={t('admin.voices.synth.fields.volume')}
                    value={settings.vol}
                    min={0.1}
                    max={10}
                    step={0.1}
                    defaultValue={DEFAULT_VOL}
                    onChange={(vol) => onChange({ vol })}
                    format={(value) => value.toFixed(1)}
                />
                <ControlSlider
                    label={t('admin.voices.synth.fields.pitch')}
                    value={settings.pitch}
                    min={-12}
                    max={12}
                    step={1}
                    defaultValue={DEFAULT_PITCH}
                    onChange={(pitch) => onChange({ pitch })}
                />
            </div>
        </div>
    )
}
